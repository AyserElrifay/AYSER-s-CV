import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator } from 'react-native';
import { C } from '../constants/theme';
import { findPeople, personContent, removeContent, setStanding } from '../services/studioPeople';
import { publicMedia } from '../lib/publicMedia';

/* ─── STUDIO · PEOPLE ──────────────────────────────────────────────────
   Ayser: "امسح منشورات، اقفل اكونتات، اعمل بلوك لحد لغاية ما ياخد الـ
   one to one". Search by name, @handle, email (owner) or id. Open a
   person: their standing, their recent posts and stories with Remove,
   and three decisions — hold until a one-to-one, close, reopen. Every
   destructive button asks twice. The database checks every call. */
const STATE = { coach: ['Held until a one-to-one', '#D97706'], closed: ['Closed', '#DC2626'] };
const media = (u) => (!u ? null : /^https?:|^data:|^blob:/.test(u) ? u : publicMedia(String(u).replace(/^\/?media\//, '')));

const Btn = ({ label, onPress, color, solid, busy }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: color || C.line, backgroundColor: solid ? color : 'transparent', paddingHorizontal: 12, paddingVertical: 7, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: solid ? '#FFF' : color || C.text, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

const Person = ({ p, onBack }) => {
  const [stuff, setStuff] = useState(null);
  const [state, setState] = useState(p.state || null);
  const [arm, setArm] = useState(null);           // the action waiting for its second tap
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => personContent(p.id).then(setStuff);
  useEffect(() => { load(); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const twice = async (key, fn) => {
    if (arm !== key) { setArm(key); setMsg(null); return; }
    setArm(null); setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r && r.ok ? 'Done.' : 'Refused: ' + ((r && (r.reason || r.detail)) || 'error'));
    return r;
  };
  const stand = (s) => twice('st_' + s, async () => { const r = await setStanding(p.id, s); if (r && r.ok) setState(r.state || null); return r; });
  const remove = (kind, id) => twice(kind + id, async () => { const r = await removeContent(kind, id); if (r && r.ok) load(); return r; });

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button"><Text style={{ color: C.purple, fontSize: 14, fontWeight: '800' }}>‹ Back to search</Text></Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26, marginEnd: 12, backgroundColor: C.glassHi }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{p.name || 'Someone'} {p.country_flag || ''}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5 }} selectable>{[p.handle ? '@' + p.handle : null, p.email, p.city].filter(Boolean).join(' · ')}</Text>
          <Text style={{ color: C.faint, fontSize: 12 }}>{'Joined ' + new Date(p.created_at).toLocaleDateString() + (p.last_active_at ? ' · active ' + new Date(p.last_active_at).toLocaleDateString() : '') + ' · ' + p.posts + ' posts · ' + p.strikes + ' strikes'}</Text>
        </View>
      </View>
      <View style={{ marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: state ? STATE[state][1] : C.line }}>
        <Text style={{ color: state ? STATE[state][1] : C.green, fontSize: 14, fontWeight: '900' }}>{state ? STATE[state][0] : 'Active'}</Text>
        {state === 'coach' ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>{p.coach_asked_at ? 'They asked for the session on ' + new Date(p.coach_asked_at).toLocaleString() + '.' : 'They see a screen saying why, with a button to ask for the session.'}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {state !== 'coach' ? <Btn busy={busy} label={arm === 'st_coach' ? 'Tap again: hold' : '🤝 Hold until a one-to-one'} color="#D97706" solid={arm === 'st_coach'} onPress={() => stand('coach')} /> : null}
          {state !== 'closed' ? <Btn busy={busy} label={arm === 'st_closed' ? 'Tap again: close' : '🔒 Close the account'} color="#DC2626" solid={arm === 'st_closed'} onPress={() => stand('closed')} /> : null}
          {state ? <Btn busy={busy} label={arm === 'st_clear' ? 'Tap again: reopen' : (state === 'coach' ? '✓ Session done — reopen' : '↺ Reopen')} color="#16A34A" solid={arm === 'st_clear'} onPress={() => stand('clear')} /> : null}
        </View>
        {msg ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{msg}</Text> : null}
      </View>

      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 18 }}>POSTS & STORIES</Text>
      {stuff == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 12 }} />
        : !(stuff.posts || []).length && !(stuff.stories || []).length ? <Text style={{ color: C.dim, marginTop: 8 }}>Nothing posted.</Text>
        : [...(stuff.stories || []).map((x) => ({ ...x, kind: 'story' })), ...(stuff.posts || []).map((x) => ({ ...x, kind: 'post' }))].map((x) => (
          <View key={x.kind + x.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginTop: 8 }}>
            {media(x.thumb_url || x.media_url) && !/\.(mp4|webm|mov)(\?|$)/i.test(x.thumb_url || x.media_url) ? <Image source={{ uri: media(x.thumb_url || x.media_url) }} style={{ width: 54, height: 54, borderRadius: 10, marginEnd: 10, backgroundColor: C.glassHi }} /> : <View style={{ width: 54, height: 54, borderRadius: 10, marginEnd: 10, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}><Text>{x.kind === 'story' ? '⏳' : x.type === 'reel' || x.type === 'vod' ? '▶' : '📝'}</Text></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800' }}>{(x.kind === 'story' ? 'STORY' : String(x.type || 'post').toUpperCase()) + ' · ' + new Date(x.created_at).toLocaleString()}</Text>
              <Text style={{ color: C.text, fontSize: 13.5, marginTop: 2 }} numberOfLines={3} selectable>{x.caption || '(no words)'}</Text>
            </View>
            <Btn busy={busy} label={arm === x.kind + x.id ? 'Tap again' : 'Remove'} color="#DC2626" solid={arm === x.kind + x.id} onPress={() => remove(x.kind, x.id)} />
          </View>
        ))}
    </View>
  );
};

export const PeopleTab = () => {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setRows(null); return undefined; }
    timer.current = setTimeout(() => findPeople(q.trim()).then(setRows), 300);
    return () => clearTimeout(timer.current);
  }, [q]);
  if (open) return <Person p={open} onBack={() => { setOpen(null); if (q.trim().length >= 2) findPeople(q.trim()).then(setRows); }} />;
  return (
    <View>
      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19 }}>Find a person by name, @handle, email or id. Open them to remove posts, hold the account until a one-to-one, close it or reopen it.</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="Search people…" placeholderTextColor={C.faint} autoCapitalize="none"
        style={{ marginTop: 10, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 }} />
      {rows == null ? null : !rows.length ? <Text style={{ color: C.dim, marginTop: 12 }}>Nobody found.</Text>
        : rows.map((p) => (
          <Pressable key={p.id} onPress={() => setOpen(p)} accessibilityRole="button">
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginTop: 8 }}>
              {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20, marginEnd: 10, backgroundColor: C.glassHi }} /> : <View style={{ width: 40, height: 40, borderRadius: 20, marginEnd: 10, backgroundColor: C.glassHi }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={1}>{(p.name || 'Someone') + ' ' + (p.country_flag || '')}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }} numberOfLines={1}>{[p.handle ? '@' + p.handle : null, p.email, p.posts + ' posts'].filter(Boolean).join(' · ')}</Text>
              </View>
              {p.state ? <Text style={{ color: STATE[p.state][1], fontSize: 11.5, fontWeight: '900' }}>{p.state === 'coach' ? 'HELD' : 'CLOSED'}</Text> : null}
            </View>
          </Pressable>
        ))}
    </View>
  );
};
