import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { mw, until } from '../constants/memoryWords';
import { mv } from '../constants/mvpWords';
import { splitPrompt } from '../constants/loopWords';
import { memoryBook, keepPage, highlightPage, makeLight, isVideoUrl, addToPage, removeFromPage } from '../services/memory';
import { uploadMediaSmart, smallImage } from '../lib/storage';
import { fetchMyMoments } from '../services/posts';
import { lazyOverlay } from '../lib/lazyScreen';
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

const DrawSheet = lazyOverlay(() => import('./DrawSheet').then((m) => ({ default: m.DrawSheet })));
const WORDMARK = require('../assets/brand/wordmark.png');
const WORDMARK_WHITE = require('../assets/brand/wordmark-white.png');

const PAPER = { bg: '#FAF9F6', page: '#FFFFFF', ink: '#1A1A1A', dim: '#6B6B6B', faint: '#9A9A95', line: '#E8E6DF', btn: '#1A1A1A', btnInk: '#FFFFFF', stamp: '#B08D57', stampBg: '#F5EEDF' };
const VINTAGE = { paper: '#F5EFE6', edge: '#E7DDCC', ink: '#2A2118', dim: '#6E6152', faint: '#A0927F', frame: '#FFFDF8', gold: '#B08D57', crease: 'rgba(90,70,40,0.22)' };
const VINTAGE_NIGHT = { paper: '#17140F', edge: '#2A241B', ink: '#EFE6D6', dim: '#B5A78F', faint: '#7D705C', frame: '#211C15', gold: '#D9C08C', crease: 'rgba(0,0,0,0.55)' };
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
const cairoDay = () => { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); } catch (e) { return new Date().toISOString().slice(0, 10); } };
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
const PageCard = ({ pg, lang, P, black, member, full, price, total, tilt, onOpen, onKeep, onHighlight }) => {
  const d = dayOf(pg.day);
  const ph = (pg.photos || [])[0] || null;
  const now = Date.now();
  // past the five open pages (free): kept, never deleted, blurred until Moments+ (RUN_ME.sql memory_book)
  const locked = pg.open === false;
  const { title } = titleOf(ph);
  const refl = pg.reflection;
  const mom = pg.moment;
  const stamps = pg.stamps || [];
  const pk = pillarOf(((ph && ph.caption) || '') + ' ' + ((refl && refl.body) || '') + ' ' + stamps.map((s) => s.title).join(' '));
  const pill = PILLAR[pk];
  const mood = refl && refl.mood ? mw(lang, 'moods')[Math.max(0, Math.min(4, refl.mood - 1))] : null;
  const tags = tagsOf(ph && ph.caption);
  const status = null;
  const lockText = mw(lang, 'unlockAll', { n: total || 0, p: price || 129, c: lang === 'ar' ? 'جنيه' : 'EGP' });

  if (locked) {
    /* the whole page is there, blurred: the photo, and the words under frosted glass */
    return (
      <Pressable testID="mb-locked" onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ marginBottom: 20, transform: [{ rotate: tilt }] }}>
        <View style={{ borderRadius: 8, backgroundColor: P.page, padding: 12, borderWidth: 1, borderColor: P.line, overflow: 'hidden' }}>
          <Text style={{ color: P.dim, fontSize: 10.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{stampLine(lang, d, placeOf(pg))}</Text>
          <View style={[{ marginTop: 10 }, Platform.OS === 'web' ? { filter: 'blur(7px)' } : null]}>
            {ph && picOf(ph) ? <Image source={{ uri: picOf(ph) }} blurRadius={18} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 4, backgroundColor: P.line }} resizeMode="cover" /> : null}
            <Text numberOfLines={3} style={{ color: P.ink, fontSize: 17, lineHeight: 24, marginTop: 10, fontFamily: SERIF }}>{refl ? '“' + refl.body + '”' : title || ' '}</Text>
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: black ? 'rgba(0,0,0,0.35)' : 'rgba(250,249,246,0.35)' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
            </View>
            <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 }}>{'✦ ' + lockText}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

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

/* ─── A SPREAD OF THE VINTAGE BOOK ────────────────────────────────────
   Ayser, November 2026: aged cream paper with the edges of the pages
   stacked at the top; the day's photo in a printed frame on the upper
   half, a spine crease across the middle, and the words on the lower half
   in a book serif — the date and page number, the question, your answer,
   the table you checked into, and the notes your table left. A day with
   no photo gets a drawn landscape in the colours of its mood. Pages 6 and
   after, for free readers, are there under a gold lock. */
