import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, TextInput, ActivityIndicator, Modal, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { BOOK_SHELVES, fetchShelf, searchBooks, readUrl, buyOptions } from '../services/books';
import { openPartner } from '../services/broker';
import { tapLight } from '../utils/feedback';

/* ── READ ───────────────────────────────────────────────────────────
   A bookshelf, not a bookshop pretending to be one.

   Books out of copyright open and you read them, whole, free. Books
   still in copyright open at a real shop — we never host, copy or
   excerpt those, and the buy button says plainly that it is leaving.

   Every record comes from Open Library, a real catalogue of millions.
   Nothing here is made up, and when a shelf is empty it says so. */

const Cover = ({ book, w = 104 }) => {
  const h = Math.round(w * 1.5);
  if (book.cover) {
    return <Image source={{ uri: book.cover }} style={{ width: w, height: h, borderRadius: 8, backgroundColor: C.glassHi }} />;
  }
  // no artwork in the catalogue — a readable spine beats a grey box
  return (
    <LinearGradient
      colors={['#4C1D95', '#7C3AED']}
      style={{ width: w, height: h, borderRadius: 8, padding: 8, justifyContent: 'flex-end' }}
    >
      <Text numberOfLines={4} style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900', lineHeight: 15 }}>{book.title}</Text>
    </LinearGradient>
  );
};

export const BooksShelf = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [shelf, setShelf] = useState(BOOK_SHELVES[0]);
  const [books, setBooks] = useState(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setBooks(null); setErr(null);
    try { setBooks(await fetchShelf(shelf)); }
    catch (e) { setBooks([]); setErr(e && e.message); }
  }, [shelf]);
  useEffect(() => { load(); }, [load]);

  const runSearch = async () => {
    const term = q.trim();
    if (!term) { load(); return; }
    setSearching(true); setBooks(null); setErr(null);
    try { setBooks(await searchBooks(term)); }
    catch (e) { setBooks([]); setErr(e && e.message); }
    finally { setSearching(false); }
  };

  const read = (b) => {
    const url = readUrl(b);
    if (url) { tapLight(); Linking.openURL(url).catch(() => {}); }
  };

  const buy = (b, opt) => {
    tapLight();
    openPartner(user, { id: 'book:' + b.id, partner: opt.partner, url: opt.url });
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', letterSpacing: 2, flex: 1 }}>READ 📚</Text>
      </View>
      <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 18, marginBottom: 10 }}>
        Books out of copyright open free, whole. Everything else opens at a real shop —
        we don't host or sell books.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 }}>
        <Ionicons name="search" size={15} color={C.dim} />
        <TextInput
          placeholder="A title, an author, a subject…"
          placeholderTextColor={C.faint}
          value={q} onChangeText={setQ}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 10, marginLeft: 8 }}
        />
        {q ? (
          <Pressable onPress={() => { setQ(''); load(); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={C.faint} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
        {BOOK_SHELVES.map((s) => {
          const on = shelf.id === s.id && !q;
          return (
            <Pressable
              key={s.id}
              onPress={() => { tapLight(); setQ(''); setShelf(s); }}
              style={{ backgroundColor: on ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 }}
            >
              <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800' }}>{s.emoji} {s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {books === null || searching ? (
        <View style={{ paddingVertical: 34 }}><ActivityIndicator color={C.purple} /></View>
      ) : books.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {books.map((b) => (
            <Pressable key={b.id} onPress={() => { tapLight(); setOpen(b); }} style={{ width: 104, marginRight: 12 }}>
              <View>
                <Cover book={b} />
                {b.free ? (
                  <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '900' }}>FREE</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={{ color: C.text, fontSize: 12, fontWeight: '800', marginTop: 6 }}>{b.title}</Text>
              <Text numberOfLines={1} style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{b.author}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={{ paddingVertical: 26, alignItems: 'center' }}>
          <Text style={{ fontSize: 26 }}>📚</Text>
          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 8, textAlign: 'center', lineHeight: 18 }}>
            {err || 'Nothing on this shelf right now — try a search.'}
          </Text>
        </View>
      )}

      {open ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={() => setOpen(null)} />
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: R + 6, borderTopRightRadius: R + 6, borderWidth: 1, borderColor: C.line, padding: 20, paddingBottom: insets.bottom + 22 }}>
            <View style={{ flexDirection: 'row' }}>
              <Cover book={open} w={92} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{open.title}</Text>
                <Text style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>
                  {open.author}{open.year ? ' · ' + open.year : ''}
                </Text>
                {open.free ? (
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginTop: 8, lineHeight: 17 }}>
                    Out of copyright — read the whole book, free.
                  </Text>
                ) : (
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
                    Still in copyright, so it opens at a shop rather than here.
                  </Text>
                )}
              </View>
            </View>

            {open.free && readUrl(open) ? (
              <Pressable onPress={() => read(open)} style={{ marginTop: 16 }}>
                <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>Read it now — free 📖</Text>
                </LinearGradient>
              </Pressable>
            ) : null}

            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 6 }}>
              BUY IT
            </Text>
            {buyOptions(open).map((o) => (
              <Pressable key={o.id} onPress={() => buy(open, o)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>{o.emoji}</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', flex: 1 }}>{o.name}</Text>
                <Ionicons name="open-outline" size={16} color={C.faint} />
              </Pressable>
            ))}
            <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 10, lineHeight: 15 }}>
              These open the shop's own site. Moments may earn a commission on a sale — it never
              changes what you pay.
            </Text>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};
