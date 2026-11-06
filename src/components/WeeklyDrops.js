import React, { useEffect, useRef, useState } from 'react';
import { everySeen } from '../lib/everySeen';
import { View, Text, Pressable, Modal, ActivityIndicator, Linking, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { mv } from '../constants/mvpWords';
import { dropsList, dropClaim, dropWait, dropCancel, tripWithdraw, myQuota, circleNow, circleVote, circleEnter, circleTestEnter, circleTopicTurn, circleShuffle } from '../services/mvp';
import { circleTopic } from '../constants/circleTopics';
import { askUpgrade, askSafety } from '../services/membership';
import { askCard } from '../services/card';
import { isSaving } from '../lib/dataSaver';
import { getPrefs } from '../services/prefs';
import { joinMesh } from '../lib/talkMesh';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { dropClip } from '../lib/mediaFit';
import { SeatPill } from './SeatPill';
import { readPlan } from '../lib/feedGate';
import { jw } from '../constants/joinWords';
import { useSheetBack } from '../hooks/useSheetBack';
import { tcw as tbw, lookFor } from '../constants/tableCore';
import { FlagBadge } from './TableFlag';
import { supabase, SUPABASE_READY } from '../lib/supabase';
import { showOnMap, goToTab } from '../lib/mapBus';

/* a Google Maps link carries its spot: …/@30.06,31.22 · ?q=30.06,31.22 · !3d30.06!4d31.22 */
const pointOf = (u) => {
  const s = String(u || '');
  const m = s.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/) || s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};
/* the weekend: Thursday, Friday, Saturday in Cairo */
const weekendDay = (at) => { try { const w = new Date(at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Africa/Cairo' }); return w === 'Thu' || w === 'Fri' || w === 'Sat'; } catch (e) { return false; } };
const copyText = async (txt) => { try { await navigator.clipboard.writeText(txt); return true; } catch (e) { return false; } };
const WhatsAppBook = lazyOverlay(() => import('./WhatsAppBook').then((m) => ({ default: m.WhatsAppBook })));

/* Ayser, November 2026: Roam waits as Coming Soon until the Studio opens it
   (app setting roam_open; drop_claim answers 'soon' meanwhile) */
let roamOpen = null;
const readRoamOpen = () => (!SUPABASE_READY ? Promise.resolve(false) : roamOpen != null ? Promise.resolve(roamOpen)
  : supabase.from('app_settings').select('value').eq('key', 'roam_open').maybeSingle()
    .then(({ data }) => { roamOpen = !!(data && data.value === true); return roamOpen; }, () => false));

const EventRoom = lazyOverlay(() => import('./LiveKit').then((m) => ({ default: m.EventRoom })));

/* ─── THE FINAL MVP ON THE HOME SCREEN ────────────────────────────────
   Ayser: "Freemium to browse, paid to act". Two things, nothing else:
   the week's Language Circle (vote, then a countdown, then 30 minutes of
   voice) and the week's Drops (two or three tables made by the team, a
   seat counter, the café kept until 12 hours before). Anybody sees and
   votes; claiming a seat or entering the circle is for members — a free
   account gets the plans at that tap. Black and white only. */

const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
const clock = (ms, lang) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = pad(Math.floor((s % 86400) / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  return (d ? d + (lang === 'ar' ? ' يوم  ' : 'd  ') : '') + hms;
};
const when = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'long', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
};
// "20h", "2d 4h", "35 min" — a countdown to read, not to watch
const rel = (ms, lang) => {
  const m = Math.max(1, Math.round(ms / 60000));
  const ar = lang === 'ar';
  if (m < 60) return m + (ar ? ' دقيقة' : ' min');
  const h = Math.round(m / 60);
  if (h < 24) return h + (ar ? ' ساعة' : 'h');
  const d = Math.floor(h / 24), r = h % 24;
  return d + (ar ? ' يوم' : 'd') + (r ? (ar ? ' و' + r + ' ساعة' : ' ' + r + 'h') : '');
};
const short = (iso, lang) => {
  try { return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
};
const useTick = (ms) => { const [k, n] = useState(0); useEffect(() => { const t = setInterval(() => n((x) => x + 1), ms); return () => clearInterval(t); }, [ms]); return k; };

const Card = ({ children, style }) => (
  <View style={[{ borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 18, marginTop: 14 }, style]}>{children}</View>
);
// small capitals; Arabic gets no letter-spacing (it pulls the joined letters apart)
const Small = ({ children, style }) => {
  const { lang } = useLang();
  return <Text style={[{ color: C.dim, fontSize: 11.5, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.2 }, style]}>{children}</Text>;
};
const Btn = ({ label, onPress, solid = true, busy }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginTop: 16 }}>
    {({ pressed }) => (
      <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: solid ? (pressed ? C.dim : C.text) : 'transparent', borderWidth: solid ? 0 : 1, borderColor: C.text }}>
        {busy ? <ActivityIndicator color={solid ? C.bg : C.text} /> : <Text style={{ color: solid ? C.bg : C.text, fontSize: 15.5, fontWeight: '700' }}>{label}</Text>}
      </View>
    )}
  </Pressable>
);

