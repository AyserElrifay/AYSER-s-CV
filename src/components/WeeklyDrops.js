import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { mv } from '../constants/mvpWords';
import { dropsList, dropClaim, dropWait, dropCancel, myQuota, circleNow, circleVote, circleEnter } from '../services/mvp';
import { askUpgrade } from '../services/membership';
import { joinMesh } from '../lib/talkMesh';
import { lazyOverlay } from '../lib/lazyScreen';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

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
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 16 }} />
          <QuotaLine q={q} />
          <Btn label={mv(lang, 'ok')} onPress={onClose} />
        </View>
      </Pressable>
    </Modal>
  );
};

const DropCard = ({ d, lang, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [done, setDone] = useState(null);       // the confirmation, with what is left this month
  const [room, setRoom] = useState(false);
  const seats = d.seats || 6;
  const taken = Math.min(seats, d.taken || 0);
  const full = taken >= seats;
  const place = lang === 'ar' && d.neighborhood_ar ? d.neighborhood_ar : d.neighborhood;
  const vibe = lang === 'ar' && d.vibe_ar ? d.vibe_ar : d.vibe;

  const claim = async () => {
    tapMedium(); setBusy(true); setNote(null);
    const r = await dropClaim(d.id);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setDone(r.quota || {}); onChanged(); return; }
    const why = r && r.reason;
    if (why === 'plus') { askUpgrade('member'); return; }
    setNote(why === 'quota' ? mv(lang, 'quotaOut') : why === 'active' ? mv(lang, 'active') : null);
    if (why === 'full') onChanged();
  };
  const wait = async () => {
    tapLight(); setBusy(true);
    const r = await dropWait(d.id, !d.waiting);
    setBusy(false);
    if (r && r.reason === 'plus') { askUpgrade('member'); return; }
    onChanged();
  };
  const giveBack = async () => { tapLight(); setBusy(true); await dropCancel(d.id); setBusy(false); onChanged(); };

  return (
    <Card>
      {vibe ? <Small>{vibe.toUpperCase()}</Small> : null}
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.5, marginTop: vibe ? 8 : 0 }}>{place}</Text>
      <Text style={{ color: C.text, fontSize: 15, marginTop: 4 }}>{when(d.starts_at, lang)}</Text>
      <Seats taken={taken} seats={seats} />
      <Text style={[{ color: C.text, fontSize: 13.5, fontWeight: '600', marginTop: 10 }, NUM]}>
        {mv(lang, 'claimed', { n: taken, m: seats }) + '  —  ' + (full ? mv(lang, 'full') : mv(lang, 'left', { n: seats - taken }))}
      </Text>
      {/* the café: kept until 12 hours before, and only for a confirmed seat */}
      {d.mine && d.venue ? (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>{d.venue.name || ''}</Text>
          {d.venue.map_url ? (
            <Pressable onPress={() => { tapLight(); Linking.openURL(d.venue.map_url).catch(() => {}); }} accessibilityRole="link" hitSlop={8}>
              <Text style={{ color: C.text, fontSize: 13.5, textDecorationLine: 'underline' }}>{mv(lang, 'map')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
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
      ) : full ? (
        <Btn label={mv(lang, d.waiting ? 'waiting' : 'wait')} solid={false} onPress={wait} busy={busy} />
      ) : (
        <Btn label={mv(lang, 'claim')} onPress={claim} busy={busy} />
      )}
      {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 10, lineHeight: 18 }}>{note}</Text> : null}
      {done ? <Confirmed q={done} place={place} at={d.starts_at} lang={lang} onClose={() => setDone(null)} /> : null}
      {room ? <EventRoom kind="offer" id={d.id} lang={lang} onClose={() => setRoom(false)} /> : null}
    </Card>
  );
};

export const DropsSection = () => {
  const { lang } = useLang();
  const [list, setList] = useState(null);
  const load = () => dropsList().then((x) => setList(Array.isArray(x) ? x : []));
  useEffect(() => { load(); }, []);
  // no Drops this week: nothing on Home, rather than a line saying so
  if (!list || !list.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <Small>{mv(lang, 'drops').toUpperCase()}</Small>
      {list.map((d) => <DropCard key={d.id} d={d} lang={lang} onChanged={load} />)}
    </View>
  );
};
