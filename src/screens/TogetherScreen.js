import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, TextInput, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { publicMedia } from '../lib/publicMedia';
import { moodOfToday } from '../lib/mood';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { listGatherings, joinGathering, announceGathering, checkInAt, setGatheringPhoto, removeGatheringPhoto, topCreators, followCreator, keptGatherings, myUnrated, rateGathering, listSparks, greenImpact } from '../services/green';
import { COUNTRY_LIST } from '../constants/countries';
import { remember, recall } from '../lib/offline';
import { uploadPlanPhoto } from '../lib/storage';
import { canCheckIn } from '../lib/xp';
import { getCurrentCoords } from '../utils/location';
import { pushSupport, wasAsked } from '../lib/push';
import { PushRow } from '../components/PushRow';
import { PeopleNearby } from '../components/PeopleNearby';
import { talkRoomsNear } from '../services/talkRooms';
import { fmt, remaining, offsetFrom } from '../lib/talkClock';
import { appLink, shareLink, shareNote } from '../utils/share';
import { listOffers, photoUrl } from '../services/offers';
import { fetchWhatsOn } from '../services/whatson';
import { joinCampfire } from '../services/campfires';
import { joinGroup } from '../services/groups';
import { getProfile } from '../services/profiles';
import { isEuCode } from '../lib/eu';
import { lookOf, titleFor } from '../lib/activityPins';
import { activityOf } from '../lib/activityMatch';
import { lastFix } from '../services/squadAdmin';
import { flagToIso, groupByDay } from '../lib/together';
import { showOnMap, goToTab } from '../lib/mapBus';
import { openChat } from '../lib/chatBus';
import { lazyOverlay, preloadTabs } from '../lib/lazyScreen';
import { isSaving, DEFAULT_DATA_MODE } from '../lib/dataSaver';
import { getPrefs } from '../services/prefs';
import { openPartner } from '../lib/partnerLink';
import { HostBadge } from '../components/HostCard';
import { PlanHead, PastPhotos, ideaPhoto, ideaPics, ideaClip } from '../components/green/PlanPhoto';
import { greenPic } from '../components/green/GreenCards';
import { isGreen } from '../lib/greenKinds';
import { ReportSheet } from '../components/ReportSheet';
import { CirclesNear } from '../components/CirclesNear';
const BizDirectory = lazyOverlay(() => import('../components/biz').then((m) => ({ default: m.BizDirectory })));
const TripsSheet = lazyOverlay(() => import('../components/TripsSheet').then((m) => ({ default: m.TripsSheet })));
const ExploreSheet = lazyOverlay(() => import('../components/ExploreSheet').then((m) => ({ default: m.ExploreSheet })));
const CountrySheet = lazyOverlay(() => import('../components/CountrySheet').then((m) => ({ default: m.CountrySheet })));
const SettleSheet = lazyOverlay(() => import('../components/SettleSheet').then((m) => ({ default: m.SettleSheet })));
const RewardsSheet = lazyOverlay(() => import('../components/RewardsSheet').then((m) => ({ default: m.RewardsSheet })));
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

const GreenSheet = lazyOverlay(() => import('../components/green/GreenSheet').then((m) => ({ default: m.GreenSheet })));
const ProgrammesSheet = lazyOverlay(() => import('../components/green/ProgrammesSheet').then((m) => ({ default: m.ProgrammesSheet })));
const LandingSheet = lazyOverlay(() => import('../components/LandingSheet').then((m) => ({ default: m.LandingSheet })));
const GoNowSheet = lazyOverlay(() => import('../components/GoNowSheet').then((m) => ({ default: m.GoNowSheet })));
const GroupPage = lazyOverlay(() => import('../components/GroupPage').then((m) => ({ default: m.GroupPage })));
const CapsuleSheet = lazyOverlay(() => import('../components/CapsuleSheet').then((m) => ({ default: m.CapsuleSheet })));
const TalkRoomSheet = lazyOverlay(() => import('../components/TalkRoom').then((m) => ({ default: m.TalkRoomSheet })));
const StartTalkSheet = lazyOverlay(() => import('../components/TalkRoom').then((m) => ({ default: m.StartTalkSheet })));

/* ─── TOGETHER · THE WEEK, NEAR YOU ───────────────────────────────────
   Ayser: "all the people, not just new people — make community".

   This is what Moments is for, so it has the tab that used to belong to
   Reels and to Chill. Six tabs were one more than a phone's bar is
   meant to hold, and neither of those two was the thing anybody would
   describe Moments by. They are not gone: both open from the bottom of
   this screen.

   Top to bottom, in the order a person asks:
     · what is on this week, day by day, each with a Join button;
     · what is happening right now (live campfires);
     · plans people posted with a time on them;
     · groups to be part of;
     · and the rooms around it — exchanges, first 30 days, the care
       code, playing together, watching.

   Every number is a count of real rows and every card a real thing
   somebody made. A quiet week shows as a quiet week, with the button to
   be the one who starts something. */

/* ─── HOW IT GOES ─────────────────────────────────────────────────────
   Ayser: "لو دخلت عليها ألاقي شرح للبروجرام". Opening a plan said one
   line at best. Somebody new to a city wants to know what they are
   walking into: when to arrive, what happens, when it ends, whether
   they can leave quietly. Four steps a plan, by what kind of plan it
   is, with the real clock times worked out from when it starts and how
   long it runs. The host's own words (`about`) still come first. */
const PROGRAM = { walk: 'walk', run: 'walk', cleanup: 'walk', circle: 'circle', sport: 'sport', art: 'art', culture: 'culture', movie: 'culture', eat: 'circle' };
const PlanProgram = ({ g, t, hour }) => {
  const key = PROGRAM[g.kind] || 'any';
  const start = new Date(g.starts_at).getTime();
  if (!start) return null;
  const mins = Number(g.minutes) || 90;
  const at = key === 'culture' ? [0, 20, 30, mins] : [0, 10, Math.round(mins / 2), mins];
  return (
    <View style={{ marginTop: 12, backgroundColor: C.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>{t('pg_title').toUpperCase()}</Text>
      {at.map((m, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: i ? 7 : 0 }}>
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', width: 74 }}>{hour(new Date(start + m * 60000).toISOString())}</Text>
          <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19, flex: 1 }}>{t('pg_' + key + '_' + (i + 1))}</Text>
        </View>
      ))}
    </View>
  );
};

