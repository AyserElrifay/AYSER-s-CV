import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { SQUADS, DMS, LANG_PARTNERS } from '../constants/mockData'; // demo-mode fallback only
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { fetchMyDmThreads, fetchMySquads, createSquad, leaveSquad, addSquadMember, fetchDmStreaks } from '../services/messages';
import { fetchIncomingRequests, acceptRequest, fetchMyMates } from '../services/mates';
import { getProfile, updateProfile } from '../services/profiles';
import { AV_NEUTRAL } from '../constants/mockData';
import { fetchLanguagePartners, searchProfiles } from '../services/social';
import { Page, ScreenHeader, SectionHeader, Glass, Chip, Tick, AvatarStack, StreakBadge, OnlineDot } from '../components';
import { ChatThread } from './ChatThread';
import { tapLight } from '../utils/feedback';

/* ─────────────────── TAB 5 · CHATS — CONNECTIONS ─────────────────────
   Real mode: your actual DM threads, actual squads you've joined, and
   actual people who opted into language exchange — no scripted
   contacts. Everything starts empty and fills in as you use the app. */

const timeAgo = (iso) => {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (min < 1) return 'now';
  if (min < 60) return min + 'm';
  if (min < 24 * 60) return Math.round(min / 60) + 'h';
  return Math.round(min / (60 * 24)) + 'd';
};