/* ── the month's credits: one quiet line (also on the profile) ── */
export const QuotaLine = ({ q: given, style }) => {
  const { lang } = useLang();
  const [q, setQ] = useState(given || null);
  useEffect(() => { if (given) setQ(given); else myQuota().then(setQ); }, [given]);
  if (!q || q.tier === 'FREE') return null;
  const dl = Math.max(0, (q.drops_cap || 0) - (q.drops_used || 0));
  const cl = q.circles_cap == null ? null : Math.max(0, q.circles_cap - (q.circles_used || 0));
  return (
    <View style={style}>
      <Text style={[{ color: C.text, fontSize: 13.5 }, NUM]}>{mv(lang, 'qDrops', { n: dl, m: q.drops_cap || 0 })}</Text>
      <Text style={[{ color: C.dim, fontSize: 13, marginTop: 3 }, NUM]}>{cl == null ? mv(lang, 'qUnl') : mv(lang, 'qCircles', { n: cl, m: q.circles_cap })}</Text>
    </View>
  );
};

/* ── TODAY'S TOPIC (Ayser, November 2026) ── one question for the whole
   circle; the team can shuffle it, and every phone follows within seconds */
const TOPIC_W = { en: ["TODAY'S TOPIC", 'Shuffle topic', 'Today: '], ar: ['توبيك النهارده', 'اقتراح توبيك تاني', 'النهارده: '] };
const TopicCard = ({ id, lang, compact }) => {
  const [t, setT] = useState(null);
  const [busy, setBusy] = useState(false);
  const L = TOPIC_W[lang === 'ar' ? 'ar' : 'en'];
  useEffect(() => {
    let alive = true;
    const get = () => circleTopicTurn(id).then((x) => { if (alive && x) setT(x); });
    get();
    const h = compact ? null : everySeen(get, 12000);
    return () => { alive = false; if (h) clearInterval(h); };
  }, [id, compact]);
  const q = circleTopic(id, t ? t.turn : 0, lang);
  if (compact) {
    return (
      <Text testID="circle-topic-line" style={{ color: C.text, fontSize: 13.5, lineHeight: 19, marginTop: 8 }} numberOfLines={2}>
        <Text style={{ fontWeight: '800' }}>{'✦ ' + L[2]}</Text>{q}
      </Text>
    );
  }
  const shuffle = async () => {
    if (busy) return;
    tapLight(); setBusy(true);
    const r = await circleShuffle(id);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setT((x) => ({ ...(x || {}), turn: r.turn })); }
  };
  return (
    <View testID="circle-topic" style={{ alignSelf: 'stretch', marginTop: 14, borderRadius: 24, padding: 20, backgroundColor: '#EFEBF9', borderWidth: 1, borderColor: '#D8CFF0' }}>
      <Text style={{ color: '#5B4B8A', fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{'✦ ' + L[0]}</Text>
      <Text style={{ color: '#18181B', fontSize: 22, fontWeight: '700', lineHeight: 30, marginTop: 8, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined }}>{q}</Text>
      {t && t.can_shuffle ? (
        <Pressable testID="circle-shuffle" onPress={shuffle} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
            <Ionicons name="shuffle" size={15} color={C.ink} />
            <Text style={{ color: C.ink, fontSize: 13.5, fontWeight: '800', marginStart: 6 }}>{L[1]}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

/* ── the 30-minute room ── */
const CircleRoom = ({ room, lang, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const skew = useRef(Date.parse(room.now) - Date.now());       // the server's clock, not the phone's
  const [people, setPeople] = useState(room.people || []);
  const [voice, setVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const mesh = useRef(null);
  useSheetBack(onClose);
  useTick(1000);
  const left = Date.parse(room.ends_at) - (Date.now() + skew.current);
  const over = left <= 0;
  useEffect(() => {
    const t = room.test ? null : everySeen(() => circleEnter(room.id).then((r) => r && r.ok && setPeople(r.people || [])), 10000);
    return () => { if (t) clearInterval(t); if (mesh.current) { mesh.current.close(); mesh.current = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (over && mesh.current) { mesh.current.close(); mesh.current = null; setVoice(false); tapMedium(); } }, [over]);
  const talk = async () => {
    tapMedium();
    const m = await joinMesh({ topic: room.topic, me: { id: user.id, name: '' }, onPeople: () => {}, onError: () => {} });
    if (m) { mesh.current = m; setVoice(true); }
  };
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
          <Ionicons name="chevron-down" size={26} color={C.text} />
        </Pressable>
        {over ? (
          /* the hook: the room closes, the table opens */
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -1 }}>{mv(lang, 'cDoneT')}</Text>
            <Text style={{ color: C.dim, fontSize: 17, lineHeight: 25, marginTop: 10 }}>{mv(lang, 'cDoneS')}</Text>
            <Btn label={mv(lang, 'cBook')} onPress={() => { tapLight(); onClose(true); }} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center' }}>
            {room.test ? <Small style={{ marginBottom: 10 }}>{lang === 'ar' ? 'أوضة تجربة · للفريق بس' : 'TEST ROOM · TEAM ONLY'}</Small> : null}
            <TopicCard id={room.id} lang={lang} />
            <Text style={[{ color: C.text, fontSize: 48, fontWeight: '300', letterSpacing: 2, marginTop: 22 }, NUM]}>{clock(left, lang)}</Text>
            <Small style={{ marginTop: 10 }}>{mv(lang, 'cLeft30')}</Small>
            <Text style={[{ color: C.dim, fontSize: 15, marginTop: 28 }, NUM]}>{mv(lang, 'cPeople', { n: people.length })}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
              {people.slice(0, 12).map((p) => (
                <View key={p.id} style={{ alignItems: 'center', width: 76, marginBottom: 12 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.line, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 18, fontWeight: '600' }}>{(p.name || '?').trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={{ color: C.dim, fontSize: 12, marginTop: 5 }} numberOfLines={1}>{(p.name || '').split(' ')[0]}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            {voice ? (
              <View style={{ flexDirection: 'row' }}>
                <Pressable onPress={() => { tapLight(); const m = !muted; setMuted(m); if (mesh.current) mesh.current.setMuted(m); }} accessibilityRole="button" style={{ alignItems: 'center', marginHorizontal: 18 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? 'transparent' : C.text, borderWidth: 1, borderColor: C.text }}>
                    <Ionicons name={muted ? 'mic-off' : 'mic'} size={28} color={muted ? C.text : C.bg} />
                  </View>
                  <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{mv(lang, muted ? 'cUnmute' : 'cMute')}</Text>
                </Pressable>
                <Pressable onPress={() => { tapLight(); if (mesh.current) { mesh.current.close(); mesh.current = null; } setVoice(false); onClose(); }} accessibilityRole="button" style={{ alignItems: 'center', marginHorizontal: 18 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}>
                    <Ionicons name="close" size={28} color={C.text} />
                  </View>
                  <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{mv(lang, 'cLeave')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignSelf: 'stretch' }}><Btn label={mv(lang, 'cTalk')} onPress={talk} /></View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

/* ── the week's Language Circle: vote → countdown → 30 minutes ── */
/* Ayser, November 2026: "فين سيركل الإنجليزي الأونلاين؟" — say where it happens */
const OnlineLine = ({ lang }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
    <Ionicons name="mic-outline" size={14} color={C.text} />
    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '600', marginStart: 5, flex: 1 }}>
      {lang === 'ar' ? 'أونلاين هنا على Moments — أوضة صوت ٣٠ دقيقة بتفتح هنا في المعاد' : 'Online, here on Moments — a 30-minute voice room that opens right here on time'}
    </Text>
  </View>
);

export const CircleCard = ({ onShowDrops }) => {
  const { lang } = useLang();
  const [team, setTeam] = useState(false);   // the server says (circle_topic → can_shuffle), not the phone
  const [c, setC] = useState(null);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const skew = useRef(0);
  const load = () => circleNow('en').then((x) => { if (x && x.ok) { skew.current = Date.parse(x.now) - Date.now(); setC(x); } });
  useEffect(() => { load(); const t = everySeen(load, 60000); return () => clearInterval(t); }, []);
  const tick = useTick(1000);
  useEffect(() => { if (c && c.id) circleTopicTurn(c.id).then((x) => setTeam(!!(x && x.can_shuffle))).catch(() => {}); }, [c && c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the clock ran past a turn (voting closed, the circle opened or ended): ask again
  const next = c ? (c.state === 'voting' ? c.closes_at : c.state === 'countdown' ? c.opens_at : c.state === 'open' ? c.ends_at : null) : null;
  const asked = useRef(null);
  useEffect(() => {
    if (next && asked.current !== next && Date.now() + skew.current >= Date.parse(next) + 1000) { asked.current = next; load(); }
  }, [tick, next]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const now = Date.now() + skew.current;

  const vote = async (i) => {
    tapLight();
    setC((x) => ({ ...x, my_vote: i, options: x.options.map((o, k) => ({ ...o, votes: o.votes + (k === i ? 1 : 0) - (k === x.my_vote ? 1 : 0) })) }));
    await circleVote(c.id, i); load();
  };
  const testRoom = async () => {
    tapMedium();
    const r = await circleTestEnter(c.id);
    if (r && r.ok) setRoom({ ...r, id: c.id });
    else setNote(lang === 'ar' ? 'دي للفريق بس.' : 'This is for the team only.');
  };
  const enter = async () => {
    tapMedium(); setBusy(true); setNote(null);
    const r = await circleEnter(c.id);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setRoom({ ...r, id: c.id }); load(); return; }
    if (r && r.reason === 'plus') { askUpgrade('member'); return; }
    if (r && r.reason === 'quota') { setNote(mv(lang, 'quotaOut')); return; }
    load();
  };

  return (
    <Card style={{ padding: 16 }}>
      {c.state !== 'ended' ? <View style={{ marginTop: -8, marginBottom: 10 }}><TopicCard id={c.id} lang={lang} compact /></View> : null}
      {c.state === 'voting' && (c.my_vote == null || editing) ? (
        <>
          <Small>{mv(lang, 'cName').toUpperCase()}</Small>
          <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 4 }}>{mv(lang, 'cPick')}</Text>
          <OnlineLine lang={lang} />
          <View style={{ flexDirection: 'row', marginTop: 12, marginHorizontal: -4 }}>
            {(c.options || []).map((o, i) => {
              const mine = c.my_vote === i;
              return (
                <Pressable key={o.at} onPress={() => { setEditing(false); vote(i); }} accessibilityRole="radio" accessibilityState={{ checked: mine }} style={{ flex: 1, marginHorizontal: 4 }}>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: mine ? C.text : C.line, backgroundColor: mine ? C.text : 'transparent', paddingVertical: 11, alignItems: 'center' }}>
                    <Text style={{ color: mine ? C.bg : C.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{short(o.at, lang)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : c.state === 'voting' ? (
        /* voted: one line, and a way to change it */
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{mv(lang, 'cName')}</Text>
            <Text style={[{ color: C.dim, fontSize: 13, marginTop: 3 }, NUM]} numberOfLines={1}>{mv(lang, 'cMine') + ' · ' + short(c.options[c.my_vote].at, lang)}</Text>
            <Text style={[{ color: C.faint, fontSize: 12, marginTop: 2 }, NUM]} numberOfLines={1}>{mv(lang, 'cRes', { t: rel(Date.parse(c.closes_at) - now, lang) })}</Text>
            <OnlineLine lang={lang} />
          </View>
          <Pressable onPress={() => { tapLight(); setEditing(true); }} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '600', textDecorationLine: 'underline' }}>{mv(lang, 'cChange')}</Text>
          </Pressable>
        </View>
      ) : c.state === 'countdown' ? (
        <View>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{mv(lang, 'cName')}</Text>
          <Text style={[{ color: C.dim, fontSize: 13, marginTop: 3 }, NUM]}>{mv(lang, 'cIn', { d: short(c.opens_at, lang), t: rel(Date.parse(c.opens_at) - now, lang) })}</Text>
          <OnlineLine lang={lang} />
        </View>
      ) : c.state === 'open' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.text, marginEnd: 8 }} />
            <Small style={{ color: C.text }}>{mv(lang, 'cOpen').toUpperCase()}</Small>
          </View>
          <Text style={[{ color: C.text, fontSize: 40, fontWeight: '300', letterSpacing: 1, marginTop: 8 }, NUM]}>{clock(Date.parse(c.ends_at) - now, lang)}</Text>
          <Text style={[{ color: C.dim, fontSize: 14, marginTop: 6 }, NUM]}>{mv(lang, 'cPeople', { n: c.people || 0 })}</Text>
          <Btn label={mv(lang, 'cEnter')} onPress={enter} busy={busy} />
          {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 10 }}>{note}</Text> : null}
        </>
      ) : (
        <Text style={{ color: C.dim, fontSize: 14.5 }}>{mv(lang, 'cEnded')}</Text>
      )}
      {/* the team can hear the room before the real time (RUN_ME.sql · A TEST CIRCLE) */}
      {team && c.state !== 'open' ? (
        <Pressable testID="circle-test" onPress={testRoom} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
          <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '600', textDecorationLine: 'underline' }}>{lang === 'ar' ? 'الفريق: جرّب الأوضة دلوقتي' : 'Team: try the room now'}</Text>
        </Pressable>
      ) : null}
      {note && c.state !== 'open' ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{note}</Text> : null}
      {room ? <CircleRoom room={room} lang={lang} onClose={(toDrops) => { setRoom(null); load(); if (toDrops && onShowDrops) onShowDrops(); }} /> : null}
    </Card>
  );
};

/* ── one Drop ── */
const Seats = ({ taken, seats }) => (
  <View style={{ flexDirection: 'row', marginTop: 14 }}>
    {Array.from({ length: seats }).map((_, i) => (
      <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, marginEnd: i < seats - 1 ? 4 : 0, backgroundColor: i < taken ? C.text : C.line }} />
    ))}
  </View>
);

/* the confirmation: the seat, and what is left this month */
const Confirmed = ({ q, place, at, lang, onClose }) => {
  useSheetBack(onClose);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <View style={{ borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, padding: 24 }}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{'✓  ' + mv(lang, 'confirmed').toUpperCase()}</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '700', marginTop: 10 }}>{place}</Text>
          <Text style={{ color: C.text, fontSize: 15, marginTop: 4 }}>{when(at, lang)}</Text>
          <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 10 }}>{mv(lang, 'reveal')}</Text>
          {q && q.to_pay ? <Text style={[{ color: C.text, fontSize: 14, fontWeight: '600', marginTop: 8 }, NUM]}>{mv(lang, 'toPay', { p: money(q.to_pay, q.currency, lang) })}</Text> : null}
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 16 }} />
          <QuotaLine q={q} />
          <Btn label={mv(lang, 'ok')} onPress={onClose} />
        </View>
      </Pressable>
    </Modal>
  );
};

/* ── THE FOUR PILLARS ── (RUN_ME.sql, "FOUR PILLARS") one kind per Drop */
const CATS = ['tables', 'culture', 'impact', 'roam'];
const catWord = (lang, c) => mv(lang, 'cat' + c.charAt(0).toUpperCase() + c.slice(1));
const money = (n, cur, lang) => {
  if (n == null) return '';
  const v = Math.round(Number(n)).toLocaleString('en');
  return lang === 'ar' && (cur || 'EGP') === 'EGP' ? v + ' جنيه' : (cur || 'EGP') + ' ' + v;
};

/* five seconds of a past evening, silent, round and round — never on data
   saver, and a still (or nothing) until it really plays */
const LoopVideo = ({ uri }) => {
  const [on, setOn] = useState(false);
  if (Platform.OS !== 'web' || !uri || isSaving((getPrefs() || {}).dataSaver)) return null;
  return (
    <video src={uri} muted autoPlay loop playsInline preload="metadata" aria-hidden="true"
      onPlaying={() => setOn(true)}
      onTimeUpdate={(e) => { const v = e.currentTarget; if (v.currentTime > 5) v.currentTime = 0; }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 0.55 : 0, transition: 'opacity 500ms', pointerEvents: 'none' }} />
  );
};

const DropCard = ({ d, lang, onChanged }) => {
  const { user } = useAuth() || {};
  const [roamOk, setRoamOk] = useState(roamOpen);
  useEffect(() => { if (d.category === 'roam' && roamOk == null) readRoamOpen().then(setRoamOk); }, [d.category]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [done, setDone] = useState(null);       // the confirmation, with what is left this month
  const [room, setRoom] = useState(false);
  const [why, setWhy] = useState(false);          // a trip's level, explained
  const seats = d.seats || 6;
  const taken = Math.min(seats, d.taken || 0);
  const full = taken >= seats;
  const queued = d.state === 'queued' && !d.mine;            // one spotlight at a time (RUN_ME.sql drop_states)
  const hot = !full && !queued && seats > 0 && taken / seats >= 0.8;
  const place = lang === 'ar' && d.neighborhood_ar ? d.neighborhood_ar : d.neighborhood;
  const vibe = lang === 'ar' && d.vibe_ar ? d.vibe_ar : d.vibe;

  const claim = async () => {
    tapMedium(); setBusy(true); setNote(null);
    const r = await dropClaim(d.id);
    setBusy(false);
    if (r && r.ok && r.applied) { tapSuccess(); onChanged(); return; }
    if (r && r.ok) { tapSuccess(); setDone({ ...(r.quota || {}), to_pay: r.to_pay, currency: r.currency }); onChanged(); return; }
    const why = r && r.reason;
    if (why === 'level') { setNote(mv(lang, 'needLevel', { l: r.need })); setWhy(true); return; }
    if (why === 'verify') { askSafety(); return; }
    if (why === 'card') { askCard(); return; }
    if (why === 'soon') { roamOpen = false; setRoamOk(false); return; }
    if (why === 'plus') { askUpgrade('member'); return; }
    setNote(why === 'quota' ? mv(lang, 'quotaOut') : why === 'active' ? mv(lang, 'active') : why === 'queued' ? tbw(lang, 'queued') : null);
    if (why === 'full' || why === 'queued') onChanged();
  };
  const wait = async () => {
    tapLight(); setBusy(true);
    const r = await dropWait(d.id, !d.waiting);
    setBusy(false);
    if (r && r.reason === 'verify') { askSafety(); return; }
    if (r && r.reason === 'plus') { askUpgrade('member'); return; }
    onChanged();
  };
  const giveBack = async () => { tapLight(); setBusy(true); await dropCancel(d.my_offer || d.id); setBusy(false); onChanged(); };

  const cat = CATS.includes(d.category) ? d.category : 'tables';
  return (
    <Card style={{ overflow: 'hidden', opacity: queued ? 0.88 : 1 }}>
      <LoopVideo uri={dropClip(d)} />
      {/* the kind, crisp and small, top-left: [ CULTURE ] */}
      <Text style={{ color: C.text, fontSize: 11, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{'[ ' + catWord(lang, cat).toUpperCase() + ' ]'}</Text>
      {vibe && vibe.toUpperCase() !== catWord(lang, cat).toUpperCase() ? <Small style={{ marginTop: 8 }}>{vibe.toUpperCase()}</Small> : null}
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.5, marginTop: 8 }}>{place}</Text>
      <Text style={{ color: C.text, fontSize: 15, marginTop: 4 }}>{when(d.starts_at, lang)}</Text>
      {/* a trip (Ayser: the velvet rope, not a discount): one price, and who it is for */}
      {cat === 'roam' ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: C.text, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1 }}>
              {(d.min_level ? mv(lang, 'mOnlyLvl', { n: seats, l: d.min_level }) : mv(lang, 'mOnly', { n: seats })).toUpperCase()}
            </Text>
          </View>
          {d.price ? <Text style={[{ color: C.text, fontSize: 15, fontWeight: '600', marginTop: 10 }, NUM]}>{money(d.price, d.currency, lang)}</Text> : null}
          {d.min_level ? (
            <Pressable onPress={() => { tapLight(); setWhy((v) => !v); }} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: C.dim, fontSize: 13 }}>{mv(lang, 'needLevel', { l: d.min_level })}</Text>
              <Ionicons name="information-circle-outline" size={15} color={C.dim} style={{ marginStart: 6 }} />
            </Pressable>
          ) : null}
          {why ? <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 6 }}>{mv(lang, 'levelWhy')}</Text> : null}
        </View>
      ) : null}
      {cat === 'impact' ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 8, lineHeight: 18 }}>{mv(lang, 'impactNote')}</Text> : null}
      {queued ? (
        /* the next Drop waits its turn: it opens by itself at 80% of the one before */
        <View testID="drop-queued" style={{ marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="lock-closed" size={15} color={C.text} style={{ marginTop: 1 }} />
          <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19, flex: 1, marginStart: 8 }}>{tbw(lang, 'queued')}</Text>
        </View>
      ) : (
        <>
          {/* Ayser, November 2026: a curated table says what it is until it is half full; after that, the seats left — never "1 / 20" */}
          {taken / Math.max(1, seats) >= 0.5 ? <Seats taken={taken} seats={seats} /> : null}
          {/* curated · filling fast · sold out — the same pill as every plan card (SeatPill); full has a real waitlist below */}
          <View testID="drop-seats" style={{ marginTop: 10 }}>
            <SeatPill lang={lang} g={{ capacity: seats, going: taken }} waitlist />
          </View>
          {d.table_no > 1 && !d.mine ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{tbw(lang, 'nowTable', { n: d.table_no })}</Text> : null}
        </>
      )}
      {/* your table's flag: what to look for when you walk in */}
      {d.mine && cat !== 'roam' ? (
        <View style={{ marginTop: 12 }}>
          <FlagBadge cat={cat} no={d.my_table} lang={lang} />
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '600', marginTop: 6 }}>{lookFor(lang, cat, d.my_table)}</Text>
        </View>
      ) : null}
      {/* the café: kept until 12 hours before, and only for a confirmed seat */}
      {d.mine && d.venue ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{d.venue.name || ''}</Text>
          {d.venue.map_url ? (
            /* Ayser, November 2026: never out of the app — the Moments map, and a copy of the pin */
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              {pointOf(d.venue.map_url) ? (
                <Pressable testID="drop-on-map" onPress={() => { tapLight(); const pt = pointOf(d.venue.map_url); showOnMap({ ...pt, title: d.venue.name || place }); goToTab('MAP'); }} accessibilityRole="button" hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.purple, paddingHorizontal: 14, paddingVertical: 9, marginEnd: 8 }}>
                  <Ionicons name="map-outline" size={15} color={C.ink} />
                  <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700', marginStart: 6 }}>{lang === 'ar' ? 'شوفها على خريطة مومنتس' : 'View on Moments Map'}</Text>
                </Pressable>
              ) : null}
              <Pressable testID="drop-copy-pin" onPress={async () => { tapLight(); const ok = await copyText(d.venue.map_url); if (ok) { tapSuccess(); setNote(lang === 'ar' ? '✦ لينك المكان اتنسخ!' : '✦ Location link copied!'); } }} accessibilityRole="button" accessibilityLabel={lang === 'ar' ? 'انسخ المكان' : 'Copy pin'} hitSlop={8}
                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.text, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="link-outline" size={17} color={C.text} />
              </Pressable>
            </View>
          ) : null}
          <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>{jw(lang, 'arrive')}</Text>
        </View>
      ) : cat === 'roam' || queued ? null : (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={13} color={C.dim} />
          <Text style={{ color: C.dim, fontSize: 13, marginStart: 6 }}>{mv(lang, 'reveal')}</Text>
        </View>
      )}
      {d.mine ? (
        <>
          <Btn label={mv(lang, 'yours')} solid={false} onPress={() => { tapLight(); setRoom(true); }} />
          <Pressable onPress={giveBack} disabled={busy} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 12.5 }}>{mv(lang, 'give')}</Text>
          </Pressable>
        </>
      ) : cat === 'roam' && !roamOk ? (
        /* Coming Soon: in the pipeline, not bookable yet */
        <View testID="drop-soon" style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 13, backgroundColor: C.line }}>
          <Ionicons name="lock-closed" size={14} color={C.dim} />
          <Text style={{ color: C.dim, fontSize: 14.5, fontWeight: '700', marginStart: 6 }}>{lang === 'ar' ? 'قريبًا' : 'Coming Soon'}</Text>
        </View>
      ) : cat === 'roam' && d.applied === 'pending' ? (
        <>
          <Text style={{ color: C.text, fontSize: 14, marginTop: 14, lineHeight: 20 }}>{mv(lang, 'applied')}</Text>
          <Pressable onPress={async () => { tapLight(); setBusy(true); await tripWithdraw(d.id); setBusy(false); onChanged(); }} disabled={busy} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 12.5 }}>{mv(lang, 'withdraw')}</Text>
          </Pressable>
        </>
      ) : cat === 'roam' && readPlan().tier === 'FREE' ? (
        <Btn label={mv(lang, 'unlockApply')} onPress={() => { tapLight(); askUpgrade('member'); }} />
      ) : cat === 'roam' ? (
        <Btn label={mv(lang, 'applySel')} onPress={claim} busy={busy} />
      ) : queued ? (
        <>
          <Btn label={d.waiting ? tbw(lang, 'interested') : tbw(lang, 'interest')} solid={!d.waiting} onPress={wait} busy={busy} />
        </>
      ) : full ? (
        <Btn label={mv(lang, d.waiting ? 'waiting' : 'wait')} solid={false} onPress={wait} busy={busy} />
      ) : (
        <>
          <Btn label={cat === 'impact' ? jw(lang, 'impact') : mv(lang, 'claim')} onPress={claim} busy={busy} />
          {/* while the gateway waits: book by writing to the team */}
          <WhatsAppBook lang={lang} userId={user && user.id} title={(lang === 'ar' && d.title_ar) || d.title || place || ''} at={d.starts_at} style={{ marginTop: 8 }} />
        </>
      )}
      {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{note}</Text> : null}
      {done ? <Confirmed q={done} place={place} at={d.starts_at} lang={lang} onClose={() => setDone(null)} /> : null}
      {room ? <EventRoom kind="offer" id={d.my_offer || d.id} lang={lang} onClose={() => setRoom(false)} /> : null}
    </Card>
  );
};