const MOOD_SKY = [['#C9C2B8', '#E9E1D3', '#8E8578'], ['#D8CDBB', '#EFE5D3', '#A69477'], ['#E8C9A0', '#F4E3C6', '#B98B57'], ['#F0B98A', '#F8DDBA', '#C77E4A'], ['#F2A97E', '#FBE0B5', '#D06E3E']];
const Landscape = ({ mood }) => {
  const c = MOOD_SKY[Math.max(0, Math.min(4, (mood || 3) - 1))];
  return (
    <View style={{ flex: 1, backgroundColor: c[1], overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', backgroundColor: c[0], opacity: 0.55 }} />
      <View style={{ position: 'absolute', top: '22%', alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF6E6', opacity: 0.9 }} />
      <View style={{ position: 'absolute', bottom: -60, left: -40, width: '80%', height: 150, borderRadius: 200, backgroundColor: c[2], opacity: 0.55 }} />
      <View style={{ position: 'absolute', bottom: -80, right: -50, width: '85%', height: 160, borderRadius: 200, backgroundColor: c[2], opacity: 0.8 }} />
      <View style={{ position: 'absolute', top: '16%', left: '22%', width: 14, height: 2, backgroundColor: c[2], transform: [{ rotate: '-18deg' }] }} />
      <View style={{ position: 'absolute', top: '16%', left: '24.5%', width: 14, height: 2, backgroundColor: c[2], transform: [{ rotate: '18deg' }] }} />
    </View>
  );
};
const isToday = (day) => { const d = dayOf(day), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
const Spread = ({ pg, n, lang, black, member, price, total, onOpen, onKeep, onHighlight, onAdd, onRemoveExtra, adding }) => {
  const V = black ? VINTAGE_NIGHT : VINTAGE;
  const d = dayOf(pg.day);
  const ph = (pg.photos || [])[0] || null;
  const extras = Array.isArray(pg.extras) ? pg.extras : [];
  // your own photo fills the frame when the day has no moment photo
  const ownPic = !picOf(ph) ? (extras.find((x) => x.kind === 'photo') || extras[0] || null) : null;
  const pic = picOf(ph) || (ownPic && ownPic.url);
  const rest = extras.filter((x) => x !== ownPic);
  const refl = pg.reflection;
  const mom = pg.moment;
  const stamps = pg.stamps || [];
  const notes = [].concat(...(pg.photos || []).map((x) => (Array.isArray(x.notes) ? x.notes : [])));
  const locked = pg.open === false;
  const mood = refl && refl.mood ? refl.mood : 3;
  const serif = { fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' };
  const lockText = '✦ ' + mw(lang, 'unlockShort', { p: price || 129, c: lang === 'ar' ? 'جنيه' : 'EGP' });
  const body = (
    <View style={{ flex: 1 }}>
      {/* the stacked edges of the pages underneath */}
      {[3, 2, 1].map((k) => (
        <View key={k} style={{ position: 'absolute', top: -k * 3, left: k * 5, right: k * 5, height: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: k % 2 ? V.edge : V.paper, borderWidth: 1, borderColor: V.edge }} />
      ))}
      <View style={[{ flex: 1, borderRadius: 6, backgroundColor: V.paper, borderWidth: 1, borderColor: V.edge, overflow: 'hidden' }, Platform.OS === 'web' ? { boxShadow: '0 10px 28px rgba(60,40,20,0.18)', backgroundImage: 'radial-gradient(120% 80% at 50% 50%, rgba(255,255,255,0.0) 60%, rgba(120,90,50,0.10) 100%)' } : null]}>
        {/* top half: the picture, in a printed frame */}
        <Pressable testID="mb-page" onPress={() => onOpen(pg)} accessibilityRole="button" accessibilityHint={mw(lang, 'flip')} style={{ flex: 1, padding: 16, paddingBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: V.frame, padding: 8, borderWidth: 1, borderColor: V.edge }}>
            <View style={{ flex: 1, borderWidth: 1, borderColor: V.faint, overflow: 'hidden' }}>
              {pic ? <Image source={{ uri: pic }} style={{ flex: 1 }} resizeMode="cover" /> : <Landscape mood={mood} />}
              {!pic && !locked && Platform.OS === 'web' ? (
                <Pressable testID="mb-add" onPress={() => onAdd(pg)} disabled={!!adding} accessibilityRole="button" accessibilityLabel={mw(lang, 'addTo')}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(42,33,24,0.78)', alignItems: 'center', justifyContent: 'center' }}>
                    {adding && adding.indexOf(pg.day) === 0 ? <ActivityIndicator color="#FFF6E6" /> : <Ionicons name="add" size={30} color="#FFF6E6" />}
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Pressable>
        {/* the spine crease */}
        <View style={{ height: 14, justifyContent: 'center' }}>
          <View style={[{ height: 14 }, Platform.OS === 'web' ? { backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, ' + V.crease + ' 50%, rgba(0,0,0,0) 100%)' } : { backgroundColor: V.crease, height: 2 }]} />
        </View>
        {/* bottom half: the words */}
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ flex: 1, color: V.dim, fontSize: 11, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{stampLine(lang, d, placeOf(pg))}</Text>
            <Text style={{ color: V.faint, fontSize: 12, fontFamily: SERIF }}>{'— ' + (lang === 'ar' ? AR(n) : n) + ' —'}</Text>
          </View>
          <ScrollView style={{ flex: 1, marginTop: 6 }} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {refl && refl.prompt ? <Text style={{ color: V.dim, fontSize: 13, lineHeight: 18 }}>{refl.prompt}</Text> : null}
            {refl ? <Text style={[{ color: V.ink, fontSize: 19, lineHeight: 27, marginTop: 4 }, serif]}>{'“' + refl.body + '”'}</Text>
              : ph && titleOf(ph).title ? <Text style={[{ color: V.ink, fontSize: 18, lineHeight: 26 }, serif]}>{titleOf(ph).title}</Text>
              : <Text style={[{ color: V.faint, fontSize: 16, lineHeight: 23 }, serif]}>{pg.blank ? mw(lang, 'drawTitle') : mw(lang, 'quietDay')}</Text>}
            {mom && (mom.body || mom.choice) ? (
              <Text style={{ color: V.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>
                <Text style={{ color: V.faint, fontWeight: '800', fontSize: 10, letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{mw(lang, 'moment') + '  '}</Text>
                {(lang === 'ar' && mom.q_ar ? mom.q_ar : mom.q || '') + ' — ' + (mom.body || (Array.isArray(mom.choice) ? mom.choice[lang === 'ar' ? 1 : 0] : ''))}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {stamps.map((st, i) => (
                <View key={i} style={{ marginTop: 8, marginEnd: 6, borderRadius: 4, borderWidth: 1.5, borderColor: V.gold, paddingHorizontal: 8, paddingVertical: 3, transform: [{ rotate: i % 2 ? '1.5deg' : '-1.5deg' }] }}>
                  <Text style={{ color: V.gold, fontSize: 11.5, fontWeight: '800' }}>{'✦ ' + (st.title || st.place || '')}</Text>
                </View>
              ))}
            </View>
            {notes.slice(0, 2).map((x, i) => (
              <Text key={i} style={[{ color: V.ink, fontSize: 13.5, lineHeight: 19, marginTop: 8 }, serif]}>{'“' + x.body + '” '}<Text style={{ color: V.dim, fontStyle: 'normal', fontSize: 11.5 }}>{'— ' + (x.buddy ? mw(lang, 'secretFriend') : (x.name || ''))}</Text></Text>
            ))}
            {/* your own photos and drawings, pinned to the page like prints */}
            {rest.length || ownPic ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {(ownPic ? [ownPic] : []).concat(rest).map((x, i) => (
                  <View key={x.id} testID="mb-extra" style={{ width: 58, height: 58, marginEnd: 8, marginBottom: 8, backgroundColor: V.frame, padding: 3, borderWidth: 1, borderColor: V.edge, transform: [{ rotate: i % 2 ? '2deg' : '-2deg' }] }}>
                    <Image source={{ uri: x.url }} style={{ flex: 1 }} resizeMode="cover" />
                    {!locked ? (
                      <Pressable onPress={() => onRemoveExtra(pg, x)} hitSlop={8} accessibilityRole="button" accessibilityLabel={mw(lang, 'remove')}
                        style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 9, backgroundColor: V.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={11} color={V.paper} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            {!locked && pic && Platform.OS === 'web' ? (
              <Pressable testID="mb-add-more" onPress={() => onAdd(pg)} disabled={!!adding} accessibilityRole="button" accessibilityLabel={mw(lang, 'addTo')} hitSlop={6} style={{ marginEnd: 6 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: V.edge, alignItems: 'center', justifyContent: 'center' }}>
                  {adding && adding.indexOf(pg.day) === 0 ? <ActivityIndicator size="small" color={V.ink} /> : <Ionicons name="add" size={17} color={V.ink} />}
                </View>
              </Pressable>
            ) : null}
            {pg.blank ? null : !member ? (
              <Pressable testID="mb-keep" onPress={() => onKeep(pg)} accessibilityRole="button" hitSlop={6}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: pg.keep ? V.ink : V.edge, backgroundColor: pg.keep ? V.ink : 'transparent', paddingHorizontal: 11, paddingVertical: 6 }}>
                  <Ionicons name={pg.keep ? 'bookmark' : 'bookmark-outline'} size={12} color={pg.keep ? V.paper : V.ink} />
                  <Text style={{ color: pg.keep ? V.paper : V.ink, fontSize: 12, fontWeight: '700', marginHorizontal: 5 }}>{pg.keep ? mw(lang, 'kept') : mw(lang, 'keep')}</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable testID="mb-highlight" onPress={() => onHighlight(pg)} accessibilityRole="switch" accessibilityState={{ checked: !!pg.highlight }} hitSlop={6}>
                <View style={{ borderRadius: 999, borderWidth: 1, borderColor: pg.highlight ? V.ink : V.edge, backgroundColor: pg.highlight ? V.ink : 'transparent', paddingHorizontal: 11, paddingVertical: 6 }}>
                  <Text style={{ color: pg.highlight ? V.paper : V.ink, fontSize: 12, fontWeight: '700' }}>{pg.highlight ? '✦ ' + mw(lang, 'highlighted') : mw(lang, 'highlight')}</Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
  if (!locked) return <View style={{ flex: 1, width: '100%', maxWidth: 460, paddingTop: 10 }}>{body}</View>;
  return (
    <Pressable testID="mb-locked" onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ flex: 1, width: '100%', maxWidth: 460, paddingTop: 10 }}>
      <View style={[{ flex: 1 }, Platform.OS === 'web' ? { filter: 'blur(8px)' } : { opacity: 0.35 }]} pointerEvents="none">{body}</View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ borderRadius: 14, backgroundColor: '#2A2118', borderWidth: 1.5, borderColor: '#D9C08C', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={18} color="#D9C08C" />
          <Text style={{ color: '#F5EFE6', fontSize: 14.5, fontWeight: '700', textAlign: 'center', lineHeight: 20, marginTop: 6 }}>{lockText}</Text>
        </View>
      </View>
    </Pressable>
  );
};

/* ─── ADD TO THIS PAGE ── Ayser, November 2026: "خليه هو يختار … يجيب
   صوره من البوستات". Your own posts first, as a grid — one tap pins one;
   then the phone's photos, or a drawing. Nothing else. */
const AddSheet = ({ lang, pg, userId, onClose, onPost, onPhone, onDraw }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!userId) { setPosts([]); return undefined; }
    fetchMyMoments(userId).then((rows) => {
      if (!alive) return;
      setPosts((rows || []).map((r) => ({ id: r.id, url: isVideoUrl(r.media_url) ? r.thumb_url : r.media_url })).filter((r) => r.url && String(r.url).indexOf('/' + userId + '/') > 0).slice(0, 30));
    }).catch(() => alive && setPosts([]));
    return () => { alive = false; };
  }, [userId]);
  const V = VINTAGE;
  const cell = { width: '31.5%', aspectRatio: 1, marginBottom: '2.75%', borderRadius: 6, overflow: 'hidden', backgroundColor: V.edge };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View testID="mb-add-sheet" style={{ backgroundColor: V.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: insets.bottom + 16, maxHeight: '80%' }}>
        <Text style={{ color: V.ink, fontSize: 20, fontWeight: '600', fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{mw(lang, 'addTo')}</Text>
        <Text style={{ color: V.dim, fontSize: 12.5, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 2 }}>{stampLine(lang, dayOf(pg.day))}</Text>
        <Text style={{ color: V.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 16, marginBottom: 8 }}>{mw(lang, 'fromPosts').toUpperCase()}</Text>
        <ScrollView style={{ maxHeight: 330 }} keyboardShouldPersistTaps="handled">
          {posts == null ? <ActivityIndicator color={V.ink} style={{ marginVertical: 20 }} />
            : !posts.length ? <Text style={{ color: V.dim, fontSize: 13.5, marginBottom: 8 }}>{mw(lang, 'noPosts')}</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {posts.map((x) => (
                  <Pressable key={x.id} testID="mb-post-pick" onPress={() => { tapLight(); onPost(x.url); }} accessibilityRole="button" style={cell}>
                    <Image source={{ uri: x.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </Pressable>
                ))}
                {posts.length % 3 ? Array.from({ length: 3 - (posts.length % 3) }).map((_, i) => <View key={'f' + i} style={{ width: '31.5%' }} />) : null}
              </View>
            )}
        </ScrollView>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {[['phone', 'image-outline', onPhone], ['draw', 'brush-outline', onDraw]].map(([k, icon, fn]) => (
            <Pressable key={k} testID={'mb-add-' + k} onPress={() => { tapLight(); fn(); }} accessibilityRole="button" style={{ flex: 1, marginEnd: k === 'phone' ? 10 : 0 }}>
              <View style={{ borderRadius: 999, borderWidth: 1, borderColor: V.ink, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={16} color={V.ink} />
                <Text style={{ color: V.ink, fontSize: 14, fontWeight: '700', marginStart: 6 }}>{mw(lang, k === 'phone' ? 'fromPhone' : 'draw')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
};

/* ─── SHARE ── one button on the book; two ways out */
const ShareSheet = ({ lang, P, member, total, price, month, onClose, onRecap, onPdf }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const row = (testID, icon, title, sub, fn) => (
    <Pressable testID={testID} onPress={() => { tapLight(); fn(); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.line }}>
      <Ionicons name={icon} size={22} color={P.ink} />
      <View style={{ flex: 1, marginStart: 12 }}>
        <Text style={{ color: P.ink, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: P.dim, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>
      </View>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View testID="mb-share-sheet" style={{ backgroundColor: P.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
        {row('mb-recap', 'image-outline', mw(lang, 'chapter', { m: month }), mw(lang, 'recapSub'), onRecap)}
        {row('mb-pdf', 'book-outline', member ? mw(lang, 'pdf') : mw(lang, 'pdfFree'), mw(lang, 'pdfSub'), onPdf)}
        {!member && total > 5 ? (
          <Pressable onPress={() => { tapLight(); onClose(); askUpgrade('member'); }} accessibilityRole="button" style={{ paddingTop: 14 }}>
            <Text style={{ color: P.ink, fontSize: 13.5, fontWeight: '700', textDecorationLine: 'underline' }}>{mw(lang, 'unlockAll', { n: total, p: price || 129, c: lang === 'ar' ? 'جنيه' : 'EGP' })}</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
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
/* ─── THE BOOK'S PAGES, ON PAPER (for the PDF) ─────────────────────── */
const PW = 1240, PH = 1754;   // A4 at 150 dpi
/* a picture another site will not let us read would spoil the whole file,
   so each one is tried on a scrap of canvas first */
const readable = (img) => { try { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1, 1); x.getImageData(0, 0, 1, 1); return true; } catch (e) { return false; } };
const safeImg = async (src) => { const im = await loadImg(src); return im && readable(im) ? im : null; };
const sheet = () => {
  const c = document.createElement('canvas'); c.width = PW; c.height = PH;
  const x = c.getContext('2d');
  x.fillStyle = VINTAGE.paper; x.fillRect(0, 0, PW, PH);
  x.strokeStyle = VINTAGE.edge; x.lineWidth = 3; x.strokeRect(40, 40, PW - 80, PH - 80);
  return [c, x];
};
async function pdfCover({ lang, name, first, last, n }) {
  const [c, x] = sheet();
  x.fillStyle = '#2A1F57'; x.fillRect(40, 40, PW - 80, PH - 80);
  x.strokeStyle = 'rgba(217,192,140,0.6)'; x.lineWidth = 3; x.strokeRect(90, 90, PW - 180, PH - 180);
  x.textAlign = 'center'; x.direction = lang === 'ar' ? 'rtl' : 'ltr';
  x.fillStyle = '#D9C08C'; x.font = 'italic 600 96px Georgia, "Times New Roman", serif';
  x.fillText(mw(lang, 'coverTitle'), PW / 2, 700);
  x.font = '700 34px ' + SANS; x.fillStyle = 'rgba(255,255,255,0.75)';
  if (name) x.fillText(name, PW / 2, 790);
  const span = first && last ? stampLine(lang, dayOf(first.day)) + '  —  ' + stampLine(lang, dayOf(last.day)) : '';
  if (span) x.fillText(span, PW / 2, 850);
  x.fillText(n === 1 ? mw(lang, 'page1') : mw(lang, 'pageN', { n }), PW / 2, 910);
  x.fillStyle = '#D9C08C'; x.font = '60px ' + SANS; x.fillText('✦', PW / 2, 1100);
  x.font = '700 30px ' + SANS; x.fillText('moments', PW / 2, PH - 140);
  return c;
}
async function pdfPage(pg, n, lang) {
  const [c, x] = sheet();
  const V = VINTAGE;
  x.direction = lang === 'ar' ? 'rtl' : 'ltr';
  const ar = lang === 'ar';
  const L = ar ? PW - 110 : 110;
  x.textAlign = ar ? 'right' : 'left';
  x.fillStyle = V.dim; x.font = '700 26px ' + SANS;
  x.fillText(stampLine(lang, dayOf(pg.day), placeOf(pg)), L, 120);
  const extras = Array.isArray(pg.extras) ? pg.extras : [];
  const ph = (pg.photos || [])[0];
  const mainSrc = picOf(ph) || (extras[0] && extras[0].url) || null;
  const rest = picOf(ph) ? extras : extras.slice(1);
  let y = 160;
  const main = mainSrc ? await safeImg(mainSrc) : null;
  if (main) {
    x.fillStyle = V.frame; x.fillRect(100, y, PW - 200, 820);
    x.strokeStyle = V.edge; x.lineWidth = 2; x.strokeRect(100, y, PW - 200, 820);
    cover(x, main, 120, y + 20, PW - 240, 780);
    y += 860;
  } else y += 20;
  const refl = pg.reflection;
  if (refl && refl.prompt) { x.fillStyle = V.dim; x.font = '30px ' + SANS; wrap(x, refl.prompt, PW - 220).slice(0, 2).forEach((l) => { y += 40; x.fillText(l, L, y); }); }
  const words = refl ? '“' + refl.body + '”' : ph && titleOf(ph).title ? titleOf(ph).title : null;
  if (words) {
    x.fillStyle = V.ink; x.font = (ar ? '' : 'italic ') + '44px Georgia, "Times New Roman", serif';
    wrap(x, words, PW - 220).slice(0, main ? 4 : 12).forEach((l) => { y += 58; x.fillText(l, L, y); });
  }
  const mom = pg.moment;
  if (mom && (mom.body || mom.choice)) {
    x.fillStyle = V.dim; x.font = '28px ' + SANS;
    const line = (ar && mom.q_ar ? mom.q_ar : mom.q || '') + ' — ' + (mom.body || (Array.isArray(mom.choice) ? mom.choice[ar ? 1 : 0] : ''));
    y += 20; wrap(x, line, PW - 220).slice(0, 3).forEach((l) => { y += 38; x.fillText(l, L, y); });
  }
  (pg.stamps || []).slice(0, 3).forEach((st) => {
    y += 56; x.fillStyle = V.gold; x.font = '800 28px ' + SANS; x.fillText('✦ ' + (st.title || st.place || ''), L, y);
  });
  const notes = [].concat(...(pg.photos || []).map((p) => (Array.isArray(p.notes) ? p.notes : []))).slice(0, 2);
  notes.forEach((nt) => {
    x.fillStyle = V.ink; x.font = (ar ? '' : 'italic ') + '30px Georgia, "Times New Roman", serif';
    y += 20; wrap(x, '“' + nt.body + '” — ' + (nt.buddy ? mw(lang, 'secretFriend') : (nt.name || '')), PW - 220).slice(0, 2).forEach((l) => { y += 40; x.fillText(l, L, y); });
  });
  // your own photos and drawings, as small prints along the bottom
  const thumbs = (await Promise.all(rest.slice(0, 4).map((e) => safeImg(e.url)))).filter(Boolean);
  if (thumbs.length) {
    const s = 230, gap = 30, top = Math.max(y + 40, PH - 140 - s);
    if (top + s < PH - 100) thumbs.forEach((im, i) => {
      const left = 110 + i * (s + gap);
      x.save(); x.translate(left + s / 2, top + s / 2); x.rotate(i % 2 ? 0.03 : -0.03);
      x.fillStyle = V.frame; x.fillRect(-s / 2, -s / 2, s, s); x.strokeStyle = V.edge; x.lineWidth = 2; x.strokeRect(-s / 2, -s / 2, s, s);
      cover(x, im, -s / 2 + 10, -s / 2 + 10, s - 20, s - 20); x.restore();
    });
  }
  x.textAlign = 'center'; x.fillStyle = V.faint; x.font = '28px Georgia, "Times New Roman", serif';
  x.fillText('— ' + (ar ? AR(n) : n) + ' —', PW / 2, PH - 70);
  return c;
}
async function pdfEnd(lang, n) {
  const [c, x] = sheet();
  x.textAlign = 'center'; x.direction = lang === 'ar' ? 'rtl' : 'ltr';
  x.fillStyle = VINTAGE.gold; x.font = '60px ' + SANS; x.fillText('✦', PW / 2, 760);
  x.fillStyle = VINTAGE.ink; x.font = (lang === 'ar' ? '' : 'italic ') + '50px Georgia, "Times New Roman", serif';
  wrap(x, mw(lang, 'pdfMore', { n }), PW - 300).forEach((l, i) => x.fillText(l, PW / 2, 860 + i * 66));
  x.fillStyle = VINTAGE.faint; x.font = '700 30px ' + SANS; x.fillText('moments', PW / 2, PH - 140);
  return c;
}

async function shareRecap(blob, name) {
  if (!blob) return false;
  const file = new File([blob], name, { type: 'image/jpeg' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; } } catch (e) { if (e && e.name === 'AbortError') return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return 'saved';
}

/* ─── THE BOOK ─────────────────────────────────────────────────────── */
export const MemoryBook = ({ initial = null, bare = false }) => {
  const { lang } = useLang();
  const { user } = useAuth() || {};
  const [book, setBook] = useState(initial);
  const [note, setNote] = useState(null);
  const [making, setMaking] = useState(null);
  const [open, setOpen] = useState(null);
  const [idx, setIdx] = useState(0);
  const [size, setSize] = useState(null);         // the spread fills the reader: one day per screen, vertical
  const w = size ? size.w : 0;
  const pager = useRef(null);
  const load = () => memoryBook().then((b) => { if (b && b.ok) setBook(b); });
  useEffect(() => { load(); }, []);
  const todayKey = cairoDay();
  const got = (book && Array.isArray(book.pages)) ? book.pages : [];
  // today is always a page you can draw or put a photo on, even before anything happened
  const pages = book && !got.some((pg) => pg.day === todayKey) ? [{ day: todayKey, open: true, photos: [], extras: [], stamps: [], blank: true }].concat(got) : got;
  const [adding, setAdding] = useState(null);     // day+kind being added
  const [drawFor, setDrawFor] = useState(null);   // the page you are drawing on
  const [pdfBusy, setPdfBusy] = useState(false);
  const [addFor, setAddFor] = useState(null);      // the page the "+" was pressed on
  const [shareOpen, setShareOpen] = useState(false);
  // a photo you already posted: it is yours and already stored, so it is pinned as it is
  const pinUrl = async (pg, url) => {
    setAdding(pg.day + 'photo'); setNote(null);
    const r = await addToPage(pg.day, 'photo', url);
    if (r && r.ok) { tapSuccess(); await load(); }
    else setNote(r && r.reason === 'full' ? mw(lang, 'extrasFull') : r && r.reason === 'locked' ? mw(lang, 'lockedAdd') : mw(lang, 'err'));
    setAdding(null);
  };
  const pin = async (pg, kind, blob, ext, type) => {
    if (!user) return;
    setAdding(pg.day + kind); setNote(null);
    try {
      const url = await uploadMediaSmart(user.id, blob, ext, type);
      const r = await addToPage(pg.day, kind, url);
      if (r && r.ok) { tapSuccess(); await load(); }
      else setNote(r && r.reason === 'full' ? mw(lang, 'extrasFull') : r && r.reason === 'locked' ? mw(lang, 'lockedAdd') : mw(lang, 'err'));
    } catch (e) { setNote(mw(lang, 'err')); }
    setAdding(null);
  };
  const addPhoto = (pg) => {
    if (Platform.OS !== 'web' || adding) return;
    tapLight();
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const local = URL.createObjectURL(f);
      try { const sm = await smallImage(local, 1080, 0.72); await pin(pg, 'photo', sm.uri, sm.ext || 'jpg', sm.type || 'image/jpeg'); }
      finally { URL.revokeObjectURL(local); }
    };
    inp.click();
  };
  const removeExtra = async (pg, x) => {
    tapLight();
    const r = await removeFromPage(x.id);
    if (r && r.ok) load(); else setNote(mw(lang, 'err'));
  };
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
  /* the whole book as a PDF — Ayser: "PDF كامل … كأنه بوك". Members get every
     page; everybody else the five open ones, and a last page saying how many wait */
  const makePdf = async () => {
    if (Platform.OS !== 'web' || pdfBusy) return;
    tapLight(); setPdfBusy(true); setNote(null);
    try {
      const { buildPdf, canvasJpeg, savePdf } = await import('../lib/bookPdf');
      const open = got.filter((pg) => pg.open !== false).slice().reverse();     // oldest first, like a book
      const shut = got.length - open.length;
      const out = [];
      out.push(await canvasJpeg(await pdfCover({ lang, name: (user && user.user_metadata && user.user_metadata.name) || '', first: open[0], last: open[open.length - 1], n: open.length })));
      for (let i = 0; i < open.length; i++) out.push(await canvasJpeg(await pdfPage(open[i], i + 1, lang)));
      if (!member && shut > 0) out.push(await canvasJpeg(await pdfEnd(lang, shut)));
      const blob = buildPdf(out.filter(Boolean), { title: 'The Moments Book' });
      const r = await savePdf(blob, 'moments-book.pdf');
      if (r === 'saved') setNote(mw(lang, 'pdfSaved'));
    } catch (e) { setNote(mw(lang, 'err')); }
    setPdfBusy(false);
  };
  // in the first week of a month, last month's chapter waits at the top, ready to share
  const today = new Date();
  const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const ready = today.getDate() <= 7 ? chapters.find((c) => c.key === last.getFullYear() + '-' + last.getMonth()) : null;

  /* ─── THE READER ── Ayser, November 2026: "swipe horizontally (left/
     right page-by-page)". One day a page, a page a screen; Keep this page
     and Share Monthly Recap are on the page you are reading. Free readers
     read five pages; the rest are there, blurred, behind Moments+. */
  const cur = pages[Math.min(idx, Math.max(0, pages.length - 1))] || null;
  const curCh = cur ? chapters.find((c) => c.pages.includes(cur)) : null;
  const go = (i) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    tapLight(); setIdx(n);
    try { pager.current && size && pager.current.scrollTo({ y: n * size.h, animated: true }); } catch (e) {}
  };
  const onScroll = (e) => { if (!size) return; const n = Math.round(e.nativeEvent.contentOffset.y / size.h); if (n !== idx) setIdx(n); };
  // in the first week of a month the recap is last month's; otherwise the chapter you are reading
  const recapCh = ready || curCh;

  return (
    <View nativeID="moments-book" testID="memory-book" style={{ flex: 1, backgroundColor: black ? '#0B0B0B' : '#EDE5D8' }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Text style={{ color: P.faint, fontSize: 11, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{mw(lang, 'kicker')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
          <Text style={{ color: P.ink, fontSize: 22, fontWeight: '600', fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{curCh ? mw(lang, 'chapter', { m: monthName(lang, curCh.d) }) : mw(lang, 'title')}</Text>
          {pages.length ? <Text testID="mb-pageno" style={{ color: P.dim, fontSize: 13, marginHorizontal: 8 }}>{mw(lang, 'pageOf', { i: idx + 1, n: pages.length })}</Text> : null}
        </View>
        {note ? <Text style={{ color: P.ink, fontSize: 13, marginTop: 8 }}>{note}</Text> : null}
      </View>

      {!pages.length ? <Text style={{ color: P.dim, fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginTop: 16 }}>{mw(lang, 'empty')}</Text> : (
        <View style={{ flex: 1 }} onLayout={(e) => { const l = e.nativeEvent.layout; setSize({ w: l.width, h: l.height }); }}>
          {size ? (
            /* Ayser, November 2026: a vintage open book, read top to bottom — one spread per day, snapping */
            <ScrollView ref={pager} testID="mb-pager" pagingEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              onScroll={onScroll} scrollEventThrottle={32} style={{ flex: 1 }}>
              {pages.map((pg, i) => (
                <View key={pg.day} style={{ width: size.w, height: size.h, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10, alignItems: 'center' }}>
                  <Spread pg={pg} n={i + 1} lang={lang} black={black} member={member} price={price} total={book.total}
                    onOpen={(x) => { tapLight(); setOpen(x); }} onKeep={keep} onHighlight={highlight}
                    onAdd={(x) => { tapLight(); setAddFor(x); }} onRemoveExtra={removeExtra} adding={adding} />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}


      {pages.length ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: P.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Pressable testID="mb-prev" disabled={idx === 0} onPress={() => go(idx - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="↑" style={{ opacity: idx === 0 ? 0.3 : 1, padding: 4 }}>
              <Ionicons name="chevron-up" size={20} color={P.ink} />
            </Pressable>
            <Text style={{ color: P.dim, fontSize: 12.5, fontWeight: '700', marginHorizontal: 12, fontFamily: SERIF }}>{mw(lang, 'pageOf', { i: idx + 1, n: pages.length })}</Text>
            <Pressable testID="mb-next" disabled={idx >= pages.length - 1} onPress={() => go(idx + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="↓" style={{ opacity: idx >= pages.length - 1 ? 0.3 : 1, padding: 4 }}>
              <Ionicons name="chevron-down" size={20} color={P.ink} />
            </Pressable>
          </View>
          {Platform.OS === 'web' ? (
            <Pressable testID="mb-share" onPress={() => { tapLight(); setShareOpen(true); }} accessibilityRole="button" style={{ marginTop: 8 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: P.btn }}>
                {pdfBusy || making ? <ActivityIndicator color={P.btnInk} /> : <Ionicons name="share-outline" size={17} color={P.btnInk} />}
                <Text style={{ color: P.btnInk, fontSize: 15, fontWeight: '700', marginStart: 8 }}>{pdfBusy ? mw(lang, 'pdfMaking') : mw(lang, 'share')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {open ? <OpenPage pg={open} lang={lang} P={P} onClose={() => setOpen(null)} /> : null}
      {addFor ? (
        <AddSheet lang={lang} pg={addFor} userId={user && user.id}
          onClose={() => setAddFor(null)}
          onPost={(url) => { const pg = addFor; setAddFor(null); pinUrl(pg, url); }}
          onPhone={() => { const pg = addFor; setAddFor(null); addPhoto(pg); }}
          onDraw={() => { const pg = addFor; setAddFor(null); setDrawFor(pg); }} />
      ) : null}
      {shareOpen ? (
        <ShareSheet lang={lang} P={P} member={member} total={book.total || 0} price={price} month={recapCh ? monthName(lang, recapCh.d) : ''}
          onClose={() => setShareOpen(false)}
          onRecap={() => { setShareOpen(false); if (recapCh) recap(recapCh); }}
          onPdf={() => { setShareOpen(false); makePdf(); }} />
      ) : null}
      {drawFor ? <DrawSheet lang={lang} onClose={() => setDrawFor(null)} onDone={async ({ blob, ext, type }) => { const pg = drawFor; setDrawFor(null); await pin(pg, 'drawing', blob, ext, type); }} /> : null}
    </View>
  );
};

/* ─── THE CLOSED BOOK ON SPACE ────────────────────────────────────────
   Ayser, October 2026: Space shows the book closed — a hardcover with
   its title in foil — and it opens, full-screen, on a tap. */
export const MomentsBookCover = () => {
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState(null);
  const [open, setOpen] = useState(false);
  const load = () => memoryBook().then((b) => { if (b && b.ok) setBook(b); });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const go = () => setOpen(true);
    const shut = () => setOpen(false);   // the camera opened from today's page
    try { window.addEventListener('mm-open-book', go); window.addEventListener('mm-open-capture', shut); } catch (e) {}
    return () => { try { window.removeEventListener('mm-open-book', go); window.removeEventListener('mm-open-capture', shut); } catch (e) {} };
  }, []);
  const black = book && book.tier === 'VIP';
  const P = black ? OBSIDIAN : PAPER;
  const n = (book && book.total) || 0;
  const pgs = (book && Array.isArray(book.pages)) ? book.pages : [];
  // the chapter on the cover: the newest month with a page, or this month
  const latest = pgs.length ? pgs.map((pg) => dayOf(pg.day)).sort((x, y) => y - x)[0] : new Date();
  const badge = mw(lang, 'chapter', { m: monthName(lang, latest) }) + '  •  ' + (n === 1 ? mw(lang, 'page1') : mw(lang, 'pageN', { n }));
  const cloth = black ? '#141414' : '#2A1F57';
  const foil = '#D9C08C';
  /* linen: a fine woven grain over the cloth, drawn by the browser */
  const linen = Platform.OS === 'web' ? { backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 3px)' } : null;
  const close = () => { tapLight(); setOpen(false); load(); };
  return (
    <>
      {/* Ayser, November 2026: a closed hardcover, about 130 high — never the pages themselves on Space */}
      <Pressable testID="book-cover" onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" accessibilityLabel={mw(lang, 'coverTitle')} style={{ marginHorizontal: 16, marginTop: 22 }}>
        {({ pressed }) => (
          <View style={[{ flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: cloth, height: 130, transform: [{ scale: pressed ? 0.985 : 1 }], direction: 'ltr' }, linen]}>
            {/* the spine, on the left */}
            <View style={{ width: 16, backgroundColor: 'rgba(0,0,0,0.38)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.10)' }}>
              <View style={{ position: 'absolute', top: 14, left: 3, right: 3, height: 1, backgroundColor: 'rgba(217,192,140,0.5)' }} />
              <View style={{ position: 'absolute', bottom: 14, left: 3, right: 3, height: 1, backgroundColor: 'rgba(217,192,140,0.5)' }} />
            </View>
            <View style={{ flex: 1, margin: 10, borderWidth: 1, borderColor: 'rgba(217,192,140,0.40)', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: foil, fontSize: 19, fontWeight: '600', fontFamily: SERIF, fontStyle: lang === 'ar' ? 'normal' : 'italic' }}>{mw(lang, 'coverTitle')}</Text>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12.5, marginTop: 2 }}>{'(' + mw(lang, 'title') + ')'}</Text>
                </View>
                <Text style={{ color: foil, fontSize: 16, marginStart: 8 }}>✦</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ borderRadius: 999, borderWidth: 1, borderColor: 'rgba(217,192,140,0.55)', paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 }}>
                  <Text testID="book-badge" numberOfLines={1} style={{ color: foil, fontSize: 10.5, fontWeight: '700' }}>{badge}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginStart: 8, flexShrink: 1 }}>{mw(lang, 'tapOpen')}</Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
      {open ? (
        <Modal visible animationType="slide" onRequestClose={close}>
          <View style={{ flex: 1, backgroundColor: black ? '#0B0B0B' : '#EDE5D8', paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row' }}>
              <Pressable testID="book-close" onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={mw(lang, 'close')}>
                <Ionicons name="close" size={26} color={P.ink} />
              </Pressable>
            </View>
            <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}><MemoryBook initial={book} bare /></View>
          </View>
        </Modal>
      ) : null}
    </>
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
