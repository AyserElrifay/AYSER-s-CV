import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, TextInput, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { searchBooks, readUrl, buyOptions } from '../services/books';
import { AFFILIATE_TAGS } from '../services/broker';
import { myPlus } from '../services/offers';
import { sendFeedback } from '../services/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

const GreenSheet = lazyOverlay(() => import('./green/GreenSheet').then((m) => ({ default: m.GreenSheet })));

/* ─── THE LIBRARY ─────────────────────────────────────────────────────
   Ayser: "خد كل الكتب الفري… اعمل مكتبة بطريقة ستيف جوبز، من غير ما
   تسرق حقوق ملكية… وخليها جزء من الاشتراك". Only books whose copyright
   has ended — whole, free, read in the Internet Archive's own reader;
   we host and copy nothing. Reading is part of Plus. A book that is
   still in copyright is never shown as if we had it: the member can
   ask us for it, or find it in a shop — and a shop shows only when an
   affiliate code for it is set, so a link never leaves for nothing.

   One quiet page: a title, a search, one book to start with, then
   shelves of covers. A book opens alone on the page, big. */

const SHELVES = [
  { id: 'classics', q: 'subject:"classic literature"' },
  { id: 'stories', q: 'subject:fiction' },
  { id: 'adventure', q: 'subject:adventure' },
  { id: 'ideas', q: 'subject:philosophy' },
  { id: 'minds', q: 'subject:psychology' },
  { id: 'poetry', q: 'subject:poetry' },
  { id: 'history', q: 'subject:history' },
  { id: 'travel', q: 'subject:travel' },
  { id: 'arabic', q: 'language:ara' },
];

const Cover = ({ book, w }) => {
  const h = Math.round(w * 1.5);
  return (
    <View style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E8E6E0', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }}>
      {book.cover ? <Image source={{ uri: book.cover }} style={{ width: w, height: h }} accessibilityLabel={book.title} /> : (
        <View style={{ flex: 1, padding: 10, justifyContent: 'flex-end', backgroundColor: '#2B2B2E' }}>
          <Text numberOfLines={5} style={{ color: '#F9F9F6', fontSize: Math.max(11, w / 9), fontWeight: '800', lineHeight: Math.max(14, w / 7) }}>{book.title}</Text>
        </View>
      )}
    </View>
  );
};

const Book = ({ book, onBack, t, plus, onRead, onTogether }) => (
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 28, paddingBottom: 60 }}>
    <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('back')} style={{ alignSelf: 'flex-start', marginBottom: 18 }}>
      <Ionicons name="chevron-back" size={26} color={C.text} />
    </Pressable>
    <Cover book={book} w={190} />
    <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 28, lineHeight: 31 }}>{book.title}</Text>
    <Text style={{ color: C.dim, fontSize: 16, textAlign: 'center', marginTop: 6 }}>{book.author + (book.year ? ' · ' + book.year : '')}</Text>
    <Pressable onPress={onRead} accessibilityRole="button" style={{ marginTop: 28, alignSelf: 'stretch' }}>
      <View style={{ borderRadius: 14, backgroundColor: C.text, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ color: C.bg, fontSize: 17, fontWeight: '800' }}>{plus === false ? '✦ ' + t('lb_read') : t('lb_read')}</Text>
      </View>
    </Pressable>
    <Pressable onPress={onTogether} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'stretch' }}>
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{'☕ ' + t('lb_together')}</Text>
      </View>
    </Pressable>
    <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>{plus === false ? t('lb_plus') : t('lb_free_note')}</Text>
  </ScrollView>
);

