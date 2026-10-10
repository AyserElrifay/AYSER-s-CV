import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { listGatherings, joinGathering, announceGathering, myInvites, checkInAt } from '../services/green';
import { canCheckIn } from '../lib/xp';
import { getCurrentCoords } from '../utils/location';
import { pushSupport, wasAsked } from '../lib/push';
import { PushRow } from '../components/PushRow';
import { talkRoomsNear } from '../services/talkRooms';
import { fmt, remaining, offsetFrom } from '../lib/talkClock';
import { appLink, shareLink, shareNote } from '../utils/share';
import { fetchWhatsOn } from '../services/whatson';
import { joinCampfire } from '../services/campfires';
import { joinGroup } from '../services/groups';
import { getProfile } from '../services/profiles';
import { isEuCode } from '../lib/eu';
import { lookOf, titleFor } from '../lib/activityPins';
import { flagToIso, groupByDay } from '../lib/together';
import { showOnMap, goToTab } from '../lib/mapBus';
import { openChat } from '../lib/chatBus';
import { lazyOverlay } from '../lib/lazyScreen';
import { HostBadge } from '../components/HostCard';
import { PlanThumb, PastPhotos } from '../components/green/PlanPhoto';
import { ReportSheet } from '../components/ReportSheet';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

const GreenSheet = lazyOverlay(() => import('../components/green/GreenSheet').then((m) => ({ default: m.GreenSheet })));
const ProgrammesSheet = lazyOverlay(() => import('../components/green/ProgrammesSheet').then((m) => ({ default: m.ProgrammesSheet })));
const LandingSheet = lazyOverlay(() => import('../components/LandingSheet').then((m) => ({ default: m.LandingSheet })));
const GoNowSheet = lazyOverlay(() => import('../components/GoNowSheet').then((m) => ({ default: m.GoNowSheet })));
const GroupPage = lazyOverlay(() => import('../components/GroupPage').then((m) => ({ default: m.GroupPage })));
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
const Tile = ({ emoji, label, from, to, onPress }) => (
  <Pressable onPress={() => { tapLight(); onPress(); }} style={{ width: '31.5%', marginBottom: 10 }} accessibilityRole="button">
    <View style={{ borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', minHeight: 96, justifyContent: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800', textAlign: 'center', marginTop: 6 }} numberOfLines={2}>{label}</Text>
    </View>
  </Pressable>
);

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

