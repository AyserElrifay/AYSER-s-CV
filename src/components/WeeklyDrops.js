import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Linking, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { mv } from '../constants/mvpWords';
import { dropsList, dropClaim, dropWait, dropCancel, tripWithdraw, myQuota, circleNow, circleVote, circleEnter } from '../services/mvp';
import { askUpgrade, askSafety } from '../services/membership';
import { isSaving } from '../lib/dataSaver';
import { getPrefs } from '../services/prefs';
import { joinMesh } from '../lib/talkMesh';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { dropClip } from '../lib/mediaFit';
import { readPlan } from '../lib/feedGate';
import { jw } from '../constants/joinWords';
import { useSheetBack } from '../hooks/useSheetBack';
import { tcw as tbw, lookFor } from '../constants/tableCore';
import { FlagBadge } from './TableFlag';

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
    const t = setInterval(() => circleEnter(room.id).then((r) => r && r.ok && setPeople(r.people || [])), 10000);
    return () => { clearInterval(t); if (mesh.current) { mesh.current.close(); mesh.current = null; } };
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
            <Text style={[{ color: C.text, fontSize: 56, fontWeight: '300', letterSpacing: 2, marginTop: 30 }, NUM]}>{clock(left, lang)}</Text>
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
export const CircleCard = ({ onShowDrops }) => {
  const { lang } = useLang();
  const [c, setC] = useState(null);
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const skew = useRef(0);
  const load = () => circleNow('en').then((x) => { if (x && x.ok) { skew.current = Date.parse(x.now) - Date.now(); setC(x); } });
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const tick = useTick(1000);
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
      {c.state === 'voting' && (c.my_vote == null || editing) ? (
        <>
          <Small>{mv(lang, 'cName').toUpperCase()}</Small>
          <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 4 }}>{mv(lang, 'cPick')}</Text>
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
          </View>
          <Pressable onPress={() => { tapLight(); setEditing(true); }} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '600', textDecorationLine: 'underline' }}>{mv(lang, 'cChange')}</Text>
          </Pressable>
        </View>
      ) : c.state === 'countdown' ? (
        <View>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{mv(lang, 'cName')}</Text>
          <Text style={[{ color: C.dim, fontSize: 13, marginTop: 3 }, NUM]}>{mv(lang, 'cIn', { d: short(c.opens_at, lang), t: rel(Date.parse(c.opens_at) - now, lang) })}</Text>
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
      {vibe ? <Small style={{ marginTop: 8 }}>{vibe.toUpperCase()}</Small> : null}
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
          <Seats taken={taken} seats={seats} />
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <Text style={[{ color: C.text, fontSize: 13.5, fontWeight: '600' }, NUM]}>
              {(d.table_no > 1 ? tbw(lang, 'tableN', { n: d.table_no }) + '  ·  ' : '') + mv(lang, 'claimed', { n: taken, m: seats }) + '  —  ' + (full ? mv(lang, 'full') : mv(lang, 'left', { n: seats - taken }))}
            </Text>
            {/* the last seats, said out loud */}
            {hot ? (
              <View testID="drop-hot" style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.text, paddingHorizontal: 10, paddingVertical: 4, marginStart: 8 }}>
                <Ionicons name="flame" size={12} color={C.bg} />
                <Text style={{ color: C.bg, fontSize: 11.5, fontWeight: '800', marginStart: 4 }}>{seats - taken === 1 ? tbw(lang, 'lastSeat') : tbw(lang, 'lastSeats', { n: seats - taken })}</Text>
              </View>
            ) : null}
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
            <Pressable onPress={() => { tapLight(); Linking.openURL(d.venue.map_url).catch(() => {}); }} accessibilityRole="link" hitSlop={8}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.text, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 }}>
              <Ionicons name="location-outline" size={15} color={C.text} />
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginHorizontal: 6 }}>{mv(lang, 'map')}</Text>
            </Pressable>
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
        <Btn label={cat === 'impact' ? jw(lang, 'impact') : mv(lang, 'claim')} onPress={claim} busy={busy} />
      )}
      {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{note}</Text> : null}
      {done ? <Confirmed q={done} place={place} at={d.starts_at} lang={lang} onClose={() => setDone(null)} /> : null}
      {room ? <EventRoom kind="offer" id={d.my_offer || d.id} lang={lang} onClose={() => setRoom(false)} /> : null}
    </Card>
  );
};

export const DropsSection = ({ max = 3, only = null }) => {
  const { lang } = useLang();
  const [list, setList] = useState(null);
  const [cat, setCat] = useState(only || 'all');
  const load = () => dropsList().then((x) => setList(Array.isArray(x) ? x : []));
  useEffect(() => { load(); }, []);
  // no Drops this week: nothing on Home, rather than a line saying so
  if (!list || !list.length) return null;
  // the open Drops first (yours, then the spotlight), then the ones waiting their turn
  const rank = (d) => (d.mine ? 0 : d.state === 'queued' ? 2 : 1);
  const shown = list.filter((d) => cat === 'all' || (d.category || 'tables') === cat)
    .sort((a, b) => rank(a) - rank(b) || String(a.starts_at).localeCompare(String(b.starts_at))).slice(0, max);
  if (only && !shown.length) return null;   // one kind asked for, none this week: nothing, never an empty card
  return (
    <View style={{ marginTop: 22 }}>
      <Small>{only ? catWord(lang, only).toUpperCase() : mv(lang, 'drops').toUpperCase()}</Small>
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
        : <Text style={{ color: C.dim, fontSize: 14, marginTop: 14 }}>{mv(lang, 'empty')}</Text>}
    </View>
  );
};
