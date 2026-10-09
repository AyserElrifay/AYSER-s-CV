import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { joinMesh } from '../lib/talkMesh';
import { offsetFrom, remaining, phase, fmt, ALLOWED_MINUTES } from '../lib/talkClock';
import { joinTalkRoom, leaveTalkRoom, talkBridge, talkMeet, startTalkRoom, myLiveVenue } from '../services/talkRooms';
import { joinGathering } from '../services/green';
import { getProfile } from '../services/profiles';
import { showOnMap } from '../lib/mapBus';
import { whenFor } from '../lib/activityPins';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ─── A TALK ROOM ─────────────────────────────────────────────────────
   Talk first, then meet. One clock, big and quiet. Who is here. Mute
   and leave. In the last three minutes Bardi offers to take it offline,
   and at zero the audio is cut — no "five more minutes", for anyone.
   See supabase/RUN_ME.sql ("TALK ROOMS") for the rules, which live in
   the database, and src/lib/talkMesh.js for the audio. */

export const TalkRoomSheet = ({ roomId, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);        // talk_room_join() reply
  const [err, setErr] = useState(null);
  const [people, setPeople] = useState([]);
  const [muted, setMuted] = useState(false);
  const [left, setLeft] = useState(0);
  const [stage, setStage] = useState('live');    // live | bridge | over
  const [bridge, setBridge] = useState(null);    // talk_room_bridge() reply
  const [busy, setBusy] = useState(false);
  const mesh = useRef(null);
  const offset = useRef(0);

  /* in: the database says yes (inside the area, room open, not full),
     then the microphone, then the wire */
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await joinTalkRoom(roomId);
      if (!alive) return;
      if (!r || !r.ok) { setErr((r && r.reason) || 'server'); return; }
      offset.current = offsetFrom(r.now);
      setRoom(r);
      const prof = await getProfile(user.id).catch(() => null);
      const m = await joinMesh({
        roomId, me: { id: user.id, name: ((prof && prof.name) || (user.user_metadata && user.user_metadata.name) || '').split(' ')[0] },
        onPeople: (list) => alive && setPeople(list),
        onError: (why) => alive && setErr(why),
      });
      if (!alive) { if (m) m.close(); return; }
      mesh.current = m;
    })();
    return () => { alive = false; if (mesh.current) mesh.current.close(); };
  }, [roomId]);

  /* the clock — and the hard stop */
  useEffect(() => {
    if (!room) return undefined;
    const tick = () => {
      const st = phase(room.ends_at, offset.current);
      setLeft(remaining(room.ends_at, offset.current));
      setStage(st);
      if (st === 'over' && mesh.current) { mesh.current.close(); mesh.current = null; leaveTalkRoom(roomId); }
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [room]);

  /* the bridge: asked for once the last three minutes start, and again
     now and then, so a meetup somebody else made shows up here too */
  useEffect(() => {
    if (stage === 'live' || !room) return undefined;
    const ask = () => talkBridge(roomId).then((b) => { if (b && b.ok) setBridge(b); });
    ask();
    const h = setInterval(ask, 15000);
    return () => clearInterval(h);
  }, [stage === 'live', room]);

  const leave = () => {
    tapLight();
    if (mesh.current) { mesh.current.close(); mesh.current = null; }
    leaveTalkRoom(roomId);
    onClose();
  };

  const meet = async () => {
    if (busy) return;
    tapMedium(); setBusy(true);
    const r = await talkMeet(roomId, 60);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setBridge({ ok: true, made: true, gathering: { id: r.gathering_id, title: r.title, place: r.place, starts_at: r.starts_at, lat: r.lat, lng: r.lng, going: true, mine: true } }); }
  };
  const imIn = async (id) => {
    if (busy) return;
    tapMedium(); setBusy(true);
    const r = await joinGathering(id, true);
    setBusy(false);
    if (r && r.ok) {
      tapSuccess();
      setBridge((b) => (b && b.gathering ? { ...b, gathering: { ...b.gathering, going: true } } : b && b.event ? { ...b, event: { ...b.event, going: true } } : b));
    }
  };

  /* ── Bardi, at the end: one line, one button ── */
  const renderBridge = () => {
    if (!bridge) return null;
    const g = bridge.gathering;
    let line; let cta = null; let done = null;
    if (bridge.made && g) {
      line = t(g.mine ? 'tr_made_mine' : 'tr_made').replace('{title}', g.title).replace('{place}', g.place || '').replace('{when}', whenFor(g.starts_at, lang));
      if (g.going) done = g; else cta = { label: t('tr_im_in'), go: () => imIn(g.id) };
    } else if (bridge.kind === 'org_event' && bridge.event) {
      line = t('tr_org_event').replace('{org}', bridge.org || '').replace('{title}', bridge.event.title).replace('{when}', whenFor(bridge.event.starts_at, lang));
      if (bridge.event.going) done = { title: bridge.event.title };
      else cta = { label: t('tr_im_in'), go: () => imIn(bridge.event.id) };
    } else {
      const place = bridge.place || '';
      line = bridge.kind === 'org_venue' ? t('tr_org_venue').replace('{org}', bridge.org || '') : place ? t('tr_offline_at').replace('{place}', place) : t('tr_offline');
      cta = { label: t('tr_meet_hour'), go: meet };
    }
    return (
      <View style={{ borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, borderRadius: 18, padding: 16, marginTop: 22 }}>
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>BARDI</Text>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', lineHeight: 22, marginTop: 6 }}>{line}</Text>
        {cta ? (
          <Pressable onPress={cta.go} disabled={busy} accessibilityRole="button"
            style={{ marginTop: 14, backgroundColor: C.purple, borderRadius: 999, paddingVertical: 13, alignItems: 'center', opacity: busy ? 0.7 : 1 }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{cta.label}</Text>}
          </Pressable>
        ) : null}
        {done ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={18} color={C.green} />
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginStart: 6, flex: 1 }}>{t('tr_youre_in')}</Text>
            </View>
            {done.lat != null ? (
              <Pressable onPress={() => { tapLight(); leave(); showOnMap({ lat: done.lat, lng: done.lng }); }} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}>{t('show_on_map')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  /* not being let in, or no microphone, ends it here; a shaky network
     does not — the clock and the way to meet up still matter then */
  const wireDown = err === 'wire';
  const errLine = wireDown ? null : err === 'too_far' ? t('tr_err_far') : err === 'not_visible' ? t('tr_err_visible')
    : err === 'full' ? t('tr_err_full') : err === 'closed' ? t('tr_err_closed') : err === 'mic' ? t('tr_err_mic') : err ? t('lamma_offline') : null;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={leave}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
        <View style={{ alignItems: 'center' }}><SheetHandle onClose={leave} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 30 }}>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 }}>
            {(room && room.org ? room.org + ' · ' : '') + t('tr_kicker')}
          </Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 }}>{room ? room.title : ' '}</Text>

          {errLine && stage !== 'over' ? (
            <View style={{ marginTop: 30 }}>
              <Text style={{ color: C.text, fontSize: 16, lineHeight: 23 }}>{errLine}</Text>
              <Pressable onPress={leave} accessibilityRole="button" style={{ marginTop: 20, alignSelf: 'flex-start' }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', textDecorationLine: 'underline' }}>{t('close')}</Text>
              </Pressable>
            </View>
          ) : !room ? (
            <ActivityIndicator color={C.text} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* the clock: the one big thing on the screen */}
              <Text accessibilityLabel={t('tr_left_a11y').replace('{t}', fmt(left))}
                style={{ color: stage === 'live' ? C.text : C.coral, fontSize: 64, fontWeight: '200', letterSpacing: -2, marginTop: 26, fontVariant: ['tabular-nums'] }}>
                {fmt(left)}
              </Text>
              <Text style={{ color: C.dim, fontSize: 13.5 }}>{stage === 'over' ? t('tr_over') : t('tr_no_ext')}</Text>
              {wireDown && stage !== 'over' ? <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 8 }}>{t('tr_wire')}</Text> : null}

              {stage !== 'over' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 24 }}>
                  {people.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginEnd: 8, marginBottom: 8 }}>
                      <Ionicons name={p.muted ? 'mic-off-outline' : 'mic-outline'} size={14} color={p.muted ? C.faint : C.text} />
                      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginStart: 6 }}>{p.id === user.id ? t('tr_you') : (p.name || '—')}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {stage !== 'live' ? renderBridge() : null}

              {stage !== 'over' ? (
                <View style={{ flexDirection: 'row', marginTop: 28 }}>
                  <Pressable onPress={() => { tapLight(); const m = !muted; setMuted(m); if (mesh.current) mesh.current.setMuted(m); }}
                    accessibilityRole="button" accessibilityLabel={muted ? t('tr_unmute') : t('tr_mute')}
                    style={{ flex: 1, borderWidth: 1.5, borderColor: C.text, borderRadius: 999, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                    <Ionicons name={muted ? 'mic-off' : 'mic'} size={17} color={C.text} />
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginStart: 6 }}>{muted ? t('tr_unmute') : t('tr_mute')}</Text>
                  </Pressable>
                  <Pressable onPress={leave} accessibilityRole="button" style={{ paddingHorizontal: 22, justifyContent: 'center' }}>
                    <Text style={{ color: C.coral, fontSize: 15, fontWeight: '800' }}>{t('tr_leave')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={leave} accessibilityRole="button" style={{ marginTop: 24, alignSelf: 'flex-start' }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', textDecorationLine: 'underline' }}>{t('close')}</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

/* ── starting one: a name, 15 or 30, done ── */
export const StartTalkSheet = ({ country, onStarted, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [venue, setVenue] = useState(null);
  const [atVenue, setAtVenue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { myLiveVenue(user && user.id).then((v) => { setVenue(v); if (v) setAtVenue(true); }); }, []);

  const go = async () => {
    if (busy) return;
    tapMedium(); setBusy(true); setErr(null);
    const r = await startTalkRoom({ title: title.trim() || t('tr_default_title'), minutes, radiusKm: 3, country, venueId: atVenue && venue ? venue.id : null });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); onStarted(r.id); }
    else setErr((r && r.reason) || 'server');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
          <SheetHandle onClose={onClose} />
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{t('tr_start_h')}</Text>
          <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 20, marginTop: 6 }}>{t('tr_start_sub')}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder={t('tr_default_title')} placeholderTextColor={C.faint}
            style={{ borderBottomWidth: 1, borderBottomColor: C.line, color: C.text, paddingVertical: 12, fontSize: 17, marginTop: 18 }} />
          <View style={{ flexDirection: 'row', backgroundColor: C.glassHi, borderRadius: 14, padding: 4, marginTop: 18 }}>
            {ALLOWED_MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <Pressable key={m} onPress={() => { tapLight(); setMinutes(m); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: on ? C.bg : 'transparent' }}>
                  <Text style={{ color: on ? C.text : C.dim, fontSize: 14.5, fontWeight: on ? '800' : '600' }}>{t('tr_min').replace('{n}', String(m))}</Text>
                </Pressable>
              );
            })}
          </View>
          {venue ? (
            <Pressable onPress={() => { tapLight(); setAtVenue((v) => !v); }} accessibilityRole="checkbox" accessibilityState={{ checked: atVenue }}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              <Ionicons name={atVenue ? 'checkbox' : 'square-outline'} size={20} color={C.text} />
              <Text style={{ color: C.text, fontSize: 14.5, marginStart: 8, flex: 1 }}>{t('tr_at_venue').replace('{venue}', venue.name)}</Text>
            </Pressable>
          ) : null}
          {err ? (
            <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>
              {err === 'not_visible' ? t('tr_err_visible') : err === 'already_hosting' ? t('tr_err_hosting') : err === 'need_unlock' ? t('vc_why_big') : t('lamma_offline')}
            </Text>
          ) : null}
          <Pressable onPress={go} disabled={busy} accessibilityRole="button"
            style={{ marginTop: 22, backgroundColor: C.purple, borderRadius: 18, paddingVertical: 17, alignItems: 'center', opacity: busy ? 0.7 : 1 }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '800' }}>{t('tr_start_go')}</Text>}
          </Pressable>
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('tr_fine')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