export const ChatsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline } = usePresence(); // real-time — a live Supabase Presence connection
  const [thread, setThread] = useState(null); // { chat, group }
  const [composing, setComposing] = useState(false); // new-message search sheet
  const [composeQ, setComposeQ] = useState('');
  const [composeResults, setComposeResults] = useState([]);
  const [composeBusy, setComposeBusy] = useState(false);
  const [realDms, setRealDms] = useState([]);
  const [realSquads, setRealSquads] = useState([]);
  const [realPartners, setRealPartners] = useState([]);
  const [mateRequests, setMateRequests] = useState([]); // real pending friend requests
  const [justAccepted, setJustAccepted] = useState({});
  const [myMates, setMyMates] = useState([]);           // your friends — one tap to chat
  const [streaks, setStreaks] = useState({});           // { threadId: streakInfo } — 🔥 per chat

  // ── language exchange, HelloTalk-style: switch it on RIGHT HERE ──
  const [exOn, setExOn] = useState(false);
  const [exSpeaks, setExSpeaks] = useState('');
  const [exLearning, setExLearning] = useState('');
  const [exBusy, setExBusy] = useState(false);
  const [exSaved, setExSaved] = useState(false);
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    getProfile(user.id).then((p) => {
      if (!p) return;
      setExOn(!!p.learning_visible);
      setExSpeaks(p.speaks_language || '');
      setExLearning(p.learning_language || '');
    }).catch(() => {});
  }, [user]);
  const saveExchange = async (nextOn) => {
    if (!SUPABASE_READY || !user || exBusy) return;
    setExBusy(true);
    try {
      await updateProfile(user.id, {
        learning_visible: nextOn,
        speaks_language: exSpeaks.trim() || null,
        learning_language: exLearning.trim() || null,
      });
      setExOn(nextOn);
      setExSaved(true); setTimeout(() => setExSaved(false), 1600);
      tapLight();
      reload(); // you appear for others the moment it's on
    } catch (e) {}
    finally { setExBusy(false); }
  };

  const reload = useCallback(() => {
    if (!SUPABASE_READY || !user) return;
    fetchMyDmThreads(user.id).then(setRealDms).catch(() => {});
    fetchMySquads(user.id).then(setRealSquads).catch(() => {});
    fetchLanguagePartners(user.id).then(setRealPartners).catch(() => {});
    fetchIncomingRequests(user.id).then(setMateRequests).catch(() => {});
    fetchMyMates(user.id).then(setMyMates).catch(() => {});
    fetchDmStreaks(user.id).then(setStreaks).catch(() => {});
  }, [user]);

  const accept = async (req) => {
    tapLight();
    setJustAccepted((a) => ({ ...a, [req.id]: true }));
    try { await acceptRequest(req.id); } catch (e) {}
    setTimeout(() => setMateRequests((r) => r.filter((x) => x.id !== req.id)), 1200);
  };

  useEffect(() => { reload(); }, [reload]);
  // refresh the DM previews when you come back from a conversation
  useEffect(() => { if (!thread) reload(); }, [thread, reload]);

  // ── new message: search real people, tap to start a real chat ──
  useEffect(() => {
    if (!composing || !SUPABASE_READY) return;
    const q = composeQ.trim();
    if (!q) { setComposeResults([]); return; }
    let cancelled = false;
    setComposeBusy(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchProfiles(q);
        if (!cancelled) setComposeResults((rows || []).filter((p) => p.id !== (user && user.id)));
      } catch (e) { if (!cancelled) setComposeResults([]); }
      finally { if (!cancelled) setComposeBusy(false); }
    }, 260);
    return () => { cancelled = true; clearTimeout(t); };
  }, [composeQ, composing, user]);

  const openChatWith = (p) => {
    tapLight();
    setComposing(false); setComposeQ(''); setComposeResults([]);
    setThread({ chat: { user: { id: p.id, name: p.name || 'Explorer', avatar: p.avatar_url || AV_NEUTRAL, verified: !!p.verified } }, group: false });
  };

  // ── squads: create one, leave (close) one — all real rows ──
  const [squadCreating, setSquadCreating] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [squadEmoji, setSquadEmoji] = useState('🏕️');
  const [squadErr, setSquadErr] = useState(null);
  const submitSquad = async () => {
    if (!squadName.trim() || !SUPABASE_READY || !user) return;
    setSquadErr(null);
    try {
      await createSquad(user.id, { name: squadName.trim(), emoji: squadEmoji.trim() || '🏕️' });
      tapLight();
      setSquadCreating(false); setSquadName(''); setSquadEmoji('🏕️');
      reload();
    } catch (e) {
      setSquadErr(/does not exist|policy|security/i.test(e.message || '')
        ? 'One step left: run the latest supabase/RUN_ME.sql to turn on squads.'
        : (e.message || 'Could not create the squad.'));
    }
  };
  const closeSquad = async (s) => {
    tapLight();
    setRealSquads((list) => list.filter((x) => x.id !== s.id));
    try { await leaveSquad(s.id, user.id); } catch (e) { reload(); }
  };

  // ── invite mates into a squad — a real membership row per person ──
  const [inviteSquad, setInviteSquad] = useState(null); // the squad you're adding people to
  const [invited, setInvited] = useState({});           // { mateId: true } — just-added feedback
  const [inviteErr, setInviteErr] = useState(null);
  const openInvite = (s) => { tapLight(); setInviteErr(null); setInvited({}); setInviteSquad(s); };
  const inviteMate = async (mate) => {
    if (!inviteSquad || !user) return;
    tapLight();
    setInvited((v) => ({ ...v, [mate.id]: true }));
    try { await addSquadMember(inviteSquad.id, mate.id); }
    catch (e) {
      setInvited((v) => { const n = { ...v }; delete n[mate.id]; return n; });
      setInviteErr(/does not exist|policy|security/i.test(e.message || '')
        ? 'One step left: run the latest supabase/RUN_ME.sql to turn on squad invites.'
        : (e.message || 'Could not add them.'));
    }
  };

  const squads = SUPABASE_READY ? realSquads : SQUADS;
  const dms = SUPABASE_READY
    ? realDms.map((d) => ({ id: d.threadId, threadId: d.threadId, user: { id: d.user.id, name: d.user.name, avatar: d.user.avatar_url, verified: d.user.verified }, last: d.last, time: timeAgo(d.time), unread: 0, translated: false }))
    : DMS;
  const myFlag = user && user.country_flag;
  const partners = SUPABASE_READY
    ? realPartners
        .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar_url || AV_NEUTRAL, flag: p.country_flag || '🌍', country: p.country, speaks: p.speaks_language || 'Not set', learning: p.learning_language || '—', level: p.learning_level || '', online: false, abroad: !!(p.country_flag && myFlag && p.country_flag !== myFlag) }))
        // people from ANOTHER country first — the whole point of exchange
        .sort((a, b) => (b.abroad ? 1 : 0) - (a.abroad ? 1 : 0))
    : LANG_PARTNERS;

  return (
  <Page>
    <ScreenHeader
      kicker="Connections"
      title="Chats 💬"
      right={
        <Pressable onPress={() => { tapLight(); setComposing(true); setComposeQ(''); setComposeResults([]); }} hitSlop={8}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="create-outline" size={17} color={C.purple} />
          </View>
        </Pressable>
      }
    />

    {/* ── MATE REQUESTS — real friend requests waiting on you ── */}
    {mateRequests.length ? (
      <>
        <SectionHeader title={'Mate requests 🤝 (' + mateRequests.length + ')'} />
        {mateRequests.map((req) => {
          const p = req.requester || {};
          const done = !!justAccepted[req.id];
          return (
            <Glass key={req.id} tint={C.purpleSoft} border="rgba(124,58,237,0.3)" style={{ padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 46, height: 46, borderRadius: 23 }} />
              <View style={{ flex: 1, marginLeft: 11 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{p.name || 'Explorer'} {p.country_flag || ''}</Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>wants to be your mate</Text>
              </View>
              {done ? (
                <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '900' }}>Mates ✓</Text>
                </View>
              ) : (
                <Pressable onPress={() => accept(req)}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Accept 🤝</Text>
                  </View>
                </Pressable>
              )}
            </Glass>
          );
        })}
        <View style={{ height: 10 }} />
      </>
    ) : null}

    {/* ── YOUR MATES — one tap opens the chat ── */}
    {myMates.length ? (
      <>
        <SectionHeader title="Your mates 🤝" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {myMates.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => { tapLight(); setThread({ chat: { user: { id: m.id, name: m.name || 'Explorer', avatar: m.avatar_url || AV_NEUTRAL } }, group: false }); }}
              style={{ alignItems: 'center', marginRight: 14, width: 64 }}
            >
              <View>
                <Image source={{ uri: m.avatar_url || AV_NEUTRAL }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.purple }} />
                {isOnline(m.id) ? <OnlineDot size={15} /> : m.country_flag ? (
                  <View style={{ position: 'absolute', bottom: -2, right: -3, backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 11 }}>{m.country_flag}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: C.dim, fontSize: 10.5, fontWeight: '700', marginTop: 5 }} numberOfLines={1}>
                {(m.name || 'Explorer').split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </>
    ) : null}

    {/* ── EXCHANGE PARTNERS — meet people in other countries, HelloTalk
        style: open it in Settings and you appear here for them too ── */}
    <SectionHeader title="Exchange partners 🌍" />
    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: -6, marginBottom: 10, paddingHorizontal: 2 }}>
      People abroad who opened language exchange — swap languages & cultures, chat and call across the world.
    </Text>

    {/* ── your exchange switch — HelloTalk-style, right here ── */}
    {SUPABASE_READY ? (
      <Glass style={{ padding: 13, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20 }}>🌍</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>
              {exOn ? 'You\'re open for exchange ✓' : 'Join the exchange'}
            </Text>
            <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>
              {exOn ? 'People abroad can see you and say hi' : 'Flip it on — you\'ll appear here for people abroad'}
            </Text>
          </View>
          <Pressable onPress={() => saveExchange(!exOn)} hitSlop={6}>
            <View style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: exOn ? C.green : C.glassHi, padding: 3, justifyContent: 'center' }}>
              <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: '#FFF', marginLeft: exOn ? 19 : 0 }} />
            </View>
          </Pressable>
        </View>
        {exOn ? (
          <View style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              <TextInput
                placeholder="I speak… (e.g. Arabic)" placeholderTextColor={C.faint}
                value={exSpeaks} onChangeText={setExSpeaks}
                style={{ flex: 1, color: C.text, fontSize: 12.5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, marginRight: 8 }}
              />
              <TextInput
                placeholder="Learning… (e.g. English)" placeholderTextColor={C.faint}
                value={exLearning} onChangeText={setExLearning}
                style={{ flex: 1, color: C.text, fontSize: 12.5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9 }}
              />
            </View>
            <Pressable onPress={() => saveExchange(true)} style={{ marginTop: 8 }}>
              <View style={{ backgroundColor: exSaved ? C.greenSoft : C.purpleSoft, borderRadius: 11, paddingVertical: 9, alignItems: 'center' }}>
                <Text style={{ color: exSaved ? C.green : C.purple, fontSize: 12, fontWeight: '900' }}>
                  {exSaved ? 'Saved ✓ — you\'re live on the exchange' : exBusy ? 'Saving…' : 'Save my languages'}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </Glass>
    ) : null}

    {partners.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {partners.map((lp) => (
          <Pressable key={lp.id} onPress={() => { tapLight(); setThread({ chat: { user: lp }, group: false }); }}>
            <Glass style={{ width: 152, padding: 12, marginRight: 10, alignItems: 'center' }}>
              <View>
                <Image source={{ uri: lp.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                {lp.online ? <View style={{ position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: C.green, borderWidth: 2, borderColor: '#FFF' }} /> : null}
              </View>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 7 }} numberOfLines={1}>{lp.name} {lp.flag}</Text>
              {lp.country ? (
                <View style={{ backgroundColor: lp.abroad ? 'rgba(59,130,246,0.14)' : C.glass, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                  <Text style={{ color: lp.abroad ? C.blue : C.faint, fontSize: 9.5, fontWeight: '800' }} numberOfLines={1}>{lp.abroad ? '🌍 ' : ''}{lp.country}</Text>
                </View>
              ) : null}
              <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 5, textAlign: 'center' }} numberOfLines={1}>Speaks {(lp.speaks || '').split(' ')[0]}</Text>
              <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>Learning {lp.learning} {lp.level ? '· ' + lp.level : ''}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ color: C.purple, fontSize: 10.5, fontWeight: '900' }}>💬 Chat</Text>
                </View>
              </View>
            </Glass>
          </Pressable>
        ))}
      </ScrollView>
    ) : (
      <Glass style={{ padding: 16, marginBottom: 20, alignItems: 'center' }}>
        <Text style={{ fontSize: 22 }}>🌍</Text>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>No exchange partners yet</Text>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>Open language exchange in Settings → you'll appear here for people in other countries, and they'll appear for you</Text>
      </Glass>
    )}

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <SectionHeader title="Squads" />
      {SUPABASE_READY ? (
        <Pressable onPress={() => { tapLight(); setSquadCreating((v) => !v); setSquadErr(null); }} hitSlop={8}>
          <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: '900' }}>{squadCreating ? '✕ Close' : '＋ New squad'}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
    {squadCreating ? (
      <Glass style={{ padding: 12, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          <TextInput value={squadEmoji} onChangeText={setSquadEmoji} maxLength={4}
            style={{ width: 48, textAlign: 'center', fontSize: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginRight: 8 }} />
          <TextInput placeholder="Squad name (e.g. Sunrise Hikers)" placeholderTextColor={C.faint} value={squadName} onChangeText={setSquadName}
            style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }} />
        </View>
        {squadErr ? <Text style={{ color: C.coral, fontSize: 11.5, marginTop: 8 }}>{squadErr}</Text> : null}
        <Pressable onPress={submitSquad} style={{ marginTop: 10 }}>
          <View style={{ backgroundColor: squadName.trim() ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ color: squadName.trim() ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>Create squad 🏕️</Text>
          </View>
        </Pressable>
      </Glass>
    ) : null}
    {squads.length ? squads.map((s) => (
      <Pressable key={s.id} onPress={() => { tapLight(); setThread({ chat: s, group: true }); }}>
        <Glass tint={C.blueSoft} border="rgba(59,130,246,0.35)" style={{ padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                {s.activity ? <Chip label={s.activity} color={C.blue} tint="rgba(59,130,246,0.16)" style={{ marginLeft: 8, borderColor: 'rgba(59,130,246,0.35)' }} /> : null}
              </View>
              {s.last ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }} numberOfLines={1}>{s.last}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
              {s.time ? <Text style={{ color: C.faint, fontSize: 11 }}>{s.time}</Text> : null}
              {s.unread > 0 ? (
                <View style={{ marginTop: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{s.unread}</Text>
                </View>
              ) : null}
              {SUPABASE_READY ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Pressable onPress={() => openInvite(s)} hitSlop={8} style={{ marginRight: 12 }}>
                    <Text style={{ color: C.purple, fontSize: 10.5, fontWeight: '900' }}>＋ Invite</Text>
                  </Pressable>
                  <Pressable onPress={() => closeSquad(s)} hitSlop={8}>
                    <Text style={{ color: C.coral, fontSize: 10.5, fontWeight: '800' }}>Leave ✕</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          {s.members ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <AvatarStack uris={s.members} />
              <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 10 }}>
                {s.members.length} Roam Mates · squad expires after the vibe
              </Text>
            </View>
          ) : null}
        </Glass>
      </Pressable>
    )) : (
      <Glass style={{ padding: 16, marginBottom: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 22 }}>🏕️</Text>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>No squads yet</Text>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>Join the Vibe on a moment to start one</Text>
      </Glass>
    )}

    <SectionHeader title="Direct" style={{ marginTop: 14 }} />
    {dms.length ? dms.map((d) => (
      <Pressable key={d.id} onPress={() => { tapLight(); setThread({ chat: d, group: false }); }}>
        <Glass style={{ padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <View>
            <Image source={{ uri: d.user.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
            {d.user.id && isOnline(d.user.id) ? <OnlineDot /> : null}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{d.user.name}</Text>
              {d.user.verified ? <Tick /> : null}
              {d.translated ? (
                <MaterialCommunityIcons name="translate" size={14} color={C.blue} style={{ marginLeft: 7 }} />
              ) : null}
              {streaks[d.threadId] ? <View style={{ marginLeft: 7 }}><StreakBadge info={streaks[d.threadId]} /></View> : null}
            </View>
            <Text style={{ color: d.unread ? C.text : C.dim, fontSize: 12.5, marginTop: 3, fontWeight: d.unread ? '600' : '400' }} numberOfLines={1}>
              {d.last}
            </Text>
            {d.translated ? (
              <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>Tap to translate · Arabic detected</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
            <Text style={{ color: C.faint, fontSize: 11 }}>{d.time}</Text>
            {d.unread > 0 ? (
              <View style={{ marginTop: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple }} />
            ) : null}
          </View>
        </Glass>
      </Pressable>
    )) : (
      <Glass style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 22 }}>💬</Text>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>No conversations yet</Text>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>Wave at someone nearby or message a search result to start one</Text>
      </Glass>
    )}

    {thread ? <ChatThread chat={thread.chat} group={thread.group} onClose={() => setThread(null)} /> : null}

    {/* ── INVITE TO SQUAD — pick real mates, add them to the group ── */}
    {inviteSquad ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setInviteSquad(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setInviteSquad(null)} />
        <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.line, maxHeight: '76%', paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>
              {inviteSquad.emoji} Invite to {inviteSquad.name}
            </Text>
            <Pressable onPress={() => setInviteSquad(null)} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
          </View>
          {inviteErr ? <Text style={{ color: C.coral, fontSize: 11.5, paddingHorizontal: 18, marginBottom: 6 }}>{inviteErr}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            {myMates.length ? myMates.map((m) => {
              const done = !!invited[m.id];
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 }}>
                  <Image source={{ uri: m.avatar_url || AV_NEUTRAL }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{m.name || 'Explorer'} {m.country_flag || ''}</Text>
                  </View>
                  {done ? (
                    <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                      <Text style={{ color: C.green, fontSize: 12, fontWeight: '900' }}>Added ✓</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => inviteMate(m)}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 7 }}>
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Add ＋</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            }) : (
              <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
                <Text style={{ fontSize: 26 }}>🤝</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }}>No mates yet</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Add mates first — then invite them into your squad.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    ) : null}

    {/* ── NEW MESSAGE — search real people and start a real chat ── */}
    {composing ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setComposing(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 }}>
              <Ionicons name="search" size={16} color={C.dim} />
              <TextInput
                placeholder="Search people to message…"
                placeholderTextColor={C.faint}
                value={composeQ}
                onChangeText={setComposeQ}
                autoFocus autoCapitalize="none"
                style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 14.5 }}
              />
            </View>
            <Pressable onPress={() => setComposing(false)} style={{ marginLeft: 12 }} hitSlop={8}>
              <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 18, marginBottom: 4 }}>
            {composeQ.trim() ? 'PEOPLE' : 'YOUR MATES'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 20 }}>
            {(composeQ.trim() ? composeResults : myMates.map((m) => ({ id: m.id, name: m.name, avatar_url: m.avatar_url, verified: false }))).map((p) => (
              <Pressable key={p.id} onPress={() => openChatWith(p)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }}>
                  <Image source={{ uri: p.avatar_url || AV_NEUTRAL }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{p.name || 'Explorer'}</Text>
                    {p.handle ? <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{p.handle}</Text> : null}
                  </View>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={C.purple} />
                </View>
              </Pressable>
            ))}
            {composeQ.trim() && !composeBusy && !composeResults.length ? (
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>No one found for “{composeQ.trim()}” — yet 🌱</Text>
            ) : null}
            {!composeQ.trim() && !myMates.length ? (
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>Search anyone by name to start a chat ✨</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    ) : null}
  </Page>
  );
};
