import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { capsuleView, capsuleSend, capsuleOpenNow, capsuleMarkRead, myCapsules, memoryBook } from '../services/capsule';
import { blindReveal } from '../services/green';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapMedium, tapSuccess, tapCelebrate } from '../utils/feedback';
import { AV_NEUTRAL } from '../constants/mockData';

/* ─── NOTES THAT OPEN AT THE END, AND THE MEMORY BOOK ─────────────────
   Ayser's spec, after the letters people write on an exchange and get
   only on the last day. With an event: write to anyone on it; what was
   written to you waits sealed until it ends. Without one: every trip
   and plan you have notes from. The book is one clean page per part —
   cover, your photos, your reflections, the notes — that the phone
   prints or saves as a PDF. */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');

function printBook(b, t, lang) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const d = (x) => { try { return new Date(x).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  const photos = (b.photos || []).filter((p) => safeUrl(p.url)).map((p) => '<figure><img src="' + esc(safeUrl(p.url)) + '"><figcaption>' + esc(p.caption || '') + '</figcaption></figure>').join('');
  const refl = (b.reflections || []).map((r) => '<div class="r"><div class="q">' + esc(r.prompt) + '</div><div>' + esc(r.body) + '</div></div>').join('');
  const notes = (b.notes || []).map((n) => '<div class="n"><div>' + esc(n.body) + '</div><div class="f">— ' + esc(n.from) + '</div></div>').join('');
  const html = '<!doctype html><html dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + esc(b.title) + '</title><style>'
    + '@page{size:A5;margin:14mm}body{font-family:Helvetica,Arial,sans-serif;color:#111;margin:0}'
    + 'section{page-break-after:always;min-height:180mm}section:last-child{page-break-after:auto}'
    + '.k{font-size:9pt;letter-spacing:3px;font-weight:700;color:#7C3AED}h1{font-size:30pt;line-height:1.05;margin:60mm 0 4mm}h2{font-size:16pt;margin:0 0 6mm;border-bottom:1px solid #111;padding-bottom:2mm}'
    + '.m{font-size:10pt;color:#555}ol{font-size:11pt;line-height:1.8;padding-inline-start:5mm}figure{margin:0 0 6mm;break-inside:avoid}img{width:100%;max-height:110mm;object-fit:cover;display:block}figcaption{font-size:9pt;color:#555;margin-top:1.5mm}'
    + '.r,.n{margin-bottom:6mm;break-inside:avoid;font-size:11pt;line-height:1.5}.q{font-size:9pt;color:#777;font-style:italic;margin-bottom:1mm}.n{border-inline-start:2px solid #7C3AED;padding-inline-start:4mm}.f{font-size:9.5pt;color:#555;margin-top:1.5mm}'
    + '</style></head><body>'
    + '<section><div class="k">MOMENTS</div><h1>' + esc(b.title) + '</h1><div class="m">' + esc(b.name || '') + '<br>' + esc(d(b.starts_at)) + (b.ends_at ? ' – ' + esc(d(b.ends_at)) : '') + '</div></section>'
    + '<section><h2>' + esc(t('mb_index')) + '</h2><ol>' + (photos ? '<li>' + esc(t('mb_photos')) + '</li>' : '') + (refl ? '<li>' + esc(t('mb_reflections')) + '</li>' : '') + (notes ? '<li>' + esc(t('mb_notes')) + '</li>' : '') + '</ol></section>'
    + (photos ? '<section><h2>' + esc(t('mb_photos')) + '</h2>' + photos + '</section>' : '')
    + (refl ? '<section><h2>' + esc(t('mb_reflections')) + '</h2>' + refl + '</section>' : '')
    + (notes ? '<section><h2>' + esc(t('mb_notes')) + '</h2>' + notes + '</section>' : '')
    + '</body></html>';
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 700);
}

/* a person on a blind meet is an emoji until both of you show yourselves */
const Face = ({ p, size = 52, ring }) => (p.avatar ? <Image source={{ uri: p.avatar }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: ring ? C.purple : 'transparent' }} /> : (
  <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDE9FE', borderWidth: 2.5, borderColor: ring ? C.purple : 'transparent' }}>
    <Text style={{ fontSize: size * 0.5 }}>{p.emoji || '🙂'}</Text>
  </View>
));

const when = (iso, lang) => { try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };

