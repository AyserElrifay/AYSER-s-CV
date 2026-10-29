import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { mw, until } from '../constants/memoryWords';
import { mv } from '../constants/mvpWords';
import { splitPrompt } from '../constants/loopWords';
import { memoryBook, keepPage, highlightPage, makeLight, isVideoUrl } from '../services/memory';
import { askUpgrade } from '../services/membership';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE MOMENTS BOOK ────────────────────────────────────────────────
   Ayser, October 2026: one book of days on Space, not a photo archive
   here and a list of past reflections somewhere else. Each day you were
   here is one page: the day's camera moment, your Reflection beneath it
   as a pull-quote (or as the whole page when there was no photo), your
   Daily Moment answer, and a stamp for every table you checked into.
   · Moments+ and Black keep every page and may show pages on their
     profile. Black gets the book in matte obsidian.
   · Free keeps five pages. Past five, a page's photo waits here blurred
     for 48 hours after it leaves the feed, then it is deleted with its
     file; the words stay — they are yours (RUN_ME.sql, "THE MOMENTS BOOK").
   Tap a page to open it whole, with the notes your Table Buddies left. */

const WORDMARK = require('../assets/brand/wordmark.png');
const WORDMARK_WHITE = require('../assets/brand/wordmark-white.png');

const PAPER = { bg: '#FAF9F6', page: '#FFFFFF', ink: '#1A1A1A', dim: '#6B6B6B', faint: '#9A9A95', line: '#E8E6DF', btn: '#1A1A1A', btnInk: '#FFFFFF', stamp: '#B08D57', stampBg: '#F5EEDF' };
const OBSIDIAN = { bg: '#0B0B0B', page: '#161616', ink: '#EDEDED', dim: '#A3A3A3', faint: '#6B6B6B', line: '#262626', btn: '#EDEDED', btnInk: '#0B0B0B', stamp: '#D9C08C', stampBg: 'rgba(217,192,140,0.10)' };
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
const catLabel = (lang, k) => mv(lang, 'cat' + k.charAt(0).toUpperCase() + k.slice(1));
const SERIF = Platform.OS === 'web' ? 'Georgia, "Times New Roman", serif' : undefined;

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const dayOf = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const monthName = (lang, d) => (lang === 'ar' ? MONTHS.ar : MONTHS.en)[d.getMonth()];
/* "29 OCT • ZAMALEK" */
const stampLine = (lang, d, place) => {
  const day = lang === 'ar' ? AR(d.getDate()) + ' ' + MONTHS.ar[d.getMonth()] : d.getDate() + ' ' + MONTHS.en[d.getMonth()].slice(0, 3).toUpperCase();
  const p = place ? String(place).split(',')[0].trim() : '';
  return p ? day + '  •  ' + (lang === 'ar' ? p : p.toUpperCase()) : day;
};
const titleOf = (ph) => {
  const sp = splitPrompt(ph && ph.caption);
  if (sp) return { title: sp.prompt, note: sp.rest };
  return { title: String((ph && ph.caption) || '').replace(/^🎬$/, '').trim(), note: '' };
};
const picOf = (ph) => (ph ? (isVideoUrl(ph.media_url) ? ph.thumb_url : ph.media_url) || ph.thumb_url || null : null);
const tagsOf = (s) => (String(s || '').match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 3);
const placeOf = (pg) => {
  const ph = (pg.photos || []).find((x) => x.place);
  const st = (pg.stamps || []).find((x) => x.place);
  return (ph && ph.place) || (st && st.place) || null;
};

const Tag = ({ label, bg, ink }) => (
  <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: bg, marginEnd: 6, marginTop: 6 }}>
    <Text style={{ color: ink, fontSize: 10.5, fontWeight: '700' }}>{label}</Text>
  </View>
);