export const LibrarySheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [shelves, setShelves] = useState({});
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);     // search results, null = not searching
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState(null);
  const [plus, setPlus] = useState(null);
  const [asked, setAsked] = useState(false);
  const [club, setClub] = useState(null);
  useSheetBack(() => (book ? setBook(null) : onClose && onClose()));

  useEffect(() => {
    let alive = true;
    myPlus().then((r) => { if (alive) setPlus(r && typeof r.plus === 'boolean' ? r.plus : null); }).catch(() => {});
    SHELVES.forEach((s) => {
      searchBooks(s.q, { limit: 14, freeOnly: true })
        .then((list) => { if (alive) setShelves((m) => ({ ...m, [s.id]: list.filter((b) => b.free && b.iaId) })); })
        .catch(() => { if (alive) setShelves((m) => ({ ...m, [s.id]: [] })); });
    });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = SHELVES.filter((s) => shelves[s.id] !== undefined).length;
  useEffect(() => { if (loaded === SHELVES.length && SHELVES.every((s) => !(shelves[s.id] || []).length)) setFailed(true); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    const term = q.trim();
    if (!term) { setFound(null); return; }
    setBusy(true); setAsked(false);
    try { setFound((await searchBooks(term, { limit: 30, freeOnly: true })).filter((b) => b.free && b.iaId)); }
    catch (e) { setFound([]); }
    setBusy(false);
  };

  const read = (b) => {
    tapMedium();
    /* Plus is checked on the server for everything that costs; a free
       book is free to the world, so this only asks the reader in */
    if (plus === false) { try { window.dispatchEvent(new Event('mm-need-plus')); } catch (e) {} return; }
    const url = readUrl(b);
    if (url) Linking.openURL(url).catch(() => {});
  };
  const together = (b) => { tapLight(); setClub({ kind: 'circle', title: t('lb_club').replace('{title}', b.title), about: b.author ? b.title + ' · ' + b.author : b.title }); };
  const ask = async () => {
    const term = q.trim(); if (!term) return;
    tapLight();
    try { await sendFeedback(user && user.id, 'idea', 'Book request: ' + term); setAsked(true); tapSuccess(); } catch (e) { setAsked(true); }
  };
  const shops = q.trim() ? buyOptions({ title: q.trim(), author: '' }).filter((s) => !!AFFILIATE_TAGS[s.partner]) : [];

  const featured = (shelves.classics || [])[0];
  const row = (s) => {
    const list = shelves[s.id];
    if (list === undefined) return <View key={s.id} style={{ height: 40 }} />;
    if (!list.length) return null;
    return (
      <View key={s.id} style={{ marginTop: 30 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>{t('lb_s_' + s.id)}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {list.map((b) => (
            <Pressable key={b.id} onPress={() => { tapLight(); setBook(b); }} accessibilityRole="button" accessibilityLabel={b.title} style={{ width: 104, marginEnd: 16 }}>
              <Cover book={b} w={104} />
              <Text numberOfLines={2} style={{ color: C.text, fontSize: 13, fontWeight: '600', marginTop: 10, lineHeight: 17 }}>{b.title}</Text>
              <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{b.author}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => (book ? setBook(null) : onClose && onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
        {book ? (
          <Book book={book} t={t} plus={plus} onBack={() => setBook(null)} onRead={() => read(book)} onTogether={() => together(book)} />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 60 }}>
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color={C.text} />
            </Pressable>
            <Text style={{ color: C.text, fontSize: 40, fontWeight: '800', letterSpacing: -0.8, marginTop: 14 }}>{t('lb_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 15.5, lineHeight: 22, marginTop: 6 }}>{t('lb_sub')}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, borderRadius: 12, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={17} color={C.faint} />
              <TextInput value={q} onChangeText={(v) => { setQ(v); if (!v.trim()) setFound(null); }} onSubmitEditing={search} returnKeyType="search"
                placeholder={t('lb_search')} placeholderTextColor={C.faint}
                style={{ flex: 1, color: C.text, fontSize: 16, paddingVertical: 11, paddingHorizontal: 8, outlineStyle: 'none' }} />
              {busy ? <ActivityIndicator size="small" color={C.faint} /> : null}
            </View>

            {found ? (
              <View style={{ marginTop: 22 }}>
                {found.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {found.map((b) => (
                      <Pressable key={b.id} onPress={() => { tapLight(); setBook(b); }} accessibilityRole="button" style={{ width: '30%', marginBottom: 22 }}>
                        <Cover book={b} w={100} />
                        <Text numberOfLines={2} style={{ color: C.text, fontSize: 12.5, fontWeight: '600', marginTop: 8 }}>{b.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : <Text style={{ color: C.dim, fontSize: 14.5 }}>{t('lb_empty')}</Text>}
                {/* not among the free ones: ask for it, or a shop — never a pretend copy */}
                <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18 }}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{t('lb_missing_t')}</Text>
                  <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{t('lb_missing_b')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                    <Pressable onPress={ask} disabled={asked} accessibilityRole="button" style={{ marginEnd: 10, marginBottom: 8 }}>
                      <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.text, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>{asked ? '✓ ' + t('lb_asked') : t('lb_ask')}</Text>
                      </View>
                    </Pressable>
                    {shops.map((s) => (
                      <Pressable key={s.id} onPress={() => { tapLight(); Linking.openURL(s.url).catch(() => {}); }} accessibilityRole="link" style={{ marginEnd: 10, marginBottom: 8 }}>
                        <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8 }}>
                          <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '700' }}>{s.emoji + ' ' + s.name + ' ↗'}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <>
                {featured ? (
                  <Pressable onPress={() => { tapLight(); setBook(featured); }} accessibilityRole="button" style={{ marginTop: 26, flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                    <Cover book={featured} w={96} />
                    <View style={{ flex: 1, minWidth: 0, marginStart: 18 }}>
                      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2 }}>{t('lb_start').toUpperCase()}</Text>
                      <Text numberOfLines={3} style={{ color: C.text, fontSize: 19, fontWeight: '800', marginTop: 6, lineHeight: 24 }}>{featured.title}</Text>
                      <Text numberOfLines={1} style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{featured.author}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {failed ? <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 30 }}>{t('lb_err')}</Text> : SHELVES.map(row)}
              </>
            )}
          </ScrollView>
        )}
        {club ? <GreenSheet startNow prefill={club} onClose={() => setClub(null)} /> : null}
      </View>
    </Modal>
  );
};
