import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from '../../ui/Gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { publicMedia } from '../../lib/publicMedia';
import { planPhotoOf } from './PlanPhoto';
import { titleFor } from '../../lib/activityPins';
import { seatsLeftOf, seatLine } from '../../constants/joinWords';
import { lw } from '../../constants/loopWords';

/* ─── GREEN MINDS · THE CARDS ─────────────────────────────────────────
   Ayser: "محتاج يبقى في صور، وبسيط، ومشجع — وواضح: السبت من كذا لكذا
   تقدر تشارك في تطوع كذا". So every plan is a picture with one clear
   line under it — the day, from what time to what time, where — and
   one button. The picture is the plan's own when it has one; otherwise
   a picture of the kind of place it happens in (a river, a beach, a
   park, people volunteering), never presented as this plan's. */

/* Ayser, November 2026: "اللون الذهبي والكريمي" — Green Minds is gold on
   cream, like the invite card, and every picture is people volunteering */
export const GREEN = '#1F7A5A';   // kept for anything outside Green Minds that still imports it
export const gold = () => C.gold;
export const cream = () => (C.text === '#17131F' ? '#F6EFE3' : C.bg);

/* only people doing the work: boxes, sorting, handing out. A river or a
   forest on its own reads as a day out, not as volunteering. */
const VOL = ['act-volunteer-2.jpg', 'act-volunteer-1.jpg', 'act-volunteer-3.jpg'];
const KIDS = /school|orphan|kids|children|مدرسة|أيتام|أطفال/i;
/* the one clip of people volunteering (Pexels) */
export const greenClip = (text) => (KIDS.test(String(text || ''))
  ? { clip: publicMedia('reel-kids.mp4'), still: publicMedia('reel-kids.jpg') }
  : { clip: publicMedia('reel-volunteer.mp4'), still: publicMedia('reel-volunteer.jpg') });

const hash = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

export const greenPic = (text, id) => publicMedia(KIDS.test(String(text || '')) ? 'act-kids-2.jpg' : VOL[hash(id || text) % VOL.length]);

const fmt = (d, lang, o) => { try { return d.toLocaleString(lang === 'ar' ? 'ar-EG' : lang, o); } catch (e) { return ''; } };

/* "Saturday, 17 Oct · 9:00 – 10:00" — the whole answer to "when?" */
export const spanOf = (g, lang) => {
  const a = new Date(g.starts_at);
  if (Number.isNaN(a.getTime())) return '';
  const t = { hour: 'numeric', minute: '2-digit' };
  const day = fmt(a, lang, { weekday: 'long', day: 'numeric', month: 'short' });
  const from = fmt(a, lang, t);
  const mins = Number(g.minutes) || 0;
  const to = mins ? fmt(new Date(a.getTime() + mins * 60000), lang, t) : '';
  return day + ' · ' + (to ? from + ' – ' + to : from);
};

export const GreenHero = ({ title, line, top }) => (
  <View style={{ height: 210 + top, overflow: 'hidden' }}>
    <Image source={{ uri: publicMedia('act-volunteer-2.jpg') }} style={{ position: 'absolute', width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
    <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
    <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
      <Text style={{ color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 21, marginTop: 6, fontWeight: '600' }}>{line}</Text>
    </View>
  </View>
);

/* one plan: its picture, when, where, who is going, and Join */
export const PlanCard = ({ g, lang, t, mine, onJoin, onManage, onOpen, open, move, children }) => {
  const own = planPhotoOf(g);
  const text = [g.title, g.place_name, g.about].join(' ');
  const pic = own || greenPic(text, g.id);
  const clip = !own && move ? greenClip(text) : null;
  const n = Number(g.going) || 0;
  return (
    <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.goldSoft, marginBottom: 14 }}>
      <Pressable onPress={onOpen} accessibilityRole="button">
        <View style={{ height: 150 }}>
          {clip ? (
            <video src={clip.clip} poster={clip.still} autoPlay muted loop playsInline preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <Image source={{ uri: pic }} style={{ width: '100%', height: 150 }} accessibilityIgnoresInvertColors />
          )}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }} />
          {/* it says what it is before anything else: volunteering */}
          <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: cream(), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Ionicons name="hand-left-outline" size={13} color={C.gold} />
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: '900', marginStart: 5 }}>{lang === 'ar' ? 'تطوّع' : 'Volunteer'}</Text>
          </View>
          <Text numberOfLines={2} style={{ position: 'absolute', left: 14, right: 14, bottom: 10, color: '#FFF', fontSize: 19, fontWeight: '900' }}>{titleFor(g.title, lang)}</Text>
        </View>
      </Pressable>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={16} color={C.gold} />
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginStart: 7, flex: 1 }}>{spanOf(g, lang)}</Text>
        </View>
        {g.place_name || g.city ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="location-outline" size={16} color={C.gold} />
            <Text numberOfLines={1} style={{ color: C.dim, fontSize: 14, fontWeight: '600', marginStart: 7, flex: 1 }}>{[g.place_name, g.city].filter(Boolean).join(', ')}</Text>
          </View>
        ) : null}
        {open && g.about ? <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>{g.about}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ flex: 1, color: C.faint, fontSize: 13, fontWeight: '700' }}>
            {seatLine(lang, g)}
          </Text>
          {mine ? (
            <Pressable onPress={onManage} accessibilityRole="button" accessibilityLabel={t('green_manage')}
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={C.text} />
            </Pressable>
          ) : (
            <Pressable onPress={onJoin} accessibilityRole="button">
              <View style={{ backgroundColor: g.im_going ? 'transparent' : C.gold, borderWidth: g.im_going ? 1 : 0, borderColor: C.line, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 }}>
                <Text style={{ color: g.im_going ? C.text : '#FFF', fontSize: 14.5, fontWeight: '900' }}>{g.im_going ? '✓ ' + t('green_joined') : t('green_join')}</Text>
              </View>
            </Pressable>
          )}
        </View>
        {children}
      </View>
    </View>
  );
};

/* one idea: a line, how long, and Start — no picture, no emoji
   (Ayser, November 2026: "زحمة") */
export const IdeaCard = ({ s, title, about, t, onStart, first, lang }) => (
  <Pressable onPress={onStart} accessibilityRole="button">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>
          {[s.minutes ? s.minutes + (lang === 'ar' ? ' دقيقة' : ' min') : null, s.people ? s.people + (lang === 'ar' ? ' شخص' : ' people') : null].filter(Boolean).join(' · ') || about}
        </Text>
      </View>
      <Text style={{ color: C.gold, fontSize: 13, fontWeight: '900', marginStart: 10 }}>{t('green_start_one') + ' ›'}</Text>
    </View>
  </Pressable>
);
