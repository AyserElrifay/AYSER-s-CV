import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Animated, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { mw, until } from '../constants/memoryWords';
import { mv } from '../constants/mvpWords';
import { splitPrompt } from '../constants/loopWords';
import { memoryBook, pinMoment, highlightMoment, makeLight, isVideoUrl } from '../services/memory';
import { askUpgrade } from '../services/membership';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── THE MEMORY BOOK ─────────────────────────────────────────────────
   Ayser, October 2026: a moment lives 48 hours in the feed, then it
   comes here — a photo book on Space, a chapter a month.
   · Moments+ and Black keep every moment, and choose Highlights for
     their profile. Black gets the book in matte obsidian.
   · Free keeps five pins. Past five, a moment that has left the feed
     waits here, blurred and locked, for 48 hours — then it is deleted
     with its file (RUN_ME.sql, "THE MEMORY BOOK").
   Tap a page to turn it over: the notes your Table Buddies left on it. */

const WORDMARK = require('../assets/brand/wordmark.png');
const WORDMARK_WHITE = require('../assets/brand/wordmark-white.png');

const PAPER = { bg: '#FAF9F6', page: '#FFFFFF', ink: '#1A1A1A', dim: '#6B6B6B', faint: '#9A9A95', line: '#E8E6DF', btn: '#1A1A1A', btnInk: '#FFFFFF' };
const OBSIDIAN = { bg: '#0B0B0B', page: '#161616', ink: '#EDEDED', dim: '#A3A3A3', faint: '#6B6B6B', line: '#262626', btn: '#EDEDED', btnInk: '#0B0B0B' };
/* the four pillars, in pastel on paper and quietly on black */
const PILLAR = {
  tables: { paper: '#F3E3D3', ink: '#6B4A2E', dark: '#D9B99A' },
  culture: { paper: '#E5DEF3', ink: '#4C3D72', dark: '#BCAEE0' },
  impact: { paper: '#DCEEDF', ink: '#2F5B3A', dark: '#9FCDAA' },
  roam: { paper: '#D9E8F3', ink: '#2D4F66', dark: '#9CC2DD' },
};
const pillarOf = (s) => {
  const t = String(s || '').toLowerCase();
  if (/museum|opera|art|book|read|music|concert|gallery|theat|paint|poem|متحف|أوبرا|كتاب|قراية|مزيكا|فن|رسم/.test(t)) return 'culture';
  if (/volunteer|clean|plant|tree|green|donat|help|تطوع|نضف|زرع|شجر|خضرا|تبرع/.test(t)) return 'impact';
  if (/trip|travel|desert|beach|sea|mountain|camp|road|sky|view|رحلة|سفر|صحرا|بحر|جبل|سما|منظر/.test(t)) return 'roam';
  return 'tables';
};

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const monthName = (lang, d) => (lang === 'ar' ? MONTHS.ar : MONTHS.en)[d.getMonth()];
/* "29 OCT • ZAMALEK" */
const stamp = (lang, it) => {
  const d = new Date(it.created_at);
  const day = lang === 'ar' ? AR(d.getDate()) + ' ' + MONTHS.ar[d.getMonth()] : d.getDate() + ' ' + MONTHS.en[d.getMonth()].slice(0, 3).toUpperCase();
  const place = it.place ? String(it.place).split(',')[0].trim() : '';
  return place ? day + '  •  ' + (lang === 'ar' ? place : place.toUpperCase()) : day;
};
const titleOf = (it) => {
  const sp = splitPrompt(it.caption);
  if (sp) return { title: sp.prompt, note: sp.rest };
  const c = String(it.caption || '').replace(/^🎬$/, '').trim();
  return { title: c, note: '' };
};
const picOf = (it) => (isVideoUrl(it.media_url) ? it.thumb_url : it.media_url) || it.thumb_url || null;