const Pill = ({ on, label, onPress }) => (
  <Pressable onPress={onPress} style={{ marginEnd: 8 }}>
    <View style={{
      backgroundColor: on ? C.text : C.glass, borderWidth: 1, borderColor: on ? C.text : C.line,
      borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    }}>
      <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

const Section = ({ children }) => (
  <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 22, marginBottom: 10 }}>
    {children}
  </Text>
);

/* the rooms around the week, each in its own colour */
/* four doors, one shape: a line icon and a word — the same for all */
const Tile = ({ icon, label, onPress }) => (
  <Pressable onPress={() => { tapLight(); onPress(); }} style={{ width: '48.5%', marginBottom: 10 }} accessibilityRole="button" accessibilityLabel={label}>
    <View style={{ borderRadius: 20, padding: 16, minHeight: 96, justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <Ionicons name={icon} size={22} color={C.text} />
      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', marginTop: 14 }} numberOfLines={1}>{label}</Text>
    </View>
  </Pressable>
);

/* ── GREEN MINDS, ONE DOOR ──
   Ayser: it showed up in several places and nobody could see it does
   any good. Now it is here only, as the one wide card, with what it has
   really done this month (green_impact): gatherings people checked in
   at, the people, the countries, and how many times you came. Nothing
   counted yet → the card says so plainly and asks you to start one. */
const GreenDoor = ({ t, onPress }) => {
  const [n, setN] = useState(null);
  useEffect(() => { greenImpact().then((r) => { if (r && typeof r.held === 'number') setN(r); }); }, []);
  const stat = (v, k) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900' }}>{String(v)}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700', marginTop: 1, textAlign: 'center' }} numberOfLines={1}>{t(k)}</Text>
    </View>
  );
  return (
    <Pressable onPress={() => { tapLight(); onPress(); }} accessibilityRole="button" style={{ marginBottom: 10 }}>
      <LinearGradient colors={['#047857', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 24 }}>🌿</Text>
          <View style={{ flex: 1, marginStart: 10 }}>
            <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '900' }}>{t('green_title')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>{t('gm_hero')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFF" />
        </View>
        {n && n.held > 0 ? (
          <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' }}>
            {stat(n.held, 'gi_held')}{stat(n.people, 'gi_people')}{stat(n.countries, 'gi_countries')}{n.mine > 0 ? stat(n.mine, 'gi_mine') : null}
          </View>
        ) : n ? (
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginTop: 12 }}>{t('gi_none')}</Text>
        ) : null}
        {n && n.held > 0 ? <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 8 }}>{t('gi_note')}</Text> : null}
      </LinearGradient>
    </Pressable>
  );
};

const JoinPill = ({ going, busy, onPress, t }) => (
  <Pressable onPress={onPress} disabled={busy} hitSlop={6} accessibilityRole="button">
    {going ? (
      <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.glassHi, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="checkmark" size={14} color={C.green} />
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', marginStart: 4 }}>{t('green_joined')}</Text>
      </View>
    ) : (
      <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.purple, opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('green_join')}</Text>
      </View>
    )}
  </Pressable>
);

/* Your country, remembered on this phone: the list is asked for your
   country from the first moment, instead of "everywhere" first and then
   swapped for your country once the profile arrives. */
const CODE_KEY = 'moments.myCode';
const readCode = () => { try { return localStorage.getItem(CODE_KEY) || null; } catch (e) { return null; } };

/* ── HOW WAS IT? ── the one hangout you checked in to and have not rated:
   five stars and a line, sent once (green_rate). The ratings are what
   make an organiser verified later. */
/* ─── PLANS AROUND YOU, IDEAS FROM EVERYWHERE ─────────────────────────
   Ayser: "احنا بنرسم في مصر على النيل — اعمل رسم على نهر بودابست بردو
   بس جروب مختلف… على حسب إنت فاتح مومنتس فين". Plans are shown by where
   the phone is (the last place the map found you): within NEAR_KM, or,
   with no fix yet, in your country. Everything further away is not
   joinable from here — it comes back as an idea to start where you
   are, which makes a new plan with its own local group. */
