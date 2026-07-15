import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SQUADS, DMS, LANG_PARTNERS } from '../constants/mockData'; // demo-mode fallback only
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fetchMyDmThreads, fetchMySquads } from '../services/messages';
import { fetchIncomingRequests, acceptRequest, fetchMyMates } from '../services/mates';
import { AV_NEUTRAL } from '../constants/mockData';
import { fetchLanguagePartners } from '../services/social';
import { Page, ScreenHeader, SectionHeader, Glass, Chip, Tick, AvatarStack } from '../components';
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
  const { user } = useAuth();
  const [thread, setThread] = useState(null); // { chat, group }
  const [realDms, setRealDms] = useState([]);
  const [realSquads, setRealSquads] = useState([]);
  const [realPartners, setRealPartners] = useState([]);
  const [mateRequests, setMateRequests] = useState([]); // real pending friend requests
  const [justAccepted, setJustAccepted] = useState({});
  const [myMates, setMyMates] = useState([]);           // your friends — one tap to chat

  const reload = useCallback(() => {
    if (!SUPABASE_READY || !user) return;
    fetchMyDmThreads(user.id).then(setRealDms).catch(() => {});
    fetchMySquads(user.id).then(setRealSquads).catch(() => {});
    fetchLanguagePartners(user.id).then(setRealPartners).catch(() => {});
    fetchIncomingRequests(user.id).then(setMateRequests).catch(() => {});
    fetchMyMates(user.id).then(setMyMates).catch(() => {});
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

  const squads = SUPABASE_READY ? realSquads : SQUADS;
  const dms = SUPABASE_READY
    ? realDms.map((d) => ({ id: d.threadId, threadId: d.threadId, user: { name: d.user.name, avatar: d.user.avatar_url, verified: d.user.verified }, last: d.last, time: timeAgo(d.time), unread: 0, translated: false }))
    : DMS;
  const partners = SUPABASE_READY
    ? realPartners.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar_url, flag: '🌍', speaks: p.speaks_language || 'Not set', learning: p.learning_language || '—', level: p.learning_level || '', online: false }))
    : LANG_PARTNERS;

  return (
  <Page>
    <ScreenHeader
      kicker="Connections"
      title="Chats 💬"
      right={
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={17} color={C.text} />
        </View>
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
                {m.country_flag ? (
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

    {/* ── LEARN LANGUAGES — real exchange partners, HelloTalk style ── */}
    <SectionHeader title="Learn languages 🌍" />
    {partners.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {partners.map((lp) => (
          <Pressable key={lp.id} onPress={() => { tapLight(); setThread({ chat: { user: lp }, group: false }); }}>
            <Glass style={{ width: 148, padding: 12, marginRight: 10, alignItems: 'center' }}>
              <View>
                <Image source={{ uri: lp.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                {lp.online ? <View style={{ position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: C.green, borderWidth: 2, borderColor: '#FFF' }} /> : null}
              </View>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 7 }}>{lp.name} {lp.flag}</Text>
              <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>Speaks {(lp.speaks || '').split(' ')[0]}</Text>
              <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 1 }}>Learning {lp.learning} {lp.level ? '· ' + lp.level : ''}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 6 }}>
                  <Text style={{ color: C.purple, fontSize: 10.5, fontWeight: '900' }}>💬 Chat</Text>
                </View>
                <View style={{ backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ color: C.green, fontSize: 10.5, fontWeight: '900' }}>📞 Call</Text>
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
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>Turn on language exchange in Settings to appear here for others too</Text>
      </Glass>
    )}

    <SectionHeader title="Squads" />
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
          <Image source={{ uri: d.user.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{d.user.name}</Text>
              {d.user.verified ? <Tick /> : null}
              {d.translated ? (
                <MaterialCommunityIcons name="translate" size={14} color={C.blue} style={{ marginLeft: 7 }} />
              ) : null}
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
  </Page>
  );
};