/* ─── ONE PAGE ── a Polaroid that turns over */
const Page = ({ it, lang, P, black, member, full, tilt, onPin, onHighlight }) => {
  const turn = useRef(new Animated.Value(0)).current;
  const [back, setBack] = useState(false);
  const flip = () => {
    tapLight();
    Animated.timing(turn, { toValue: back ? 0 : 1, duration: 420, useNativeDriver: Platform.OS !== 'web' }).start();
    setBack(!back);
  };
  const now = Date.now();
  const gone = it.expires_at && new Date(it.expires_at).getTime() <= now;
  const locked = !it.keep && gone && !member && full;      // past five, out of the feed: blurred until it goes
  const pillar = PILLAR[pillarOf(it.caption + ' ' + (it.place || ''))];
  const pKey = pillarOf(it.caption + ' ' + (it.place || ''));
  const { title, note } = titleOf(it);
  const pic = picOf(it);
  const notes = Array.isArray(it.notes) ? it.notes : [];
  const front = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const rear = turn.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const face = { backfaceVisibility: 'hidden', borderRadius: 6, backgroundColor: P.page, padding: 8, paddingBottom: 12, borderWidth: 1, borderColor: P.line };

  if (locked) {
    return (
      <Pressable testID="mb-locked" onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ width: '48%', marginBottom: 16, transform: [{ rotate: tilt }] }}>
        <View style={face}>
          <View style={{ aspectRatio: 4 / 5, borderRadius: 3, overflow: 'hidden', backgroundColor: P.line }}>
            {pic ? <Image source={{ uri: pic }} blurRadius={18} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: 'rgba(0,0,0,0.28)' }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 16 }}>{'✦ ' + mw(lang, 'lock')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center', marginTop: 3 }}>{mw(lang, 'lockSub')}</Text>
            </View>
          </View>
          <Text style={{ color: P.faint, fontSize: 10.5, fontWeight: '700', marginTop: 9, letterSpacing: lang === 'ar' ? 0 : 1 }}>{mw(lang, 'grace', { t: until(lang, it.grace_until) || '—' })}</Text>
        </View>
      </Pressable>
    );
  }

  const status = it.keep ? null : gone ? mw(lang, 'grace', { t: until(lang, it.grace_until) || '—' }) : mw(lang, 'live', { t: until(lang, it.expires_at) || '—' });
  return (
    <View style={{ width: '48%', marginBottom: 16, transform: [{ rotate: tilt }] }}>
      <Pressable testID="mb-page" onPress={flip} accessibilityRole="button" accessibilityHint={mw(lang, 'flip')}>
        <Animated.View style={[face, { transform: [{ perspective: 900 }, { rotateY: front }] }]}>
          <View style={{ aspectRatio: 4 / 5, borderRadius: 3, overflow: 'hidden', backgroundColor: P.line }}>
            {pic ? <Image source={{ uri: pic }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
            {it.highlight ? (
              <View style={{ position: 'absolute', top: 6, right: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>✦</Text>
              </View>
            ) : null}
          </View>
          {/* the caption bar: the prompt, then the date and the neighbourhood */}
          <Text numberOfLines={2} style={{ color: P.ink, fontSize: 13, fontWeight: '600', lineHeight: 17, marginTop: 9, fontFamily: Platform.OS === 'web' ? 'Georgia, "Times New Roman", serif' : undefined, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>
            {title || mv(lang, 'cat' + pKey.charAt(0).toUpperCase() + pKey.slice(1))}
          </Text>
          <Text numberOfLines={1} style={{ color: P.dim, fontSize: 10, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 5 }}>{stamp(lang, it)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
            <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: black ? 'rgba(255,255,255,0.07)' : pillar.paper }}>
              <Text style={{ color: black ? pillar.dark : pillar.ink, fontSize: 10, fontWeight: '700' }}>{mv(lang, 'cat' + pKey.charAt(0).toUpperCase() + pKey.slice(1))}</Text>
            </View>
          </View>
        </Animated.View>

        {/* the back of the page */}
        <Animated.View pointerEvents={back ? 'auto' : 'none'} style={[face, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ perspective: 900 }, { rotateY: rear }] }]}>
          <Text style={{ color: P.faint, fontSize: 10, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{(notes.some((n) => n.buddy) ? mw(lang, 'backBuddies') : mw(lang, 'back')).toUpperCase()}</Text>
          {note ? <Text style={{ color: P.ink, fontSize: 12.5, lineHeight: 18, marginTop: 8 }} numberOfLines={3}>{note}</Text> : null}
          {notes.length ? notes.map((n, i) => (
            <View key={i} style={{ marginTop: 9 }}>
              <Text style={{ color: P.ink, fontSize: 12.5, lineHeight: 17 }} numberOfLines={3}>{'“' + n.body + '”'}</Text>
              <Text style={{ color: P.dim, fontSize: 10.5, marginTop: 2 }} numberOfLines={1}>{'— ' + (n.name || '') + (n.buddy ? '  ·  ' + mw(lang, 'buddy') : '')}</Text>
            </View>
          )) : <Text style={{ color: P.dim, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{mw(lang, 'noNotes')}</Text>}
        </Animated.View>
      </Pressable>

      {/* what you can do with it */}
      {status ? <Text style={{ color: P.faint, fontSize: 10.5, fontWeight: '700', marginTop: 7 }}>{status}</Text> : null}
      {!member ? (
        <Pressable testID="mb-pin" onPress={() => onPin(it)} accessibilityRole="button" hitSlop={6} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: it.keep ? P.ink : P.line, backgroundColor: it.keep ? P.ink : 'transparent', paddingHorizontal: 10, paddingVertical: 5 }}>
            <Ionicons name={it.keep ? 'bookmark' : 'bookmark-outline'} size={12} color={it.keep ? P.bg : P.ink} />
            <Text style={{ color: it.keep ? P.bg : P.ink, fontSize: 11.5, fontWeight: '700', marginHorizontal: 5 }}>{it.keep ? mw(lang, 'pinned') : mw(lang, 'pinShort')}</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable testID="mb-highlight" onPress={() => onHighlight(it)} accessibilityRole="switch" accessibilityState={{ checked: !!it.highlight }} hitSlop={6} style={{ marginTop: 7, alignSelf: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: it.highlight ? P.ink : P.line, backgroundColor: it.highlight ? P.ink : 'transparent', paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: it.highlight ? P.bg : P.ink, fontSize: 11.5, fontWeight: '700' }}>{it.highlight ? '✦ ' + mw(lang, 'highlighted') : mw(lang, 'highlight')}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
};

/* ─── THE MONTHLY RECAP ── a 9:16 picture for an Instagram story */
const loadImg = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img); img.onerror = () => resolve(null);
  img.src = src;
});
const assetUri = (a) => { try { const r = Image.resolveAssetSource ? Image.resolveAssetSource(a) : null; return (r && r.uri) || (typeof a === 'string' ? a : a && (a.uri || a.default)); } catch (e) { return typeof a === 'string' ? a : null; } };
const cover = (ctx, img, x, y, w, h) => {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
};
export async function makeRecap({ lang, black, label, count, items }) {
  const P = black ? OBSIDIAN : PAPER;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const x = c.getContext('2d');
  x.fillStyle = P.bg; x.fillRect(0, 0, 1080, 1920);
  x.direction = lang === 'ar' ? 'rtl' : 'ltr';
  x.textAlign = 'center';
  const mark = await loadImg(assetUri(black ? WORDMARK_WHITE : WORDMARK));
  if (mark) { const w = 340, h = w * (mark.height / mark.width); x.drawImage(mark, 540 - w / 2, 120, w, h); }
  x.fillStyle = P.faint; x.font = '700 30px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  x.fillText(lang === 'ar' ? mw(lang, 'kicker') : mw(lang, 'kicker').split('').join(String.fromCharCode(8202)), 540, 330);
  x.fillStyle = P.ink; x.font = 'italic 600 84px Georgia, "Times New Roman", serif';
  x.fillText(label, 540, 440);
  x.fillStyle = P.dim; x.font = '600 38px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  x.fillText(count, 540, 505);
  const pics = (await Promise.all(items.slice(0, 4).map((it) => loadImg(picOf(it))))).map((img, i) => ({ img, it: items[i] })).filter((p) => p.img);
  const cols = 2, fw = 440, fh = 520, gx = 60, gy = 600, tilt = [-0.03, 0.025, 0.02, -0.025, -0.02, 0.03];
  pics.forEach((p, i) => {
    const cx = gx + (i % cols) * (fw + 80) + fw / 2, cy = gy + Math.floor(i / cols) * (fh + 30) + fh / 2;
    x.save(); x.translate(cx, cy); x.rotate(tilt[i]);
    x.fillStyle = P.page; x.fillRect(-fw / 2, -fh / 2, fw, fh);
    x.strokeStyle = P.line; x.lineWidth = 2; x.strokeRect(-fw / 2, -fh / 2, fw, fh);
    try { cover(x, p.img, -fw / 2 + 18, -fh / 2 + 18, fw - 36, fh - 110); } catch (e) {}
    x.fillStyle = P.dim; x.font = '700 24px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    x.fillText(stamp(lang, p.it), 0, fh / 2 - 38);
    x.restore();
  });
  x.fillStyle = P.faint; x.font = '600 28px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  x.fillText('moments', 540, 1850);
  const blob = await new Promise((r) => { try { c.toBlob(r, 'image/jpeg', 0.9); } catch (e) { r(null); } });
  return blob;
}
async function shareRecap(blob, name) {
  if (!blob) return false;
  const file = new File([blob], name, { type: 'image/jpeg' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; } } catch (e) { if (e && e.name === 'AbortError') return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return 'saved';
}

/* ─── THE BOOK ─────────────────────────────────────────────────────── */
export const MemoryBook = () => {
  const { lang } = useLang();
  const { user } = useAuth() || {};
  const [book, setBook] = useState(null);
  const [note, setNote] = useState(null);
  const [making, setMaking] = useState(null);
  const load = () => memoryBook().then((b) => { if (b && b.ok) setBook(b); });
  useEffect(() => { load(); }, []);
  // kept photos are made light, a few at a time, once each
  useEffect(() => {
    if (!book || !user) return;
    const todo = (book.items || []).filter((it) => it.keep).slice(0, 3);
    let alive = true;
    (async () => { for (const it of todo) { if (!alive) return; await makeLight(it, user.id); } })();
    return () => { alive = false; };
  }, [book && book.items && book.items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!book) return null;

  const black = book.tier === 'VIP';
  const P = black ? OBSIDIAN : PAPER;
  const member = !!book.member;
  const items = Array.isArray(book.items) ? book.items : [];
  const full = (book.pins || 0) >= (book.limit || 5);

  const pin = async (it) => {
    tapLight(); setNote(null);
    if (!it.keep && full) { setNote(mw(lang, 'full', { max: book.limit || 5 })); return; }
    const r = await pinMoment(it.id, !it.keep);
    if (r && r.ok) {
      tapSuccess();
      setBook({ ...book, pins: r.pins, items: items.map((x) => (x.id === it.id ? { ...x, keep: r.keep } : x)) });
      if (r.keep && user) makeLight(it, user.id);
    } else setNote(r && r.reason === 'full' ? mw(lang, 'full', { max: book.limit || 5 }) : mw(lang, 'err'));
  };
  const highlight = async (it) => {
    tapLight(); setNote(null);
    const r = await highlightMoment(it.id, !it.highlight);
    if (r && r.ok) setBook({ ...book, items: items.map((x) => (x.id === it.id ? { ...x, highlight: r.highlight } : x)) });
    else setNote(mw(lang, 'err'));
  };

  // a chapter a month, newest first
  const chapters = [];
  items.forEach((it) => {
    const d = new Date(it.created_at);
    const key = d.getFullYear() + '-' + d.getMonth();
    let ch = chapters.find((c) => c.key === key);
    if (!ch) { ch = { key, d, items: [] }; chapters.push(ch); }
    ch.items.push(it);
  });
  const recap = async (ch) => {
    if (Platform.OS !== 'web' || making) return;
    tapLight(); setMaking(ch.key); setNote(null);
    const label = mw(lang, 'chapter', { m: monthName(lang, ch.d) });
    const count = ch.items.length === 1 ? mw(lang, 'count1') : mw(lang, 'countN', { n: ch.items.length });
    const shown = ch.items.filter((it) => it.keep || member || !it.expires_at || new Date(it.expires_at).getTime() > Date.now());
    const blob = await makeRecap({ lang, black, label, count, items: shown });
    const r = await shareRecap(blob, 'moments-' + monthName('en', ch.d).toLowerCase() + '.jpg');
    setMaking(null);
    if (r === 'saved') setNote(mw(lang, 'recapSaved')); else if (!r) setNote(mw(lang, 'err'));
  };

  return (
    <View testID="memory-book" style={{ marginHorizontal: 16, marginTop: 22, borderRadius: 24, backgroundColor: P.bg, borderWidth: 1, borderColor: P.line, padding: 16 }}>
      <Text style={{ color: P.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{mw(lang, 'kicker')}</Text>
      <Text style={{ color: P.ink, fontSize: 24, fontWeight: '600', marginTop: 6, fontFamily: Platform.OS === 'web' ? 'Georgia, "Times New Roman", serif' : undefined, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{mw(lang, 'title')}</Text>
      <Text style={{ color: P.dim, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>
        {member ? mw(lang, 'subMember') : mw(lang, 'subFree', { n: book.pins || 0, max: book.limit || 5 })}
      </Text>
      {!member ? (
        <Pressable onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Text style={{ color: P.ink, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>{'✦ ' + mw(lang, 'lock')}</Text>
        </Pressable>
      ) : null}
      {note ? <Text style={{ color: P.ink, fontSize: 13, marginTop: 10 }}>{note}</Text> : null}

      {!items.length ? <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, marginTop: 16 }}>{mw(lang, 'empty')}</Text> : null}

      {chapters.map((ch) => (
        <View key={ch.key} style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: P.line, paddingBottom: 8, marginBottom: 14 }}>
            <Text style={{ color: P.ink, fontSize: 17, fontWeight: '600', fontFamily: Platform.OS === 'web' ? 'Georgia, "Times New Roman", serif' : undefined }}>{mw(lang, 'chapter', { m: monthName(lang, ch.d) })}</Text>
            <Text style={{ color: P.dim, fontSize: 13, marginHorizontal: 8 }}>{'•  ' + (ch.items.length === 1 ? mw(lang, 'count1') : mw(lang, 'countN', { n: ch.items.length }))}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {ch.items.map((it, i) => (
              <Page key={it.id} it={it} lang={lang} P={P} black={black} member={member} full={full} tilt={i % 2 ? '0.8deg' : '-0.8deg'} onPin={pin} onHighlight={highlight} />
            ))}
          </View>
          {Platform.OS === 'web' ? (
            <Pressable testID="mb-recap" onPress={() => recap(ch)} accessibilityRole="button" style={{ marginTop: 4 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: P.btn }}>
                {making === ch.key ? <ActivityIndicator color={P.btnInk} /> : <Text style={{ color: P.btnInk, fontSize: 14.5, fontWeight: '700' }}>{mw(lang, 'recap') + ' ✦'}</Text>}
              </View>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
};

/* ─── HIGHLIGHTS ON A PROFILE ── a quiet row of the moments someone chose */
export const MemoryHighlights = ({ items, onOpen, P = PAPER }) => {
  const { lang } = useLang();
  if (!items || !items.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: P.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4, marginBottom: 8 }}>{mw(lang, 'highlights').toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.slice(0, 9).map((it) => (
          <Pressable key={it.id} onPress={() => onOpen && onOpen(it)} accessibilityRole="button" style={{ width: '31%', marginEnd: '2%', marginBottom: 8 }}>
            <View style={{ backgroundColor: '#FFFFFF', padding: 4, paddingBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#E8E6DF' }}>
              <View style={{ aspectRatio: 4 / 5, backgroundColor: '#E8E6DF', overflow: 'hidden', borderRadius: 2 }}>
                {picOf(it) ? <Image source={{ uri: picOf(it) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              </View>
              <Text numberOfLines={1} style={{ color: '#6B6B6B', fontSize: 9, fontWeight: '700', marginTop: 5, letterSpacing: lang === 'ar' ? 0 : 0.8 }}>{stamp(lang, it)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
};