/* ─── ONE PAGE ─────────────────────────────────────────────────────── */
const PageCard = ({ pg, lang, P, black, member, full, price, tilt, onOpen, onKeep, onHighlight }) => {
  const d = dayOf(pg.day);
  const ph = (pg.photos || [])[0] || null;
  const now = Date.now();
  const photoGone = ph && ph.expires_at && new Date(ph.expires_at).getTime() <= now;
  const locked = !!ph && !pg.keep && photoGone && !member && full;     // past five pages: the photo waits blurred, then goes
  const { title } = titleOf(ph);
  const refl = pg.reflection;
  const mom = pg.moment;
  const stamps = pg.stamps || [];
  const pk = pillarOf(((ph && ph.caption) || '') + ' ' + ((refl && refl.body) || '') + ' ' + stamps.map((s) => s.title).join(' '));
  const pill = PILLAR[pk];
  const mood = refl && refl.mood ? mw(lang, 'moods')[Math.max(0, Math.min(4, refl.mood - 1))] : null;
  const tags = tagsOf(ph && ph.caption);
  const status = !ph || pg.keep || member ? null : photoGone ? mw(lang, 'grace', { t: until(lang, ph.grace_until) || '—' }) : mw(lang, 'live', { t: until(lang, ph.expires_at) || '—' });
  const lockText = price ? mw(lang, 'lockPrice', { p: price, c: lang === 'ar' ? 'جنيه' : 'EGP' }) : mw(lang, 'lock');

  return (
    <View style={{ marginBottom: 20, transform: [{ rotate: tilt }] }}>
      <Pressable testID="mb-page" onPress={() => (locked ? (tapLight(), askUpgrade('member')) : onOpen(pg))} accessibilityRole="button" accessibilityHint={mw(lang, 'flip')}>
        <View style={{ borderRadius: 8, backgroundColor: P.page, padding: 12, borderWidth: 1, borderColor: P.line }}>
          {/* the date and the neighbourhood, like a stamp in the corner */}
          <Text style={{ color: P.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{stampLine(lang, d, placeOf(pg))}</Text>

          {ph ? (
            <View style={{ marginTop: 10, borderRadius: 4, overflow: 'hidden', backgroundColor: P.line, aspectRatio: 4 / 5 }}>
              {picOf(ph) ? <Image source={{ uri: picOf(ph) }} blurRadius={locked ? 18 : 0} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              {(pg.photos || []).length > 1 ? (
                <View style={{ position: 'absolute', top: 8, right: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{'1 / ' + pg.photos.length}</Text>
                </View>
              ) : null}
              {locked ? (
                <View testID="mb-locked" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.28)' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
                  </View>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 10, lineHeight: 20 }}>{'✦ ' + lockText}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>{mw(lang, 'lockSub')}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {ph && title ? (
            <Text numberOfLines={2} style={{ color: P.ink, fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 10, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{title}</Text>
          ) : null}

          {/* the day's reflection: a pull-quote under the photo, or the whole page without one */}
          {refl ? (
            <View style={{ marginTop: ph ? 12 : 8, paddingTop: ph ? 12 : 0, borderTopWidth: ph ? 1 : 0, borderTopColor: P.line }}>
              <Text style={{ color: P.faint, fontSize: 10, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{mw(lang, 'reflection')}</Text>
              {!ph && refl.prompt ? <Text style={{ color: P.dim, fontSize: 13, lineHeight: 18, marginTop: 6 }}>{refl.prompt}</Text> : null}
              <Text numberOfLines={ph ? 4 : 8} style={{ color: P.ink, fontSize: ph ? 17 : 24, lineHeight: ph ? 24 : 33, marginTop: 6, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>
                {'“' + refl.body + '”'}
              </Text>
            </View>
          ) : null}

          {/* the Daily Moment answer, one quiet line */}
          {mom && (mom.body || mom.choice) ? (
            <Text numberOfLines={2} style={{ color: P.dim, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>
              <Text style={{ color: P.faint, fontWeight: '800', fontSize: 10, letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{mw(lang, 'moment') + '  '}</Text>
              {(lang === 'ar' && mom.q_ar ? mom.q_ar : mom.q || '') + ' — ' + (mom.body || (Array.isArray(mom.choice) ? mom.choice[lang === 'ar' ? 1 : 0] : ''))}
            </Text>
          ) : null}

          {/* a stamp for every table you really sat at */}
          {stamps.map((s, i) => (
            <View key={i} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 10, borderRadius: 6, borderWidth: 1.5, borderColor: P.stamp, backgroundColor: P.stampBg, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: i % 2 ? '1.5deg' : '-1.5deg' }] }}>
              <Text style={{ color: P.stamp, fontSize: 12, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 0.6 }}>{'✦ ' + mw(lang, 'checkedIn', { t: s.title || s.place || '' })}</Text>
            </View>
          ))}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Tag label={catLabel(lang, pk)} bg={black ? 'rgba(255,255,255,0.07)' : pill.paper} ink={black ? pill.dark : pill.ink} />
            {mood ? <Tag label={mood} bg={black ? 'rgba(255,255,255,0.07)' : '#EEEDE8'} ink={P.dim} /> : null}
            {tags.map((t) => <Tag key={t} label={t} bg={black ? 'rgba(255,255,255,0.07)' : '#EEEDE8'} ink={P.dim} />)}
          </View>
        </View>
      </Pressable>

      {/* what you can do with the page */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {!member ? (
          <Pressable testID="mb-keep" onPress={() => onKeep(pg)} accessibilityRole="button" hitSlop={6} style={{ marginEnd: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: pg.keep ? P.ink : P.line, backgroundColor: pg.keep ? P.ink : 'transparent', paddingHorizontal: 11, paddingVertical: 6 }}>
              <Ionicons name={pg.keep ? 'bookmark' : 'bookmark-outline'} size={12} color={pg.keep ? P.bg : P.ink} />
              <Text style={{ color: pg.keep ? P.bg : P.ink, fontSize: 12, fontWeight: '700', marginHorizontal: 5 }}>{pg.keep ? mw(lang, 'kept') : mw(lang, 'keep')}</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable testID="mb-highlight" onPress={() => onHighlight(pg)} accessibilityRole="switch" accessibilityState={{ checked: !!pg.highlight }} hitSlop={6} style={{ marginEnd: 10 }}>
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: pg.highlight ? P.ink : P.line, backgroundColor: pg.highlight ? P.ink : 'transparent', paddingHorizontal: 11, paddingVertical: 6 }}>
              <Text style={{ color: pg.highlight ? P.bg : P.ink, fontSize: 12, fontWeight: '700' }}>{pg.highlight ? '✦ ' + mw(lang, 'highlighted') : mw(lang, 'highlight')}</Text>
            </View>
          </Pressable>
        )}
        {status ? <Text style={{ color: P.faint, fontSize: 11.5, fontWeight: '700' }}>{status}</Text> : null}
      </View>
    </View>
  );
};

/* ─── THE PAGE, OPENED ── every photo, the whole reflection, the notes */
const OpenPage = ({ pg, lang, P, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const d = dayOf(pg.day);
  const photos = (pg.photos || []).filter((ph) => picOf(ph) || ph.media_url);
  const notes = [].concat(...photos.map((ph) => (Array.isArray(ph.notes) ? ph.notes : [])));
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 30, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 520 }}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={mw(lang, 'close')}>
              <Ionicons name="close" size={26} color={P.ink} />
            </Pressable>
            <Text style={{ color: P.dim, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6, marginTop: 14 }}>{stampLine(lang, d, placeOf(pg))}</Text>
            {photos.map((ph) => {
              const { title, note } = titleOf(ph);
              return (
                <View key={ph.id} style={{ marginTop: 14, backgroundColor: P.page, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: P.line }}>
                  {isVideoUrl(ph.media_url) && Platform.OS === 'web'
                    ? React.createElement('video', { src: ph.media_url, poster: ph.thumb_url || undefined, controls: true, playsInline: true, style: { width: '100%', borderRadius: 4, background: '#000' } })
                    : <Image source={{ uri: picOf(ph) }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 4 }} resizeMode="cover" />}
                  {title ? <Text style={{ color: P.ink, fontSize: 17, fontWeight: '600', marginTop: 10, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{title}</Text> : null}
                  {note ? <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{note}</Text> : null}
                </View>
              );
            })}
            {pg.reflection ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: P.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{mw(lang, 'reflection')}</Text>
                {pg.reflection.prompt ? <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{pg.reflection.prompt}</Text> : null}
                <Text style={{ color: P.ink, fontSize: 24, lineHeight: 34, marginTop: 8, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{'“' + pg.reflection.body + '”'}</Text>
              </View>
            ) : null}
            {(pg.stamps || []).map((s, i) => (
              <View key={i} style={{ alignSelf: 'flex-start', marginTop: 14, borderRadius: 6, borderWidth: 1.5, borderColor: P.stamp, backgroundColor: P.stampBg, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: P.stamp, fontSize: 13, fontWeight: '800' }}>{'✦ ' + mw(lang, 'checkedIn', { t: s.title || s.place || '' })}</Text>
              </View>
            ))}
            <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: P.line }}>
              <Text style={{ color: P.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{(notes.some((n) => n.buddy) ? mw(lang, 'backBuddies') : mw(lang, 'back')).toUpperCase()}</Text>
              {notes.length ? notes.map((n, i) => (
                <View key={i} style={{ marginTop: 12 }}>
                  <Text style={{ color: P.ink, fontSize: 15, lineHeight: 21 }}>{'“' + n.body + '”'}</Text>
                  <Text style={{ color: P.dim, fontSize: 12, marginTop: 3 }}>{'— ' + (n.name || '') + (n.buddy ? '  ·  ' + mw(lang, 'buddy') : '')}</Text>
                </View>
              )) : <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, marginTop: 10 }}>{mw(lang, 'noNotes')}</Text>}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

/* ─── THE MONTHLY CHAPTER RECAP ── a 9:16 picture for an Instagram story */
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
const wrap = (x, text, maxW) => {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line);
  return lines;
};
const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export async function makeRecap({ lang, black, label, sub, photos, quote, checks }) {
  const P = black ? OBSIDIAN : PAPER;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const x = c.getContext('2d');
  x.fillStyle = P.bg; x.fillRect(0, 0, 1080, 1920);
  x.direction = lang === 'ar' ? 'rtl' : 'ltr';
  x.textAlign = 'center';
  const mark = await loadImg(assetUri(black ? WORDMARK_WHITE : WORDMARK));
  if (mark) { const w = 300, h = w * (mark.height / mark.width); x.drawImage(mark, 540 - w / 2, 100, w, h); }
  x.fillStyle = P.faint; x.font = '700 28px ' + SANS;
  x.fillText(mw(lang, 'kicker'), 540, 290);
  x.fillStyle = P.ink; x.font = 'italic 600 80px Georgia, "Times New Roman", serif';
  x.fillText(label, 540, 390);
  x.fillStyle = P.dim; x.font = '600 34px ' + SANS;
  x.fillText(sub, 540, 450);
  const pics = (await Promise.all(photos.slice(0, 4).map((ph) => loadImg(picOf(ph))))).map((img, i) => ({ img, ph: photos[i] })).filter((p) => p.img);
  // sizes by how many photos there are, then the whole block centred under the title
  const n = pics.length;
  const fw = n === 1 ? 640 : n === 2 ? 440 : 420, fh = n === 1 ? 760 : n === 2 ? 600 : 470;
  const rows = n > 2 ? 2 : n ? 1 : 0;
  const photosH = rows ? rows * fh + (rows - 1) * 26 : 0;
  x.font = 'italic 46px Georgia, "Times New Roman", serif';
  const qLines = quote ? wrap(x, '“' + quote + '”', 900).slice(0, 4) : [];
  const quoteH = qLines.length ? 50 + qLines.length * 60 : 0;
  const stampH = checks ? 120 : 0;
  let y = 500 + Math.max(0, (1300 - photosH - quoteH - stampH) / 2);
  const tilt = [-0.03, 0.025, 0.02, -0.025];
  pics.forEach((p, i) => {
    const cx = n === 1 || (n === 3 && i === 2) ? 540 : 540 + (i % 2 ? 1 : -1) * (fw / 2 + 30), cy = y + Math.floor(i / 2) * (fh + 26) + fh / 2;
    x.save(); x.translate(cx, cy); x.rotate(tilt[i]);
    x.fillStyle = P.page; x.fillRect(-fw / 2, -fh / 2, fw, fh);
    x.strokeStyle = P.line; x.lineWidth = 2; x.strokeRect(-fw / 2, -fh / 2, fw, fh);
    try { cover(x, p.img, -fw / 2 + 16, -fh / 2 + 16, fw - 32, fh - 92); } catch (e) {}
    x.fillStyle = P.dim; x.font = '700 22px ' + SANS;
    x.fillText(stampLine(lang, new Date(p.ph.created_at), p.ph.place), 0, fh / 2 - 32);
    x.restore();
  });
  y += photosH;
  // the month's best line, as a pull-quote
  if (qLines.length) {
    x.fillStyle = P.ink; x.font = 'italic 46px Georgia, "Times New Roman", serif';
    qLines.forEach((l, i) => x.fillText(l, 540, y + 80 + i * 60));
    y += quoteH;
  }
  // and the tables you really sat at, as a stamp
  if (checks) {
    const label = '✦ ' + checks;
    x.font = '800 34px ' + SANS;
    const w = x.measureText(label).width + 60;
    x.save(); x.translate(540, y + 70); x.rotate(-0.02);
    x.fillStyle = P.stampBg; x.fillRect(-w / 2, -36, w, 72);
    x.strokeStyle = P.stamp; x.lineWidth = 3; x.strokeRect(-w / 2, -36, w, 72);
    x.fillStyle = P.stamp; x.textBaseline = 'middle'; x.fillText(label, 0, 2);
    x.restore(); x.textBaseline = 'alphabetic';
  }
  x.fillStyle = P.faint; x.font = '600 26px ' + SANS;
  x.fillText('moments', 540, 1870);
  return new Promise((r) => { try { c.toBlob(r, 'image/jpeg', 0.9); } catch (e) { r(null); } });
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
  const [open, setOpen] = useState(null);
  const load = () => memoryBook().then((b) => { if (b && b.ok) setBook(b); });
  useEffect(() => { load(); }, []);
  // "Open your Moments Book" from Reflection: come back to it on Space
  useEffect(() => {
    const go = () => { try { const el = document.getElementById('moments-book'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} };
    try { window.addEventListener('mm-open-book', go); } catch (e) {}
    return () => { try { window.removeEventListener('mm-open-book', go); } catch (e) {} };
  }, []);
  const pages = (book && Array.isArray(book.pages)) ? book.pages : [];
  // kept photos are made light, a few at a time, once each
  useEffect(() => {
    if (!book || !user) return;
    const todo = [].concat(...pages.filter((pg) => pg.keep).map((pg) => pg.photos || [])).slice(0, 3);
    let alive = true;
    (async () => { for (const ph of todo) { if (!alive) return; await makeLight(ph, user.id); } })();
    return () => { alive = false; };
  }, [pages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!book) return null;

  const black = book.tier === 'VIP';
  const P = black ? OBSIDIAN : PAPER;
  const member = !!book.member;
  const full = (book.pins || 0) >= (book.limit || 5);
  const price = book.price || null;
  const patch = (day, f) => setBook({ ...book, ...f.book, pages: pages.map((x) => (x.day === day ? { ...x, ...f.page } : x)) });

  const keep = async (pg) => {
    tapLight(); setNote(null);
    if (!pg.keep && full) { setNote(mw(lang, 'full', { max: book.limit || 5 })); return; }
    const r = await keepPage(pg.day, !pg.keep);
    if (r && r.ok) {
      tapSuccess();
      patch(pg.day, { book: { pins: r.pins }, page: { keep: r.keep } });
      if (r.keep && user) (pg.photos || []).forEach((ph) => makeLight(ph, user.id));
    } else setNote(r && r.reason === 'full' ? mw(lang, 'full', { max: book.limit || 5 }) : mw(lang, 'err'));
  };
  const highlight = async (pg) => {
    tapLight(); setNote(null);
    const r = await highlightPage(pg.day, !pg.highlight);
    if (r && r.ok) patch(pg.day, { page: { highlight: r.highlight } }); else setNote(mw(lang, 'err'));
  };

  // a chapter a month, newest first
  const chapters = [];
  pages.forEach((pg) => {
    const d = dayOf(pg.day);
    const key = d.getFullYear() + '-' + d.getMonth();
    let ch = chapters.find((c) => c.key === key);
    if (!ch) { ch = { key, d, pages: [] }; chapters.push(ch); }
    ch.pages.push(pg);
  });
  const checksOf = (ch) => ch.pages.reduce((n, pg) => n + (pg.stamps || []).length, 0);
  const subOf = (ch) => {
    const n = ch.pages.length, c = checksOf(ch);
    return (n === 1 ? mw(lang, 'page1') : mw(lang, 'pageN', { n })) + (c ? '  ·  ' + (c === 1 ? mw(lang, 'checks1') : mw(lang, 'checksN', { n: c })) : '');
  };
  const recap = async (ch) => {
    if (Platform.OS !== 'web' || making) return;
    tapLight(); setMaking(ch.key); setNote(null);
    const now = Date.now();
    // the photos you can still see (never a blurred one), the ones with notes first
    const photos = [].concat(...ch.pages.map((pg) => (pg.photos || []).filter((ph) => pg.keep || member || !ph.expires_at || new Date(ph.expires_at).getTime() > now)))
      .sort((a, b) => ((b.notes || []).length - (a.notes || []).length));
    // the month's line: the fullest reflection that still reads as one thought
    const quotes = ch.pages.map((pg) => pg.reflection && pg.reflection.body).filter((q) => q && q.length <= 160);
    const quote = quotes.sort((a, b) => b.length - a.length)[0] || null;
    const c = checksOf(ch);
    const blob = await makeRecap({ lang, black, label: mw(lang, 'chapter', { m: monthName(lang, ch.d) }), sub: ch.pages.length === 1 ? mw(lang, 'page1') : mw(lang, 'pageN', { n: ch.pages.length }), photos, quote, checks: c ? (c === 1 ? mw(lang, 'checks1') : mw(lang, 'checksN', { n: c })) : null });
    const r = await shareRecap(blob, 'moments-' + monthName('en', ch.d).toLowerCase() + '.jpg');
    setMaking(null);
    if (r === 'saved') setNote(mw(lang, 'recapSaved')); else if (!r) setNote(mw(lang, 'err'));
  };
  // in the first week of a month, last month's chapter waits at the top, ready to share
  const today = new Date();
  const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const ready = today.getDate() <= 7 ? chapters.find((c) => c.key === last.getFullYear() + '-' + last.getMonth()) : null;

  return (
    <View nativeID="moments-book" testID="memory-book" style={{ marginHorizontal: 16, marginTop: 22, borderRadius: 24, backgroundColor: P.bg, borderWidth: 1, borderColor: P.line, padding: 16 }}>
      <Text style={{ color: P.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{mw(lang, 'kicker')}</Text>
      <Text style={{ color: P.ink, fontSize: 26, fontWeight: '600', marginTop: 6, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{mw(lang, 'title')}</Text>
      <Text style={{ color: P.dim, fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>
        {member ? mw(lang, 'subMember') : mw(lang, 'subFree', { n: book.pins || 0, max: book.limit || 5 })}
      </Text>
      {!member ? (
        <Pressable onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Text style={{ color: P.ink, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>{'✦ ' + (price ? mw(lang, 'lockPrice', { p: price, c: lang === 'ar' ? 'جنيه' : 'EGP' }) : mw(lang, 'lock'))}</Text>
        </Pressable>
      ) : null}
      {note ? <Text style={{ color: P.ink, fontSize: 13, marginTop: 10 }}>{note}</Text> : null}

      {ready && Platform.OS === 'web' ? (
        <Pressable testID="mb-recap-ready" onPress={() => recap(ready)} accessibilityRole="button" style={{ marginTop: 16 }}>
          <View style={{ borderRadius: 16, backgroundColor: P.btn, padding: 16 }}>
            <Text style={{ color: P.btnInk, fontSize: 17, fontWeight: '700', fontFamily: SERIF }}>{mw(lang, 'recapReady', { m: monthName(lang, ready.d) })}</Text>
            <Text style={{ color: P.btnInk, opacity: 0.75, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{mw(lang, 'recapReadySub')}</Text>
            <Text style={{ color: P.btnInk, fontSize: 13.5, fontWeight: '700', marginTop: 10 }}>{mw(lang, 'recap') + ' ✦'}</Text>
          </View>
        </Pressable>
      ) : null}

      {!pages.length ? <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, marginTop: 16 }}>{mw(lang, 'empty')}</Text> : null}

      {chapters.map((ch) => (
        <View key={ch.key} style={{ marginTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: P.line, paddingBottom: 8, marginBottom: 14 }}>
            <Text style={{ color: P.ink, fontSize: 18, fontWeight: '600', fontFamily: SERIF }}>{mw(lang, 'chapter', { m: monthName(lang, ch.d) })}</Text>
            <Text style={{ color: P.dim, fontSize: 13, marginHorizontal: 8 }}>{'•  ' + subOf(ch)}</Text>
          </View>
          {ch.pages.map((pg, i) => (
            <PageCard key={pg.day} pg={pg} lang={lang} P={P} black={black} member={member} full={full} price={price}
              tilt={i % 2 ? '0.5deg' : '-0.5deg'} onOpen={(x) => { tapLight(); setOpen(x); }} onKeep={keep} onHighlight={highlight} />
          ))}
          {Platform.OS === 'web' ? (
            <Pressable testID="mb-recap" onPress={() => recap(ch)} accessibilityRole="button" style={{ marginTop: 2 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: P.btn }}>
                {making === ch.key ? <ActivityIndicator color={P.btnInk} /> : <Text style={{ color: P.btnInk, fontSize: 14.5, fontWeight: '700' }}>{mw(lang, 'recap') + ' ✦'}</Text>}
              </View>
            </Pressable>
          ) : null}
        </View>
      ))}
      {open ? <OpenPage pg={open} lang={lang} P={P} onClose={() => setOpen(null)} /> : null}
    </View>
  );
};

/* ─── HIGHLIGHTS ON A PROFILE ── the pages someone chose to show */
export const MemoryHighlights = ({ items, onOpen }) => {
  const { lang } = useLang();
  if (!items || !items.length) return null;
  const P = PAPER;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: P.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4, marginBottom: 8 }}>{mw(lang, 'highlights').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {items.map((pg) => {
          const ph = (pg.photos || [])[0];
          return (
            <Pressable key={pg.day} onPress={() => onOpen && ph && onOpen(ph)} accessibilityRole="button" style={{ width: 150, marginEnd: 10 }}>
              <View style={{ backgroundColor: P.page, padding: 6, paddingBottom: 10, borderRadius: 6, borderWidth: 1, borderColor: P.line }}>
                {ph && picOf(ph) ? (
                  <Image source={{ uri: picOf(ph) }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 3, backgroundColor: P.line }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 3, backgroundColor: P.bg, padding: 10, justifyContent: 'center' }}>
                    <Text numberOfLines={6} style={{ color: P.ink, fontSize: 14, lineHeight: 20, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{pg.reflection ? '“' + pg.reflection.body + '”' : ''}</Text>
                  </View>
                )}
                {ph && pg.reflection ? <Text numberOfLines={2} style={{ color: P.ink, fontSize: 11.5, lineHeight: 15, marginTop: 6, fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{'“' + pg.reflection.body + '”'}</Text> : null}
                <Text numberOfLines={1} style={{ color: P.dim, fontSize: 9.5, fontWeight: '700', marginTop: 5, letterSpacing: lang === 'ar' ? 0 : 0.8 }}>{stampLine(lang, dayOf(pg.day), (ph && ph.place) || ((pg.stamps || [])[0] || {}).place)}</Text>
                {(pg.stamps || []).length ? <Text numberOfLines={1} style={{ color: P.stamp, fontSize: 10, fontWeight: '800', marginTop: 3 }}>{'✦ ' + mw(lang, 'checkedIn', { t: pg.stamps[0].title || pg.stamps[0].place || '' })}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};