/* ─── THE WEEKEND DROP CYCLE ──────────────────────────────────────────
   Ayser, November 2026: tables happen Thursday to Saturday. From Sunday
   to Wednesday the top of Together counts down to Thursday night and
   points the evenings at the online English Circle. Cairo time. */
const cairoParts = (now = new Date()) => {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false });
    const o = {}; f.formatToParts(now).forEach((x) => { o[x.type] = x.value; });
    return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute };
  } catch (e) { return null; }
};
export const nextThursdayAt7 = (now = new Date()) => {
  const p = cairoParts(now);
  if (!p) return null;
  const offH = Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - now.getTime()) / 3600e3);   // Cairo's offset today (+2 or +3)
  const days = (4 - p.dow + 7) % 7;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days, 19 - offH, 0));
};
const WeekendBanner = ({ lang }) => {
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(h); }, []);
  const p = cairoParts();
  if (!p || p.dow < 0 || p.dow > 3) return null;          // Sunday–Wednesday only
  const at = nextThursdayAt7();
  const ms = at ? at.getTime() - Date.now() : 0;
  if (!(ms > 0)) return null;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  const AR = (x) => (lang === 'ar' ? String(x).replace(/\d/g, (c) => '٠١٢٣٤٥٦٧٨٩'[c]) : String(x));
  /* Arabic: words, never one letter after a digit — "١ي" read as "اي" (Ayser, November 2026) */
  const left = lang === 'ar' ? [d ? AR(d) + ' يوم' : null, AR(h) + ' ساعة', AR(m) + ' دقيقة'].filter(Boolean).join('  ') : d + 'd ' + h + 'h ' + m + 'm';
  return (
    <View testID="weekend-banner" style={{ borderRadius: 18, backgroundColor: '#17131F', padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="hourglass-outline" size={16} color="#D9C08C" />
        <Text style={{ color: '#D9C08C', fontSize: 11.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.3, marginStart: 6 }}>{lang === 'ar' ? 'عدّاد ويك إند الدروب' : 'WEEKEND DROP COUNTDOWN'}</Text>
      </View>
      <Text style={[{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 6 }, NUM]}>{left}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18, marginTop: 4 }}>
        {lang === 'ar' ? 'الترابيزات من الخميس بالليل للسبت. احجز كرسيك بدري — ولحد ساعتها، دايرة الإنجليزي أونلاين كل ليلة.' : 'Tables run Thursday night to Saturday. Claim your seat early — and until then, the Online English Circle every evening.'}
      </Text>
    </View>
  );
};