const NEAR_KM = 80;
const kmBetween = (a, b) => {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const isNear = (g, fix, code) => (fix && g.lat != null && g.lng != null
  ? kmBetween(fix, { lat: Number(g.lat), lng: Number(g.lng) }) <= NEAR_KM
  : !!code && g.country === code);
/* the idea without its old place: "Sketching on the Nile" → "Sketching",
   so the new group names its own river */
const ideaTitle = (title) => {
  const s = String(title || '').trim();
  const cut = s.replace(/\s+(on|at|in|by|near|along)\s+(the\s+)?[^·|,]+$/i, '').replace(/\s+(على|في|عند|جنب)\s+[^·|,]+$/, '').trim();
  return cut.length >= 3 ? cut : s;
};
const ideaKey = (g) => ((activityOf(String(g.title || '') + ' ' + String(g.kind || '')) || {}).id) || 'k:' + String(g.kind || '') + ':' + String(g.title || '').toLowerCase();

const Workshops = ({ t, lang, onOpen }) => {
  const [list, setList] = useState(null);
  useEffect(() => { let alive = true; listOffers(null, null).then((r) => { if (alive) setList((r || []).filter((o) => o.track === 'workshop')); }).catch(() => {}); return () => { alive = false; }; }, []);
  if (!list || !list.length) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 10 }}>{t('bk_kind_workshop')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {list.map((o) => (
          <Pressable key={o.id} onPress={() => { tapLight(); onOpen(o); }} accessibilityRole="button" style={{ width: 210, marginEnd: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            {o.photos && o.photos[0] ? <Image source={{ uri: photoUrl(o.photos[0]) }} style={{ width: '100%', height: 110, backgroundColor: C.glassHi }} /> : <View style={{ height: 110, backgroundColor: C.purpleSoft }} />}
            <View style={{ padding: 12 }}>
              <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }} numberOfLines={2}>{lang === 'ar' && o.title_ar ? o.title_ar : o.title}</Text>
              <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{'📍 ' + (o.city || '') + (o.status === 'soon' ? ' · ' + t('bk_soon') : '')}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const IdeasElsewhere = ({ ideas, t, lang, onStart }) => {
  if (!ideas.length) return null;
  const moving = Platform.OS === 'web' && !isSaving((getPrefs() || {}).dataSaver || DEFAULT_DATA_MODE);
  /* never the same clip or the same photo twice on the rail */
  const seenClip = new Set(); const clipIds = [];
  ideas.forEach((g) => { const c = ideaClip(g); if (c && clipIds.length < 2 && !seenClip.has(g.kind)) { seenClip.add(g.kind); clipIds.push(g.id); } });
  const usedPic = new Set();
  const picFor = (g) => {
    const p = ideaPics(g).find((u) => !usedPic.has(u)) || ideaPhoto(g);
    if (p) usedPic.add(p);
    return p;
  };
  return (
    <View style={{ marginTop: 6, marginBottom: 16 }}>
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{'🌍 ' + t('id_title')}</Text>
      <Text style={{ color: C.dim, fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 10 }}>{t(ideas.every((g) => String(g.id).startsWith('sp_')) ? 'id_sub_starter' : 'id_sub')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {ideas.map((g) => {
          const look = lookOf(g.kind);
          const pic = picFor(g) || (isGreen(g) ? greenPic([g.title, g.about].join(' '), g.id) : null);
          /* the first two cards with a clip of their activity move; the
             rest stay stills, so the rail stays light */
          const clip = moving && clipIds.indexOf(g.id) >= 0 ? ideaClip(g) : null;
          return (
            <View key={g.id} style={{ width: 210, marginEnd: 10, borderRadius: 20, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
              {clip ? (
                <View style={{ height: 110 }}>
                  <video src={clip.clip} poster={clip.still} autoPlay muted loop playsInline preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 15 }}>{look.emoji}</Text>
                  </View>
                </View>
              ) : pic ? (
                <View style={{ height: 110 }}>
                  <Image source={{ uri: pic }} style={{ width: '100%', height: 110 }} accessibilityIgnoresInvertColors />
                  <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 15 }}>{look.emoji}</Text>
                  </View>
                </View>
              ) : (
                <LinearGradient colors={[look.from, look.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 110, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 40 }}>{look.emoji}</Text>
                </LinearGradient>
              )}
              <View style={{ padding: 12 }}>
                <Text numberOfLines={2} style={{ color: C.text, fontSize: 14.5, fontWeight: '900', lineHeight: 19, minHeight: 38 }}>{titleFor(g.title, lang)}</Text>
                <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12, fontWeight: '700', marginTop: 3 }}>{'📍 ' + t('id_in').replace('{place}', g.city || g.place_name || g.country || '')}</Text>
                <Pressable onPress={() => onStart(g)} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.purple }}>
                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('id_start')}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const RateLast = ({ t, lang }) => {
  const [g, setG] = useState(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { myUnrated().then((r) => { if (r && r.id) setG(r); }).catch(() => {}); }, []);
  if (!g) return null;
  if (done) return <Text style={{ color: C.green, fontSize: 14, fontWeight: '800', marginBottom: 14 }}>{'✓ ' + t('rt_thanks')}</Text>;
  const send = async () => {
    if (!stars) return;
    tapMedium();
    const r = await rateGathering(g.id, stars, note.trim());
    if (r && r.ok) setDone(true);
  };
  return (
    <View style={{ borderRadius: 22, padding: 16, marginBottom: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{t('rt_q').replace('{title}', titleFor(g.title, lang))}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => { tapLight(); setStars(n); }} accessibilityRole="button" accessibilityLabel={String(n)} hitSlop={4} style={{ marginEnd: 8 }}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={30} color={n <= stars ? C.gold : C.faint} />
          </Pressable>
        ))}
      </View>
      {stars ? (
        <View>
          <TextInput value={note} onChangeText={setNote} maxLength={400} placeholder={t('rt_ph')} placeholderTextColor={C.faint}
            style={{ color: C.text, fontSize: 14, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 8, marginTop: 8, outlineStyle: 'none' }} />
          <Pressable onPress={send} accessibilityRole="button" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <View style={{ borderRadius: 999, backgroundColor: C.text, paddingHorizontal: 18, paddingVertical: 9 }}>
              <Text style={{ color: C.bg, fontSize: 14, fontWeight: '900' }}>{t('rt_send')}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export const TogetherScreen = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { t, lang } = useLang();
  const rtl = lang === 'ar';
  const { user } = useAuth();
  /* the four tiles' sheets, fetched in a quiet moment once this tab is
     up, so the first tap opens one at once instead of waiting for it to
     download. Not in data saver. */
  useEffect(() => preloadTabs([GreenSheet, TripsSheet, SettleSheet, RewardsSheet], { saving: isSaving(getPrefs().dataSaver || DEFAULT_DATA_MODE) }), []);

  const [myCode, setMyCode] = useState(readCode);   // the country on your profile, as a code
  const [codeKnown, setCodeKnown] = useState(() => readCode() != null || !SUPABASE_READY);
  const [scope, setScope] = useState('near');       // 'near' | 'all'
  const [fix] = useState(lastFix);                  // where Moments was opened (the map's last fix)
  const [elsewhere, setElsewhere] = useState([]);   // plans away from you, offered as ideas
  const [rows, setRows] = useState(() => keptGatherings(readCode()));  // the week as last seen; null = still asking
  const [on, setOn] = useState(() => recall('whatson') || null);  // fetchWhatsOn: now / soon / groups
  const [day, setDay] = useState(null);
  const [aud, setAud] = useState(null);   // null = all · 'all' = mixed · 'women' · 'men'
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState({});
  const [sent, setSent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [creators, setCreators] = useState(() => recall('creators.' + (readCode() || 'all')) || []);     // hosts people really came to (top_creators)
  const [shareMsg, setShareMsg] = useState(null);
  const [askPush, setAskPush] = useState(false);
  const [talks, setTalks] = useState(null);         // talk rooms you are standing inside
  const [talkId, setTalkId] = useState(null);
  const [myGender, setMyGender] = useState(null);   // 'm' | 'f' | 'n' | null, from your profile
  const [other, setOther] = useState(null);         // a ladies-only (or guys-only) plan you can't join: { id, g }
  const [checkMsg, setCheckMsg] = useState(null);   // { id, text } after a refused check-in     // after a first join: a nudge before it starts?         // 'start' | 'green' | 'prog' | 'landing' | { group }

  const uid = user && user.id;
  useEffect(() => {
    if (!SUPABASE_READY || !uid) return;
    let alive = true;
    getProfile(uid).then((p) => {
      if (!alive) return;
      const code = flagToIso(p && p.country_flag);
      setMyCode(code); setCodeKnown(true);
      setMyGender((p && p.gender) || null);
      try { if (code) localStorage.setItem(CODE_KEY, code); else localStorage.removeItem(CODE_KEY); } catch (e) {}
    }).catch(() => { if (alive) setCodeKnown(true); });
    return () => { alive = false; };
  }, [uid]);

  const country = scope === 'near' ? myCode : null;
  /* back from the payment page (Paymob sends people to ?bookings=1):
     straight to My bookings, where the booking shows its status */
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !/[?&]bookings=1/.test(window.location.search)) return;
      setSheet({ trips: 'mine' });
      window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&]bookings=1/, '').replace(/^&/, '?') + window.location.hash);
    } catch (e) {}
  }, []);
  /* the host puts a real photo on their plan — once, and every week of
     a weekly plan shows it (weekly_photo in RUN_ME.sql) */
  const [photoBusy, setPhotoBusy] = useState(null);
  const changePhoto = async (g) => {
    if (!user || photoBusy) return;
    if (g.photo_url) { setPhotoBusy(g.id); try { await removeGatheringPhoto(g.id); } catch (e) {} setPhotoBusy(null); load(); return; }
    const file = await new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve(null);
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
      input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
      document.body.appendChild(input); input.click();
      return undefined;
    });
    if (!file) return;
    setPhotoBusy(g.id);
    try { const url = await uploadPlanPhoto(user.id, file); await setGatheringPhoto(g.id, url); tapSuccess(); load(); } catch (e) {}
    setPhotoBusy(null);
  };

  const load = useCallback(() => {
    let alive = true;
    if (!SUPABASE_READY || !uid) { setRows([]); setOn({ now: [], soon: [], groups: [] }); return () => {}; }
    /* not before your country is known — otherwise the whole world's
       list shows for a second and is then swapped for yours */
    if (scope === 'near' && !codeKnown) return () => {};
    /* both at once: the week and what else is on are separate questions */
    Promise.all([
      listGatherings(scope === 'near' ? null : country).catch(() => []),
      fetchWhatsOn({ userId: uid }).catch(() => ({ now: [], soon: [], groups: [] })),
      talkRoomsNear().catch(() => null),
      topCreators(country).catch(() => []),
    ]).then(([gs, wo, tr, cr]) => {
      if (!alive) return;
      setCreators(cr || []); remember('creators.' + (country || 'all'), cr || []);
      setTalks(tr && tr.ok ? { rooms: tr.rooms || [], offset: offsetFrom(tr.now) } : null);
      /* near: what is around you; the rest becomes ideas (one per activity) */
      if (scope === 'near') {
        const all = gs || [];
        const near0 = all.filter((g) => isNear(g, fix, myCode));
        /* a plan with no pin is near when it is in a city you already
           have pinned plans from — "Sketching by the Nile, in Cairo" is
           not an idea from another city to somebody in Cairo */
        const myCities = new Set(near0.map((g) => String(g.city || '').trim().toLowerCase()).filter(Boolean));
        const here = all.filter((g) => near0.includes(g)
          || ((g.lat == null || g.lng == null) && myCities.has(String(g.city || '').trim().toLowerCase())));
        const seen = new Set(here.map(ideaKey));
        const ideas = [];
        all.forEach((g) => {
          if (here.includes(g) || ideas.length >= 8) return;
          const k = ideaKey(g);
          if (seen.has(k)) return;
          seen.add(k); ideas.push(g);
        });
        setRows(here); setElsewhere(ideas);
        /* Few real plans anywhere yet: the starter ideas for your own
           country fill the rail (RUN_ME.sql "IDEAS FOR EVERY COUNTRY").
           They say where they are for, never that anybody is going. */
        /* and wherever Moments is opened with nothing on near you yet —
           Prague, Rabat, Lisbon — your own country's ideas come first,
           then the everyday ones, before anything from another city */
        if (ideas.length < 4 || !here.length) {
          listSparks(myCode).then((sp) => {
            if (!alive) return;
            const name = (COUNTRY_LIST.find((c) => c.code === myCode) || {}).name || (lang === 'ar' ? 'مدينتك' : 'your city');
            const extra = (sp || []).filter((x) => !seen.has(ideaKey({ kind: x.kind, title: x.title_en })))
              .sort((a, b) => Number(b.country === myCode) - Number(a.country === myCode))
              .slice(0, here.length ? 8 - ideas.length : 10)
              .map((x) => ({
                id: 'sp_' + x.id, kind: x.kind, title: x.title_en + ' · ' + x.title_ar,
                about: lang === 'ar' ? x.about_ar || x.about_en : x.about_en || x.about_ar,
                minutes: x.minutes, country: x.country ? (COUNTRY_LIST.find((c) => c.code === x.country) || {}).name || x.country : name,
              }));
            if (extra.length) setElsewhere(here.length ? ideas.concat(extra) : extra.concat(ideas).slice(0, 14));
          }).catch(() => {});
        }
      } else { setRows(gs || []); setElsewhere([]); }
      setOn(wo || { now: [], soon: [], groups: [] }); if (wo) remember('whatson', wo);
      setRefreshing(false);
    });
    return () => { alive = false; };
  }, [country, uid, scope, codeKnown, fix, myCode, lang]);
  useEffect(() => load(), [load]);

  const days = useMemo(() => groupByDay(aud ? (rows || []).filter((g) => (g.audience || 'all') === aud) : rows), [rows, aud]);
  const dayLabel = (d, long) => {
    if (d.offset === 0) return t('green_today');
    if (d.offset === 1) return t('green_tomorrow');
    try { return d.date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short' }); }
    catch (e) { return d.key; }
  };
  const hour = (iso) => {
    try { return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang, { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };

  /* a ladies-only plan is there for everybody to see, marked pink; a
     guy who taps it is offered the same plan for guys or for everyone
     instead of a bare "no". The server says no on its own as well
     (green_join), this only answers sooner. */
  const notForMe = (g) => uid && g.host_id !== uid && myGender
    && ((g.audience === 'women' && myGender !== 'f') || (g.audience === 'men' && myGender !== 'm'));
  const startLike = (g, audience) => {
    tapMedium(); setOther(null);
    setSheet({ start: { kind: g.kind, title: ideaTitle(titleFor(g.title, lang)), about: g.about || '', place: g.place_name || '', lat: g.lat, lng: g.lng, audience } });
  };
  const join = async (g) => {
    if (busy[g.id]) return;
    if (!g.im_going && notForMe(g)) { tapLight(); setOther(other && other.id === g.id ? null : { id: g.id, g }); return; }
    tapMedium();
    setBusy((b) => ({ ...b, [g.id]: true }));
    const yes = !g.im_going;
    /* the card changes at once and the server is asked; if it says no,
       the card goes back to what is true */
    setRows((list) => (list || []).map((x) => (x.id === g.id ? { ...x, im_going: yes, going: Math.max(0, (Number(x.going) || 0) + (yes ? 1 : -1)) } : x)));
    const r = await joinGathering(g.id, yes);
    setBusy((b) => { const n = { ...b }; delete n[g.id]; return n; });
    if (r && !r.ok && (r.reason === 'audience_women' || r.reason === 'audience_men')) setOther({ id: g.id, g });
    else if (r && !r.ok && /^audience_/.test(r.reason || '')) setCheckMsg({ id: g.id, text: t('au_err_' + r.reason.slice(9)) });
    if (r && !r.ok && /^age_/.test(r.reason || '')) setCheckMsg({ id: g.id, text: t('ag_err_' + r.reason.slice(4)) });
    if (!(r && r.ok)) load();
    else if (yes) {
      tapSuccess();
      /* the one moment a notification obviously helps — asked once */
      if (!wasAsked() && pushSupport() !== 'no') setAskPush(true);
    }
  };

  /* "I'm here": where you are is checked once, against the place */
  /* a photo somebody finds wrong: one report, to the owner's Studio,
     carrying which plan and which picture */
  const [reportingPhoto, setReportingPhoto] = useState(null);
  const reportPhoto = (g, url) => setReportingPhoto({ id: g.id + ' ' + url, label: titleFor(g.title, lang) });

  const checkIn = async (g) => {
    if (busy[g.id]) return;
    tapMedium();
    setBusy((b) => ({ ...b, [g.id]: true })); setCheckMsg(null);
    const at = await getCurrentCoords();
    const r = at ? await checkInAt(g.id, at.latitude, at.longitude) : { ok: false, reason: 'no_location' };
    setBusy((b) => { const n = { ...b }; delete n[g.id]; return n; });
    if (r && r.ok) { tapSuccess(); setRows((list) => (list || []).map((x) => (x.id === g.id ? { ...x, checked_in: true } : x))); }
    else setCheckMsg({ id: g.id, text: r && r.reason === 'too_far' ? t('xp_err_far') : r && r.reason === 'no_location' ? t('gn_err_loc') : t('lamma_offline') });
  };

  const invite = async (g) => {
    tapMedium();
    const r = await announceGathering(g.id);
    if (r && r.ok) { tapSuccess(); setSent({ id: g.id, n: r.sent }); load(); }
  };

  const [joined, setJoined] = useState({});
  const quickJoin = async (key, fn) => {
    if (joined[key]) return;
    tapLight();
    setJoined((j) => ({ ...j, [key]: 'busy' }));
    try { await fn(); setJoined((j) => ({ ...j, [key]: 'done' })); }
    catch (e) { setJoined((j) => { const n = { ...j }; delete n[key]; return n; }); }
  };

  const creatorIds = useMemo(() => new Set(creators.filter((c) => c.is_creator).map((c) => c.id)), [creators]);
  const follow = async (c) => {
    if (!uid) return;
    const on = !c.i_follow;
    tapLight();
    setCreators((l) => l.map((x) => (x.id === c.id ? { ...x, i_follow: on, followers: Math.max(0, (x.followers || 0) + (on ? 1 : -1)) } : x)));
    const ok = await followCreator(uid, c.id, on);
    if (!ok) setCreators((l) => l.map((x) => (x.id === c.id ? { ...x, i_follow: !on, followers: Math.max(0, (x.followers || 0) + (on ? -1 : 1)) } : x)));
    else if (on) tapSuccess();
  };

  /* All week: a plan that repeats (same weekly series, or the same
     title at the same place) shows once, on its next date — "every
     week" on the card says the rest. One day picked shows that day whole. */
  const shown = (() => {
    if (day !== null) return days.filter((d) => d.key === day);
    const seen = new Set();
    return days.map((d) => ({ ...d, items: d.items.filter((g) => {
      const k = g.weekly_id || ((g.title || '') + '|' + (g.place_name || ''));
      if (seen.has(k)) return false; seen.add(k); return true;
    }) })).filter((d) => d.items.length);
  })();
  const myFlag = myCode ? String.fromCodePoint(...myCode.split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)) : '📍';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 130, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
      >
        {/* ── header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4 }}>{t('tg_kicker')}</Text>
            <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', marginTop: 4 }}>{t('tg_title')}</Text>
          </View>
          <Pressable onPress={() => { tapMedium(); setSheet('start'); }} accessibilityRole="button" accessibilityLabel={t('tg_start')} hitSlop={8}>
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.text }}>
              <Ionicons name="add" size={26} color={C.text} />
            </View>
          </Pressable>
        </View>

        {/* ── RIGHT NOW ── one card, two rows: put yourself on the map with
            something to join, and see who else is around. They were two
            cards about the same moment. */}
        <View style={{ borderRadius: 22, marginBottom: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
          <Pressable onPress={() => { tapMedium(); setSheet('gonow'); }} accessibilityRole="button">
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 30 }}>🏃</Text>
              <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }}>{t('gn_cta')}</Text>
                <Text style={{ color: C.dim, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{t('gn_cta_sub')}</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={'arrow-forward'} size={18} color="#FFF" />
              </View>
            </View>
          </Pressable>
          <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 16 }} />
          <PeopleNearby bare />
        </View>

        <RateLast t={t} lang={lang} />
        {askPush ? <View style={{ marginBottom: 14 }}><PushRow ask onDone={() => setAskPush(false)} /></View> : null}

        {/* ── where ── */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Pill on={scope === 'near'} label={(fix ? '📍' : myFlag) + ' ' + t('tg_near_me')} onPress={() => { tapLight(); setScope('near'); setDay(null); }} />
          <Pill on={scope === 'all'} label={'🌍 ' + t('tg_everywhere')} onPress={() => { tapLight(); setScope('all'); setDay(null); }} />
        </View>

        {/* ── the week ── */}
        {rows === null ? (
          <ActivityIndicator color={C.purple} style={{ marginVertical: 40 }} />
        ) : rows.length === 0 ? (
          /* nothing this week: a picture of people out together, not a
             seedling emoji on a grey box — the same open door as Home */
          <View style={{ height: 290, borderRadius: 24, overflow: 'hidden', marginTop: 4, backgroundColor: C.glassHi }}>
            <Image source={{ uri: publicMedia(moodOfToday(1)) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.82)']} locations={[0.2, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>{t('tg_empty_t')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 19, marginTop: 5 }}>{t('nu_empty_s')}</Text>
              <View style={{ alignItems: 'flex-start', marginTop: 14 }}>
                <Pressable onPress={() => { tapMedium(); setSheet('start'); }} accessibilityRole="button">
                  <View style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: '#FFF' }}>
                    <Text style={{ color: '#1A1A1A', fontSize: 14.5, fontWeight: '900' }}>{t('tg_start')}</Text>
                  </View>
                </Pressable>
                {scope === 'near' ? (
                  <Pressable onPress={() => { tapLight(); setScope('all'); }} accessibilityRole="button" style={{ marginTop: 12 }} hitSlop={8}>
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800', textDecorationLine: 'underline' }}>{t('tg_see_everywhere')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* girls only · guys only · mixed — shown once any of them exists */}
            {(rows || []).some((g) => g.audience && g.audience !== 'all') ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 6 }}>
                {[[null, '✨', 'au_any'], ['all', '👥', 'au_mixed'], ['women', '👩', 'au_women'], ['men', '👨', 'au_men']].map(([k, e, key]) => (
                  <Pill key={key} on={aud === k} label={e + ' ' + t(key)} onPress={() => { tapLight(); setAud(k); setDay(null); }} />
                ))}
              </ScrollView>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 6 }}>
              <Pill on={day === null} label={t('green_all_week')} onPress={() => { tapLight(); setDay(null); }} />
              {days.map((d) => (
                <Pill key={d.key} on={day === d.key} label={dayLabel(d) + '  ' + d.items.length} onPress={() => { tapLight(); setDay(d.key); }} />
              ))}
            </ScrollView>

            {shown.map((d) => (
              <View key={d.key}>
                <Section>{dayLabel(d, true).toUpperCase()}</Section>
                {d.items.map((g) => {
                  const mine = uid && g.host_id === uid;
                  const expanded = open === g.id;
                  return (
                    <Pressable key={g.id} onPress={() => { tapLight(); setOpen(expanded ? null : g.id); }}>
                      <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: isGreen(g) ? 'rgba(16,185,129,0.55)' : g.audience === 'women' ? '#F9A8D4' : C.line, borderWidth: g.audience === 'women' && !g.im_going ? 1.5 : 1, borderRadius: 22, padding: 12, marginBottom: 10 }}>
                        <PlanHead g={g}>
                          <Text numberOfLines={2} style={{ color: C.text, fontSize: 15.5, fontWeight: '900', lineHeight: 20 }}>{titleFor(g.title, lang)}</Text>
                          <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 3 }}>
                            {hour(g.starts_at)}{g.place_name ? ' · ' + g.place_name : g.city ? ' · ' + g.city : ''}
                          </Text>
                          {g.host_role ? <View style={{ marginTop: 5 }}><HostBadge role={g.host_role} small /></View> : null}
                          {g.age_min != null || g.age_max != null ? (
                            <View style={{ alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#FEF3C7' }}>
                              <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '900' }}>{t('ag_label').replace('{range}', g.age_max != null ? (g.age_min || 13) + '–' + g.age_max : g.age_min + '+')}</Text>
                            </View>
                          ) : null}
                          {g.blind ? (
                            <View style={{ alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#EDE9FE' }}>
                              <Text style={{ color: '#5B21B6', fontSize: 12, fontWeight: '900' }}>{'🎭 ' + t('bm_title')}</Text>
                            </View>
                          ) : null}
                          {g.audience && g.audience !== 'all' ? (
                            <View style={{ alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: g.audience === 'women' ? '#FCE7F3' : '#DBEAFE' }}>
                              <Text style={{ color: g.audience === 'women' ? '#9D174D' : '#1E40AF', fontSize: 12, fontWeight: '900' }}>{(g.audience === 'women' ? '🌸 ' : '👨 ') + t('au_' + g.audience)}</Text>
                            </View>
                          ) : null}
                          {creatorIds.has(g.host_id) ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                              <Ionicons name="star" size={12} color={C.gold} />
                              <Text style={{ color: C.dim, fontSize: 12, fontWeight: '800', marginStart: 4 }}>{t('rw_creator_badge')}</Text>
                            </View>
                          ) : null}
                        </PlanHead>

                        {expanded && g.about ? (
                          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>{g.about}</Text>
                        ) : null}
                        {/* what actually happens, hour by hour */}
                        {expanded ? <PlanProgram g={g} t={t} hour={hour} /> : null}
                        {/* who is responsible: the person running it, not Moments */}
                        {expanded && !mine ? <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>{t('hc_liability')}</Text> : null}
                        {/* photos people really took there last time */}
                        {expanded ? <PastPhotos g={g} t={t} onReport={(u) => reportPhoto(g, u)} /> : null}
                        {/* no "Add a photo" on the card: photos come after, from the people who
                            went, in the plan's own group chat. A host can still take down an old one. */}
                        {expanded && ((mine && g.photo_url) || (g.lat != null && g.lng != null)) ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                            {mine && g.photo_url ? (
                              <Pressable onPress={() => { tapLight(); changePhoto(g); }} disabled={photoBusy === g.id} accessibilityRole="button"
                                style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.purpleSoft, paddingHorizontal: 11, paddingVertical: 7, marginEnd: 8, opacity: photoBusy === g.id ? 0.5 : 1 }}>
                                <Ionicons name={g.photo_url ? 'trash-outline' : 'camera-outline'} size={14} color={C.purple} />
                                <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', marginStart: 5 }}>{t(g.photo_url ? 'pl_remove_photo_short' : 'pl_add_photo_short')}</Text>
                              </Pressable>
                            ) : null}
                            {g.lat != null && g.lng != null ? (
                              <Pressable onPress={() => { tapLight(); showOnMap({ lat: g.lat, lng: g.lng }); }} accessibilityRole="button"
                                style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.purpleSoft, paddingHorizontal: 11, paddingVertical: 7 }}>
                                <Ionicons name="map-outline" size={14} color={C.purple} />
                                <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', marginStart: 5 }}>{t('show_on_map')}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
                          {/* who is going: your mates' faces, by name — the reason to go */}
                          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
                            {(g.mate_faces || []).length ? (
                              <View style={{ flexDirection: 'row', marginEnd: 8 }}>
                                {(g.mate_faces || []).map((f, fi) => (
                                  f.avatar ? <Image key={f.id} source={{ uri: f.avatar }} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.glass, marginStart: fi ? -8 : 0, backgroundColor: C.glassHi }} />
                                    : <View key={f.id} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.glass, marginStart: fi ? -8 : 0, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.purple, fontSize: 11, fontWeight: '900' }}>{(f.name || '?')[0].toUpperCase()}</Text></View>
                                ))}
                              </View>
                            ) : null}
                            <Text style={{ color: (g.mate_faces || []).length ? C.text : C.faint, fontSize: 12.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>
                              {(g.mate_faces || []).length
                                ? t((Number(g.going) || 0) > 1 ? 'tg_mate_and' : 'tg_mate_going').replace('{name}', g.mate_faces[0].name || '').replace('{n}', String((Number(g.going) || 0) - 1))
                                : (g.im_going ? '✓ ' : '') + (Number(g.going) || 0) + ' ' + t('green_going')}
                            </Text>
                          </View>
                          {g.im_going || mine ? (
                            /* notes to the others on it, sealed until it ends (CapsuleSheet) */
                            <Pressable onPress={() => { tapLight(); setSheet({ capsule: g }); }}
                              hitSlop={6} accessibilityRole="button" accessibilityLabel={t('tk_title')} style={{ marginEnd: 8 }}>
                              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.line }}>
                                <Text style={{ fontSize: 16 }}>{g.blind ? '🎭' : '✉️'}</Text>
                              </View>
                            </Pressable>
                          ) : null}
                          {(g.im_going || mine) && g.squad_id && !g.blind ? (
                            /* the plan's own group chat — "I'm at the gate" */
                            <Pressable onPress={() => { tapLight(); openChat({ id: g.squad_id, name: titleFor(g.title, lang), emoji: lookOf(g.kind).emoji }); goToTab('CHATS'); }}
                              hitSlop={6} accessibilityRole="button" accessibilityLabel={t('tg_chat')} style={{ marginEnd: 8 }}>
                              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.line }}>
                                <Ionicons name="chatbubbles-outline" size={17} color={C.text} />
                              </View>
                            </Pressable>
                          ) : null}
                          {g.checked_in ? (
                            <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '900' }}>{'✓ ' + t('xp_checked_in')}</Text>
                          ) : canCheckIn(g) ? (
                            <Pressable onPress={() => checkIn(g)} disabled={!!busy[g.id]} accessibilityRole="button">
                              <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8, opacity: busy[g.id] ? 0.6 : 1 }}>
                                <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{t('xp_im_here').replace('{n}', String(g.xp || 30))}</Text>
                              </View>
                            </Pressable>
                          ) : mine ? (
                            g.announced_at ? (
                              <Text style={{ color: C.green, fontSize: 12.5, fontWeight: '900' }}>{t('green_invited')}</Text>
                            ) : (
                              <Pressable onPress={() => invite(g)} hitSlop={6}>
                                <View style={{ backgroundColor: C.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                                  <Text style={{ color: C.bg, fontSize: 12.5, fontWeight: '900' }}>{t('green_invite_all')}</Text>
                                </View>
                              </Pressable>
                            )
                          ) : (
                            !g.im_going && notForMe(g) ? (
                              <Pressable onPress={() => join(g)} hitSlop={6} accessibilityRole="button">
                                <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: g.audience === 'women' ? '#FCE7F3' : '#DBEAFE' }}>
                                  <Text style={{ color: g.audience === 'women' ? '#9D174D' : '#1E40AF', fontSize: 12.5, fontWeight: '900' }}>{(g.audience === 'women' ? '🌸 ' : '👨 ') + t('au_' + g.audience)}</Text>
                                </View>
                              </Pressable>
                            ) : (
                              <JoinPill going={!!g.im_going} busy={!!busy[g.id]} onPress={() => join(g)} t={t} />
                            )
                          )}
                        </View>
                        {sent && sent.id === g.id ? (
                          <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginTop: 8 }}>{t('green_sent_to')} {sent.n}</Text>
                        ) : null}
                        {checkMsg && checkMsg.id === g.id ? (
                          <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>{checkMsg.text}</Text>
                        ) : null}
                        {other && other.id === g.id ? (
                          <View style={{ marginTop: 10, borderRadius: 16, padding: 12, backgroundColor: g.audience === 'women' ? '#FDF2F8' : '#EFF6FF' }}>
                            <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '900' }}>{t(g.audience === 'women' ? 'au_only_ladies' : 'au_only_guys')}</Text>
                            <Text style={{ color: '#5C5C58', fontSize: 13, marginTop: 2, lineHeight: 18 }}>{t('au_start_like')}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                              {myGender === 'm' || myGender === 'f' ? (
                                <Pressable onPress={() => startLike(g, myGender === 'm' ? 'men' : 'women')} accessibilityRole="button" style={{ marginEnd: 8, marginBottom: 6 }}>
                                  <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.purple }}>
                                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{myGender === 'm' ? '👨 ' + t('au_start_guys') : '🌸 ' + t('au_start_ladies')}</Text>
                                  </View>
                                </Pressable>
                              ) : null}
                              <Pressable onPress={() => startLike(g, 'all')} accessibilityRole="button" style={{ marginBottom: 6 }}>
                                <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: C.purple }}>
                                  <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>{'👥 ' + t('au_start_mixed')}</Text>
                                </View>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {/* ── talk first, then meet ── only rooms whose area you are in */}
        {talks && talks.rooms.length ? (
          <>
            <Section>{t('tr_section')}</Section>
            {talks.rooms.map((r) => (
              <Pressable key={r.id} onPress={() => { tapMedium(); setTalkId(r.id); }} accessibilityRole="button"
                style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>🎙️</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{r.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {[r.org || r.host, r.area, t('tr_here_left').replace('{n}', String(r.here)).replace('{t}', fmt(remaining(r.ends_at, talks.offset)))].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.purple }}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{r.mine ? t('tr_back_in') : t('tr_join')}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* ── right now ── */}
        {on && on.now && on.now.length ? (
          <>
            <Section>{t('wo_now')}</Section>
            {on.now.map((c) => (
              <View key={c.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' }}>
                <LinearGradient colors={['#F97316', '#EF4444']} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>🔥</Text>
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{[c.host, c.topic].filter(Boolean).join(' · ')}</Text>
                </View>
                {joined['f' + c.id] === 'done'
                  ? <Ionicons name="checkmark-circle" size={22} color={C.green} />
                  : <JoinPill going={false} busy={joined['f' + c.id] === 'busy'} onPress={() => quickJoin('f' + c.id, () => joinCampfire(c.id, uid))} t={t} />}
              </View>
            ))}
          </>
        ) : null}

        {/* ── groups ── */}
        {on && on.groups && on.groups.length ? (
          <>
            <Section>{t('wo_groups')}</Section>
            {on.groups.slice(0, 6).map((g) => (
              <Pressable key={g.id} onPress={() => { tapLight(); setSheet({ group: g.id }); }}>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{g.emoji || '👥'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginStart: 11 }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{g.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {[g.city, t('wo_members').replace('{n}', String(g.members || 0))].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {joined['g' + g.id] === 'done'
                    ? <Ionicons name="checkmark-circle" size={22} color={C.green} />
                    : g.waiting
                      ? <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{t('wo_waiting')}</Text>
                      : <JoinPill going={false} busy={joined['g' + g.id] === 'busy'} onPress={() => quickJoin('g' + g.id, () => joinGroup(g.id, uid, g.privacy))} t={t} />}
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {scope === 'near' ? (
          <IdeasElsewhere ideas={elsewhere} t={t} lang={lang}
            onStart={(g) => { tapMedium(); setSheet({ start: { kind: g.kind, title: ideaTitle(titleFor(g.title, lang)), about: g.about || '', minutes: g.minutes, audience: g.audience && g.audience !== 'all' ? g.audience : undefined } }); }} />
        ) : null}

        {/* ── workshops ── Ayser: they are activities, so they sit with the
            activities — writing, poetry, dance, music, kids */}
        <Workshops t={t} lang={lang} onOpen={(o) => setSheet({ trips: 'browse', only: 'workshop', focus: o.id })} />

        {/* ── circles near you ── groups people started at places nearby */}
        {uid ? <CirclesNear /> : null}

        {/* ── more ── Ayser: "يبقي مترابط و سهل و الfeatures مش كتير". Nine
            tiles became four: the map, Go out now and talk rooms already
            have their own doors above and in the tabs; the papers live
            inside Settling in; exchanges live in Chats. */}
        <Section>{t('tg_more')}</Section>
        <GreenDoor t={t} onPress={() => setSheet('green')} />
        {/* Explore: places, trips, countries, customs and settling in —
            five doors that were in three rooms, now one, with a picture */}
        <Pressable onPress={() => { tapLight(); setSheet('explore'); }} accessibilityRole="button" accessibilityLabel={t('ex_title')}
          style={({ pressed }) => ({ marginTop: 2, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <View style={{ height: 128, borderRadius: 22, overflow: 'hidden', backgroundColor: C.glassHi }}>
            <Image source={{ uri: publicMedia('trip-siwa-3.jpg') }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} locations={[0.3, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
              <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900' }}>{t('ex_title')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>{t('ex_door')}</Text>
            </View>
          </View>
        </Pressable>
        {/* trips live inside Explore now; play is the one other door */}
        <Pressable onPress={() => { tapLight(); nav.navigate('CHILL'); }} accessibilityRole="button" accessibilityLabel={t('tg_play')} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingVertical: 15, paddingHorizontal: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Ionicons name="game-controller-outline" size={21} color={C.text} />
            <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '800', marginStart: 12 }}>{t('tg_play')}</Text>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={C.dim} />
          </View>
        </Pressable>

        {/* ── bring your people ── one quiet line; the details are in Rewards */}
        {uid ? (
          <Pressable onPress={() => { tapLight(); setSheet({ rewards: 'invite' }); }} accessibilityRole="button" style={{ marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.goldSoft, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16 }}>
              <Ionicons name="gift-outline" size={19} color={C.gold} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', flex: 1, marginStart: 12 }} numberOfLines={2}>{t('rw_inv_plus')}</Text>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={C.dim} />
            </View>
          </Pressable>
        ) : null}
        {/* ── own a place, or run trips? ── a line of text, not another card (PartnerSheet) */}
        <Pressable onPress={() => { tapLight(); openPartner('place'); }} accessibilityRole="button" style={{ marginTop: 16, marginBottom: 8, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: C.text, paddingVertical: 10, paddingHorizontal: 18 }}>
            <Ionicons name="storefront-outline" size={16} color={C.text} />
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginStart: 8 }}>{t('pt_together_line')}</Text>
          </View>
        </Pressable>
      </ScrollView>

      {sheet === 'explore' ? <ExploreSheet onClose={() => setSheet(null)} onPick={(k) => setSheet(k === 'trips' ? { trips: 'browse' } : k)} /> : null}
      {sheet === 'countries' ? <CountrySheet startCode={myCode} onClose={() => setSheet(null)} /> : null}
      {sheet === 'places' ? <BizDirectory lang={lang} city={null} onClose={() => setSheet(null)} /> : null}
      {sheet === 'gonow' ? <GoNowSheet onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet === 'talk' ? <StartTalkSheet country={myCode} onClose={() => setSheet(null)} onStarted={(id) => { setSheet(null); setTalkId(id); }} /> : null}
      {talkId ? <TalkRoomSheet roomId={talkId} onClose={() => { setTalkId(null); load(); }} /> : null}
      {sheet === 'start' ? <GreenSheet startNow homeCountry={myCode} onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet && sheet.start ? <GreenSheet startNow prefill={sheet.start} homeCountry={myCode} onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet && sheet.capsule ? <CapsuleSheet kind="plan" id={sheet.capsule.id} title={titleFor(sheet.capsule.title, lang)} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.trips ? <TripsSheet openOn={sheet.trips} only={sheet.only} focus={sheet.focus} onClose={() => setSheet(null)} /> : null}
      {sheet === 'settle' ? <SettleSheet myCode={myCode} onClose={() => setSheet(null)} onSwap={(p) => setSheet({ start: p })} onPapers={isEuCode(myCode) ? () => setSheet('landing') : null} /> : null}
      {reportingPhoto ? <ReportSheet contentType="plan_photo" contentId={reportingPhoto.id} contentLabel={reportingPhoto.label} onClose={() => setReportingPhoto(null)} /> : null}
      {sheet === 'green' ? <GreenSheet homeCountry={myCode} onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet === 'prog' ? <ProgrammesSheet onClose={() => setSheet(null)} onOpenGroup={(id) => setSheet({ group: id })} /> : null}
      {sheet === 'landing' ? <LandingSheet country={myCode} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.rewards ? <RewardsSheet tab={sheet.rewards} onClose={() => setSheet(null)} onStartPlan={() => setSheet('start')} /> : null}
      {sheet && sheet.group ? <GroupPage groupId={sheet.group} onClose={() => setSheet(null)} /> : null}
    </View>
  );
};