export const CapsuleSheet = ({ kind, id, title, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const [ev, setEv] = useState(kind && id ? { kind, id, title } : null);
  const [list, setList] = useState(null);
  const [v, setV] = useState(null);
  const [to, setTo] = useState(null);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState(null);
  const [opened, setOpened] = useState(null);   // the note shown big, once
  useSheetBack(() => (opened ? setOpened(null) : ev && !(kind && id) ? setEv(null) : onClose && onClose()));

  const load = () => { if (ev) capsuleView(ev.kind, ev.id).then((r) => setV(r || { ok: false, reason: 'offline' })); };
  useEffect(() => { setV(null); if (ev) load(); else myCapsules().then(setList); }, [ev]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!to || !body.trim()) return;
    tapMedium(); setMsg(null);
    const r = await capsuleSend(ev.kind, ev.id, to.id, body.trim());
    if (r && r.ok) { tapSuccess(); setBody(''); setTo(null); setMsg(t('tk_sent')); load(); }
    else setMsg(t('tk_err_' + (['over', 'blocked', 'too_many'].includes(r && r.reason) ? r.reason : 'other')));
  };
  const open = (n) => { tapCelebrate(); setOpened(n); if (!n.read) capsuleMarkRead(n.id); };
  const book = async () => { tapLight(); const b = await memoryBook(ev.kind, ev.id); if (b && b.ok) printBook(b, t, lang); };
  const openNow = async () => { tapMedium(); await capsuleOpenNow(ev.kind, ev.id); load(); };
  const reveal = async (p) => { tapMedium(); const r = await blindReveal(ev.id, p.id, !p.i_revealed); if (r && r.mutual) tapCelebrate(); load(); };


  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 50 }}>
          <Pressable onPress={() => { tapLight(); if (ev && !(kind && id)) setEv(null); else onClose && onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name={ev && !(kind && id) ? 'chevron-back' : 'chevron-down'} size={26} color={C.text} />
          </Pressable>

          {!ev ? (
            <>
              <Text style={{ color: C.text, fontSize: 32, fontWeight: '800', marginTop: 12 }}>{'✉️ ' + t('tk_title')}</Text>
              <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{t('tk_list_sub')}</Text>
              {list == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} /> : !list.length ? <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 24, lineHeight: 21 }}>{t('tk_none')}</Text> : list.map((e) => (
                <Pressable key={e.kind + e.id} onPress={() => { tapLight(); setEv({ kind: e.kind, id: e.id, title: e.title }); }} accessibilityRole="button" style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                    <Text style={{ fontSize: 24 }}>{Number(e.waiting) ? '🔒' : '💌'}</Text>
                    <View style={{ flex: 1, marginStart: 12 }}>
                      <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{e.title}</Text>
                      <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{Number(e.waiting) ? t('tk_waiting').replace('{n}', String(e.waiting)) : t('tk_open_n').replace('{n}', String(e.open))}</Text>
                    </View>
                    {Number(e.unread) ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.purple }} /> : null}
                  </View>
                </Pressable>
              ))}
            </>
          ) : v == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 40 }} /> : !v.ok ? (
            <Text style={{ color: C.dim, fontSize: 15, marginTop: 30 }}>{t(v.reason === 'not_on_it' ? 'cp_not_on_it' : 'cp_err_other')}</Text>
          ) : (
            <>
              <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 12 }}>{t('tk_title').toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{v.title}</Text>
              <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{t('tk_sub').replace('{when}', when(v.opens_at || v.ends_at, lang))}</Text>
              {v.blind && v.me ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, borderRadius: 18, padding: 14, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE' }}>
                  <Text style={{ fontSize: 30 }}>{v.me.emoji || '🎭'}</Text>
                  <View style={{ flex: 1, marginStart: 12 }}>
                    <Text style={{ color: '#4C1D95', fontSize: 15.5, fontWeight: '900' }}>{t('bm_you_are').replace('{name}', v.me.name || '')}</Text>
                    <Text style={{ color: '#5B21B6', fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{t('bm_sub')}</Text>
                  </View>
                </View>
              ) : null}

              {/* sealed for you */}
              {Number(v.waiting) ? (
                <View style={{ marginTop: 18, borderRadius: 22, padding: 22, alignItems: 'center', backgroundColor: '#1A1A1A' }}>
                  <Text style={{ fontSize: 40 }}>🔒✉️</Text>
                  <Text style={{ color: '#F9F9F6', fontSize: 18, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>{t('tk_waiting').replace('{n}', String(v.waiting))}</Text>
                  <Text style={{ color: 'rgba(249,249,246,0.7)', fontSize: 13.5, marginTop: 4, textAlign: 'center' }}>{t('tk_opens').replace('{when}', when(v.opens_at || v.ends_at, lang))}</Text>
                </View>
              ) : null}

              {/* opened for you */}
              {v.open.length ? (
                <View style={{ marginTop: 18 }}>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 8 }}>{'💌 ' + t('tk_for_you')}</Text>
                  {v.open.map((n) => (
                    <Pressable key={n.id} onPress={() => open(n)} accessibilityRole="button" style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, backgroundColor: n.read ? C.glass : '#F3EEFF', borderWidth: 1, borderColor: n.read ? C.line : '#C4B5FD' }}>
                        {n.avatar || !n.emoji ? <Image source={{ uri: n.avatar || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17 }} /> : <Face p={n} size={34} />}
                        <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '800', marginStart: 10 }}>{t('tk_from').replace('{name}', n.from || '')}</Text>
                        <Text style={{ fontSize: 18 }}>{n.read ? '📖' : '✨'}</Text>
                      </View>
                    </Pressable>
                  ))}
                  <Pressable onPress={book} accessibilityRole="button" style={{ marginTop: 10 }}>
                    <View style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: C.text }}>
                      <Text style={{ color: C.bg, fontSize: 15.5, fontWeight: '800' }}>{'📕 ' + t('mb_make')}</Text>
                    </View>
                  </Pressable>
                  <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>{t('mb_note')}</Text>
                </View>
              ) : null}

              {/* write to someone on it */}
              <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginTop: 24 }}>{'✍️ ' + t('tk_write')}</Text>
              {!v.people.length ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{t('tk_nobody')}</Text> : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
                  {v.people.map((p) => (
                    <View key={p.id} style={{ alignItems: 'center', width: 84, marginEnd: 8 }}>
                      <Pressable onPress={() => { tapLight(); setTo(p); setMsg(null); }} accessibilityRole="radio" accessibilityState={{ checked: to && to.id === p.id }} style={{ alignItems: 'center' }}>
                        {p.avatar || !v.blind ? <Image source={{ uri: p.avatar || AV_NEUTRAL }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: to && to.id === p.id ? C.purple : 'transparent' }} /> : <Face p={p} ring={to && to.id === p.id} />}
                        <Text numberOfLines={1} style={{ color: C.text, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{p.name}</Text>
                      </Pressable>
                      {v.blind && !p.revealed ? (
                        <Pressable onPress={() => reveal(p)} accessibilityRole="button" hitSlop={6} style={{ marginTop: 4 }}>
                          <Text style={{ color: p.i_revealed ? C.green : C.purple, fontSize: 11, fontWeight: '800', textAlign: 'center' }}>{p.i_revealed ? '✓ ' + t('bm_shown') : t('bm_show')}</Text>
                        </Pressable>
                      ) : v.blind && p.revealed ? <Text style={{ color: C.green, fontSize: 11, fontWeight: '800', marginTop: 4 }}>{'🤝 ' + t('bm_both')}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              )}
              {to ? (
                <View style={{ marginTop: 10 }}>
                  <TextInput value={body} onChangeText={setBody} maxLength={1500} multiline placeholder={t('tk_ph').replace('{name}', to.name || '')} placeholderTextColor={C.faint}
                    style={{ color: C.text, fontSize: 15.5, lineHeight: 22, minHeight: 100, borderRadius: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, padding: 12, textAlignVertical: 'top', outlineStyle: 'none' }} />
                  <Pressable onPress={send} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: body.trim() ? C.purple : C.glassHi }}>
                      <Text style={{ color: body.trim() ? '#FFF' : C.faint, fontSize: 14, fontWeight: '900' }}>{'🔒 ' + t('tk_seal')}</Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
              {msg ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 8 }}>{msg}</Text> : null}

              {v.sent.length ? (
                <View style={{ marginTop: 22 }}>
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>{t('tk_you_wrote').toUpperCase()}</Text>
                  {v.sent.map((s) => (
                    <View key={s.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700' }}>{t('tk_to').replace('{name}', s.to || '')}</Text>
                      <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 20, marginTop: 2 }} numberOfLines={3}>{s.body}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {v.host && Number(v.waiting) >= 0 ? (
                <Pressable onPress={openNow} accessibilityRole="button" style={{ marginTop: 22, alignSelf: 'flex-start' }}>
                  <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '800' }}>{'🔓 ' + t('tk_host_open')}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* the moment a note opens */}
        {opened ? (
          <Pressable onPress={() => setOpened(null)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,20,22,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ width: '100%', maxWidth: 420, borderRadius: 26, padding: 26, backgroundColor: '#FFFDF7' }}>
              <Text style={{ fontSize: 34, textAlign: 'center' }}>✨💌✨</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 17, lineHeight: 26, marginTop: 14 }}>{opened.body}</Text>
              <Text style={{ color: '#6B6B70', fontSize: 14, fontWeight: '700', marginTop: 16, textAlign: 'right' }}>{'— ' + (opened.from || '')}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 14 }}>{t('close')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
};