export const DropsSection = ({ max = 3, only = null, onCount, onSpot }) => {
  const { lang } = useLang();
  const [list, setList] = useState(null);
  const [cat, setCat] = useState(only || 'all');
  const load = () => dropsList().then((x) => setList(Array.isArray(x) ? x : []));
  useEffect(() => { load(); }, []);
  // the page around one kind (Green Minds) needs to know if there is anything, so it never says "nothing yet" over a real day
  useEffect(() => {
    if (!onCount || !list) return;
    onCount(list.filter((d) => !only || (d.category || 'tables') === only).length);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  // Together asks: is a Drop this weekend's one table? (then no plan is put in the spotlight next to it)
  const spotN = (list || []).filter((d) => d.state !== 'queued' && (d.mine || (d.category || 'tables') === 'roam' || weekendDay(d.starts_at))).length ? 1 : 0;
  useEffect(() => { if (onSpot) onSpot(spotN); }, [spotN]); // eslint-disable-line react-hooks/exhaustive-deps
  // no Drops this week: only the weekend countdown (Sunday–Wednesday), never a line saying "nothing"
  if (!list || !list.length) return only ? null : <View style={{ marginTop: 22 }}><WeekendBanner lang={lang} /></View>;
  // the open Drops first (yours, then the spotlight), then the ones waiting their turn
  const rank = (d) => (d.mine ? 0 : d.state === 'queued' ? 2 : 1);
  const all = list.filter((d) => cat === 'all' || (d.category || 'tables') === cat)
    .sort((a, b) => rank(a) - rank(b) || String(a.starts_at).localeCompare(String(b.starts_at)));
  /* Ayser, November 2026: one weekend, full tables — Thursday to Saturday, the trip, and yours in the spotlight;
     everything else waits in one small row, so people are not spread thin over six half-empty tables */
  const spot = (d) => d.mine || (d.category || 'tables') === 'roam' || (d.state !== 'queued' && weekendDay(d.starts_at));
  const shown = all.filter(spot).slice(0, max);
  const later = all.filter((d) => !shown.includes(d)).slice(0, 8);
  if (only && !shown.length) return null;   // one kind asked for, none this week: nothing, never an empty card
  return (
    <View style={{ marginTop: only ? 0 : 22, marginBottom: only ? 14 : 0 }}>
      {only ? null : <WeekendBanner lang={lang} />}
      {only ? null : <Small>{mv(lang, 'drops').toUpperCase()}</Small>}
      {/* the four pillars: All · Tables · Culture · Impact · Roam */}
      {only ? null : <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
        {['all'].concat(CATS).map((k) => {
          const on = cat === k;
          return (
            <Pressable key={k} onPress={() => { tapLight(); setCat(k); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ marginEnd: 6 }}>
              <View style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : 'transparent', paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '600' }}>{k === 'all' ? mv(lang, 'catAll') : catWord(lang, k)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>}
      {shown.length ? shown.map((d) => <DropCard key={d.id} d={d} lang={lang} onChanged={load} />)
        : !later.length ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 14 }}>{mv(lang, 'empty')}</Text> : null}
      {later.length ? (
        <View testID="drops-queue" style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={13} color={C.dim} />
            <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700', marginStart: 6 }}>{lang === 'ar' ? 'في الطابور (بتفتح لما الترابيزة اللي قبلها تتملي)' : 'Queueing next (opens when the current table fills)'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 8 }}>
            {later.map((d) => (
              <View key={d.id} style={{ width: 170, marginEnd: 8, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12, backgroundColor: C.glass }}>
                <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : 1.2 }}>{catWord(lang, CATS.includes(d.category) ? d.category : 'tables').toUpperCase()}</Text>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{lang === 'ar' && d.neighborhood_ar ? d.neighborhood_ar : d.neighborhood}</Text>
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{when(d.starts_at, lang)}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};