export const TogetherScreen = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [myCode, setMyCode] = useState(null);       // the country on your profile, as a code
  const [scope, setScope] = useState('near');       // 'near' | 'all'
  const [rows, setRows] = useState(null);           // null = still asking
  const [on, setOn] = useState(null);               // fetchWhatsOn: now / soon / groups
  const [day, setDay] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState({});
  const [sent, setSent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [invited, setInvited] = useState(null);     // how many joined through your link — the real count
  const [shareMsg, setShareMsg] = useState(null);
  const [askPush, setAskPush] = useState(false);
  const [talks, setTalks] = useState(null);         // talk rooms you are standing inside
  const [talkId, setTalkId] = useState(null);
  const [checkMsg, setCheckMsg] = useState(null);   // { id, text } after a refused check-in     // after a first join: a nudge before it starts?         // 'start' | 'green' | 'prog' | 'landing' | { group }

  const uid = user && user.id;
  useEffect(() => {
    if (!SUPABASE_READY || !uid) return;
    let alive = true;
    getProfile(uid).then((p) => { if (alive) setMyCode(flagToIso(p && p.country_flag)); }).catch(() => {});
    myInvites().then((n) => { if (alive) setInvited(n); });
    return () => { alive = false; };
  }, [uid]);

  const country = scope === 'near' ? myCode : null;
  const load = useCallback(() => {
    let alive = true;
    if (!SUPABASE_READY || !uid) { setRows([]); setOn({ now: [], soon: [], groups: [] }); return () => {}; }
    /* both at once: the week and what else is on are separate questions */
    Promise.all([
      listGatherings(country).catch(() => []),
      fetchWhatsOn({ userId: uid }).catch(() => ({ now: [], soon: [], groups: [] })),
      talkRoomsNear().catch(() => null),
    ]).then(([gs, wo, tr]) => {
      if (!alive) return;
      setTalks(tr && tr.ok ? { rooms: tr.rooms || [], offset: offsetFrom(tr.now) } : null);
      setRows(gs || []);
      setOn(wo || { now: [], soon: [], groups: [] });
      setRefreshing(false);
    });
    return () => { alive = false; };
  }, [country, uid]);
  useEffect(() => load(), [load]);

  const days = useMemo(() => groupByDay(rows), [rows]);
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

  const join = async (g) => {
    if (busy[g.id]) return;
    tapMedium();
    setBusy((b) => ({ ...b, [g.id]: true }));
    const yes = !g.im_going;
    /* the card changes at once and the server is asked; if it says no,
       the card goes back to what is true */
    setRows((list) => (list || []).map((x) => (x.id === g.id ? { ...x, im_going: yes, going: Math.max(0, (Number(x.going) || 0) + (yes ? 1 : -1)) } : x)));
    const r = await joinGathering(g.id, yes);
    setBusy((b) => { const n = { ...b }; delete n[g.id]; return n; });
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

  const shown = days.filter((d) => day === null || d.key === day);
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

        {/* ── going out now? ── the fastest way into the week: one tap
            and you are on the map for anyone nearby to join */}
        <Pressable onPress={() => { tapMedium(); setSheet('gonow'); }} accessibilityRole="button" style={{ marginBottom: 14 }}>
          <View style={{ borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
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

        {askPush ? <View style={{ marginBottom: 14 }}><PushRow ask onDone={() => setAskPush(false)} /></View> : null}

        {/* ── where ── */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Pill on={scope === 'near'} label={myFlag + ' ' + t('tg_near_me')} onPress={() => { tapLight(); setScope('near'); setDay(null); }} />
          <Pill on={scope === 'all'} label={'🌍 ' + t('tg_everywhere')} onPress={() => { tapLight(); setScope('all'); setDay(null); }} />
        </View>

        {/* ── the week ── */}
        {rows === null ? (
          <ActivityIndicator color={C.purple} style={{ marginVertical: 40 }} />
        ) : rows.length === 0 ? (
          <View style={{ borderRadius: 24, padding: 22, alignItems: 'center', marginTop: 4, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>{t('tg_empty_t')}</Text>
            <Text style={{ color: C.dim, fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginTop: 6 }}>{t('tg_empty_b')}</Text>
            <Pressable onPress={() => { tapMedium(); setSheet('start'); }} style={{ marginTop: 16 }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13, backgroundColor: C.purple }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('tg_start')}</Text>
              </View>
            </Pressable>
            {scope === 'near' ? (
              <Pressable onPress={() => { tapLight(); setScope('all'); }} style={{ marginTop: 12 }}>
                <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900' }}>{t('tg_see_everywhere')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
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
                      <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: g.im_going ? 'rgba(16,185,129,0.55)' : C.line, borderRadius: 22, padding: 12, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <PlanThumb g={g} size={58} radius={18} tilt />
                          <View style={{ flex: 1, minWidth: 0, marginStart: 12 }}>
                            <Text numberOfLines={2} style={{ color: C.text, fontSize: 15.5, fontWeight: '900', lineHeight: 20 }}>{titleFor(g.title, lang)}</Text>
                            <Text numberOfLines={1} style={{ color: C.faint, fontSize: 12.5, fontWeight: '700', marginTop: 3 }}>
                              {hour(g.starts_at)}{g.place_name ? ' · ' + g.place_name : g.city ? ' · ' + g.city : ''}
                            </Text>
                            {g.host_role ? <View style={{ marginTop: 5 }}><HostBadge role={g.host_role} small /></View> : null}
                          </View>
                        </View>

                        {expanded && g.about ? (
                          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>{g.about}</Text>
                        ) : null}
                        {/* who is responsible: the person running it, not Moments */}
                        {expanded && !mine ? <Text style={{ color: C.faint, fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>{t('hc_liability')}</Text> : null}
                        {/* photos people really took there last time */}
                        {expanded ? <PastPhotos g={g} t={t} onReport={(u) => reportPhoto(g, u)} /> : null}
                        {expanded && g.lat != null && g.lng != null ? (
                          <Pressable onPress={() => { tapLight(); showOnMap({ lat: g.lat, lng: g.lng }); }} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' }}>
                            <Ionicons name="map-outline" size={15} color={C.purple} />
                            <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900', marginStart: 5 }}>{t('show_on_map')}</Text>
                          </Pressable>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11 }}>
                          <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800', flex: 1, minWidth: 0 }} numberOfLines={1}>
                            {(Number(g.going) || 0) + ' ' + t('green_going')}{g.weekly_id ? ' · ' + t('green_every_week') : ''}{g.about || g.lat != null ? '  ' + (expanded ? '▴' : '▾') : ''}
                          </Text>
                          {(g.im_going || mine) && g.squad_id ? (
                            /* the plan's own group chat — "I'm at the gate" */
                            <Pressable onPress={() => { tapLight(); openChat({ id: g.squad_id, name: titleFor(g.title, lang), emoji: lookOf(g.kind).emoji }); goToTab('CHATS'); }}
                              hitSlop={6} accessibilityRole="button" accessibilityLabel={t('tg_chat')} style={{ marginEnd: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: C.line }}>
                                <Ionicons name="chatbubbles-outline" size={14} color={C.text} />
                                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900', marginStart: 5 }}>{t('tg_chat')}</Text>
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
                            <JoinPill going={!!g.im_going} busy={!!busy[g.id]} onPress={() => join(g)} t={t} />
                          )}
                        </View>
                        {sent && sent.id === g.id ? (
                          <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', marginTop: 8 }}>{t('green_sent_to')} {sent.n}</Text>
                        ) : null}
                        {checkMsg && checkMsg.id === g.id ? (
                          <Text style={{ color: C.coral, fontSize: 12.5, fontWeight: '700', marginTop: 8 }}>{checkMsg.text}</Text>
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

        {/* ── the rooms around it ── */}
        <Section>{t('tg_more')}</Section>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Tile emoji="🎓" label={t('prog_title')} from="#3B82F6" to="#06B6D4" onPress={() => setSheet('prog')} />
          {isEuCode(myCode) ? (
            <Tile emoji="🧭" label={t('ld_title')} from="#10B981" to="#84CC16" onPress={() => setSheet('landing')} />
          ) : null}
          {/* "Ideas" and "How we do it" were two doors into the same Green
              Minds sheet — Ayser: "ideas هي هي green minds". One door; the
              ideas and the how-to are inside it. */}
          <Tile emoji="🌿" label={t('green_title')} from="#10B981" to="#84CC16" onPress={() => setSheet('green')} />
          <Tile emoji="🎲" label={t('tg_play')} from="#A855F7" to="#EC4899" onPress={() => nav.navigate('CHILL')} />
          <Tile emoji="🗺️" label={t('tg_on_map')} from="#6366F1" to="#8B5CF6" onPress={() => nav.navigate('MAP')} />
          <Tile emoji="🏃" label={t('gn_cta_short')} from="#10B981" to="#0EA5E9" onPress={() => setSheet('gonow')} />
          <Tile emoji="🎙️" label={t('tr_tile')} from="#111" to="#111" onPress={() => setSheet('talk')} />
        </View>

        {/* ── bring your people ── a community grows by people bringing
            people. Your own link, and how many really joined through it. */}
        {uid ? (
          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 16, marginTop: 12 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{t('inv_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{t('inv_sub')}</Text>
            {invited != null ? (
              <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900', marginTop: 10 }}>
                {invited === 0 ? t('inv_none') : invited === 1 ? t('inv_one') : t('inv_n').replace('{n}', String(invited))}
              </Text>
            ) : null}
            <Pressable
              onPress={async () => {
                tapMedium();
                const r = await shareLink({ url: appLink({ invite: uid }), title: 'Moments', text: t('inv_text') });
                const note = shareNote(r); if (note) { setShareMsg(note); setTimeout(() => setShareMsg(null), 2400); }
              }}
              accessibilityRole="button" style={{ marginTop: 12 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: C.purple }}>
                <Ionicons name="share-outline" size={17} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900', marginStart: 7 }}>{t('inv_share')}</Text>
              </View>
            </Pressable>
            {shareMsg ? <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>{shareMsg}</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      {sheet === 'gonow' ? <GoNowSheet onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet === 'talk' ? <StartTalkSheet country={myCode} onClose={() => setSheet(null)} onStarted={(id) => { setSheet(null); setTalkId(id); }} /> : null}
      {talkId ? <TalkRoomSheet roomId={talkId} onClose={() => { setTalkId(null); load(); }} /> : null}
      {sheet === 'start' ? <GreenSheet startNow homeCountry={myCode} onClose={() => { setSheet(null); load(); }} /> : null}
      {reportingPhoto ? <ReportSheet contentType="plan_photo" contentId={reportingPhoto.id} contentLabel={reportingPhoto.label} onClose={() => setReportingPhoto(null)} /> : null}
      {sheet === 'green' ? <GreenSheet homeCountry={myCode} onClose={() => { setSheet(null); load(); }} /> : null}
      {sheet === 'prog' ? <ProgrammesSheet onClose={() => setSheet(null)} onOpenGroup={(id) => setSheet({ group: id })} /> : null}
      {sheet === 'landing' ? <LandingSheet country={myCode} onClose={() => setSheet(null)} /> : null}
      {sheet && sheet.group ? <GroupPage groupId={sheet.group} onClose={() => setSheet(null)} /> : null}
    </View>
  );
};
