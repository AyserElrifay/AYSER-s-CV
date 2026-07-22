import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../context/PresenceContext';
import { getOrCreateDmThread, fetchMessages, sendMessage, sendMoment, sendGameInvite, subscribeMessages, getThreadTtl, setThreadTtl, sweepExpired, streakInfo } from '../services/messages';
import { createMatch, fetchMatch, respondMatch } from '../services/games';
import { StreakBadge } from '../components/StreakBadge';
import { getProfile } from '../services/profiles';
import { TruthOrDare } from '../components/TruthOrDare';
import { WouldYouRather } from '../components/WouldYouRather';
import { CallScreen } from '../components/CallScreen';
import { CaptureModal } from '../components/CaptureModal';
import { GameRunner } from '../components/GameRunner';
import { OnlineDot } from '../components/OnlineDot';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { LinearGradient } from 'expo-linear-gradient';
import { sfxPop } from '../utils/sfx';

/* ─── A conversation — kept deliberately simple and warm, the kind of
   place you want to hang out in. Call & video in the header, and games
   (Truth or Dare) you can drop in and pull out anytime. ─── */

/* No scripted messages — a conversation starts empty and fills with
   REAL messages only. A brand-new chat should look brand new. */

export const ChatThread = ({ chat, group, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const peer = group ? null : chat.user;
  const title = group ? chat.name : peer.name;
  const avatarUri = group ? null : peer.avatar;
  // real participants only — no fabricated names padding a group
  const players = group
    ? [{ id: 'me', name: 'You', avatar: AV_NEUTRAL }]
    : [peer, { id: 'me', name: 'You', avatar: AV_NEUTRAL }];

  // Real only when the peer/squad is backed by a real uuid — a mock
  // demo row (fake id like 's1') never touches the real database.
  const REAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isReal = SUPABASE_READY && !!user && (group ? REAL_ID.test(chat.id || '') : REAL_ID.test((peer && peer.id) || ''));

  const [msgs, setMsgs] = useState([]); // always starts empty — real messages only
  const [dmThreadId, setDmThreadId] = useState((!group && chat.threadId) || null);
  const [draft, setDraft] = useState('');
  const [chatErr, setChatErr] = useState(null); // never pretend a send worked

  const explainChat = (e) => {
    const m = (e && e.message) || '';
    if (/does not exist|schema cache|get_or_create_dm_thread/i.test(m)) {
      return 'Messages need one more step: run supabase/RUN_ME.sql in the Supabase SQL Editor.';
    }
    return m || 'Could not send — try again.';
  };
  // real "last active" for the person you're chatting with
  const [peerActive, setPeerActive] = useState(null); // ISO string | null
  useEffect(() => {
    if (!isReal || group || !peer || !peer.id) return;
    let cancelled = false;
    getProfile(peer.id).then((p) => { if (!cancelled) setPeerActive(p && p.last_active_at); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer && peer.id, isReal]);

  // real-time presence beats the stale last_active_at poll whenever it's live
  const { isOnline } = usePresence();
  const peerOnlineNow = !group && peer && peer.id && isOnline(peer.id);
  const activeLabel = (() => {
    if (group) return chat.members ? chat.members.length + ' mates' : 'Group chat';
    if (peerOnlineNow) return '🟢 Online now';
    if (!peerActive) return '';
    const min = Math.floor((Date.now() - new Date(peerActive)) / 60000);
    if (min < 3) return '🟢 Active now';
    if (min < 60) return 'Active ' + min + 'm ago';
    if (min < 24 * 60) return 'Active ' + Math.round(min / 60) + 'h ago';
    return 'Active ' + Math.round(min / (60 * 24)) + 'd ago';
  })();

  /* ── Disappearing messages — a real per-chat timer. Messages older
     than the chosen window are hidden AND swept from the database.
     DEFAULT: 1 week (the natural thing — chats shouldn't pile up
     forever). "Keep forever" is an explicit choice, stored as 0. ── */
  const DEFAULT_TTL = 168; // hours — 1 week
  const [ttl, setTtl] = useState(undefined);     // undefined = not loaded; null = unset (→ default); 0 = forever
  const [ttlOpen, setTtlOpen] = useState(false);
  const TTL_OPTIONS = [
    { h: 24, label: '24 hours' },
    { h: 168, label: '1 week · default' },
    { h: 720, label: '1 month' },
    { h: 2160, label: '3 months' },
    { h: 0, label: 'Keep forever' },
  ];
  // the timer actually in force: explicit choice wins, otherwise 1 week
  const effTtl = ttl === null || ttl === undefined ? DEFAULT_TTL : ttl;
  useEffect(() => {
    if (!isReal || group || !dmThreadId) return;
    let cancelled = false;
    getThreadTtl(dmThreadId).then((h) => {
      if (cancelled) return;
      setTtl(h);
      const eff = h === null || h === undefined ? DEFAULT_TTL : h;
      if (eff > 0) sweepExpired(dmThreadId, eff);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmThreadId, isReal]);

  const pickTtl = async (h) => {
    tapLight();
    setTtlOpen(false);
    if (!dmThreadId) return;
    try {
      await setThreadTtl(dmThreadId, h);
      setTtl(h);
      if (h > 0) sweepExpired(dmThreadId, h);
    } catch (e) {
      setChatErr(/ttl_hours|column/i.test(e.message || '')
        ? 'One step left: run the latest supabase/RUN_ME.sql to turn on disappearing messages.'
        : (e.message || 'Could not change the timer.'));
    }
  };

  // hide anything past the window (the DB sweep also removes it for
  // real). Moments/snaps are exempt — they carry the streak history.
  const ttlCutoff = effTtl > 0 ? Date.now() - effTtl * 3600 * 1000 : null;
  const visibleMsgs = ttlCutoff
    ? msgs.filter((m) => m.kind === 'moment' || m.mediaUrl || !m.createdAt || new Date(m.createdAt).getTime() >= ttlCutoff)
    : msgs;

  const [todOn, setTodOn] = useState(false);
  const [wyrOn, setWyrOn] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [splitTotal, setSplitTotal] = useState('');
  const [splitPeople, setSplitPeople] = useState('2');
  const [splitTip, setSplitTip] = useState('0');
  const splitShare = (() => {
    const total = parseFloat(splitTotal) || 0;
    const ppl = Math.max(1, parseInt(splitPeople, 10) || 1);
    const tip = parseFloat(splitTip) || 0;
    const grand = total * (1 + tip / 100);
    return { grand, per: grand / ppl, ppl };
  })();
  const sendSplit = () => {
    if (!(parseFloat(splitTotal) > 0)) return;
    const { grand, per, ppl } = splitShare;
    const money = (n) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tipTxt = (parseFloat(splitTip) || 0) > 0 ? ' (incl. ' + splitTip + '% tip)' : '';
    const text = '🧾 Bill split — total ' + money(grand) + tipTxt + ' ÷ ' + ppl + ' = ' + money(per) + ' each';
    setSplitOn(false);
    setSplitTotal(''); setSplitTip('0');
    send(text);
  };
  const [menu, setMenu] = useState(false);
  const [call, setCall] = useState(null); // {video:bool}
  const scroller = useRef(null);

  // ── Catch Your Mate — real multiplayer duel invites ──
  const [matches, setMatches] = useState({}); // { [matchId]: game_matches row }
  const [activeMatch, setActiveMatch] = useState(null); // { matchId, isHost, opponent }
  const loadMatch = async (matchId) => {
    try { const m = await fetchMatch(matchId); setMatches((s) => ({ ...s, [matchId]: m })); } catch (e) {}
  };
  const inviteToMatch = async () => {
    if (!isReal || group || !dmThreadId || !user || !peer) return;
    tapMedium();
    try {
      const m = await createMatch(user.id, peer.id, 'catch');
      setMatches((s) => ({ ...s, [m.id]: m }));
      const row = await sendGameInvite({ dmThreadId, userId: user.id, matchId: m.id });
      setMsgs((ms) => (ms.some((x) => x.id === row.id) ? ms : [...ms, toLocal(row)]));
      setActiveMatch({ matchId: m.id, isHost: true, opponent: { id: peer.id, name: peer.name, avatar: peer.avatar } });
    } catch (e) {
      setChatErr(explainChat(e));
    }
    setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80);
  };
  const joinMatch = async (matchId) => {
    tapMedium();
    try {
      await respondMatch(matchId, true);
      setMatches((s) => ({ ...s, [matchId]: { ...(s[matchId] || {}), status: 'active' } }));
      setActiveMatch({ matchId, isHost: false, opponent: { id: peer.id, name: peer.name, avatar: peer.avatar } });
    } catch (e) {}
  };
  const declineMatch = async (matchId) => {
    tapLight();
    try {
      await respondMatch(matchId, false);
      setMatches((s) => ({ ...s, [matchId]: { ...(s[matchId] || {}), status: 'declined' } }));
    } catch (e) {}
  };
  const rematch = async () => {
    if (!activeMatch || !dmThreadId || !user || !peer) return;
    try {
      const m = await createMatch(user.id, peer.id, 'catch');
      setMatches((s) => ({ ...s, [m.id]: m }));
      const row = await sendGameInvite({ dmThreadId, userId: user.id, matchId: m.id });
      setMsgs((ms) => (ms.some((x) => x.id === row.id) ? ms : [...ms, toLocal(row)]));
      setActiveMatch({ matchId: m.id, isHost: true, opponent: activeMatch.opponent });
    } catch (e) {}
  };

  const toLocal = (row) => ({
    id: row.id,
    createdAt: row.created_at,
    userId: row.user_id,
    kind: row.kind || 'text',
    mediaUrl: row.media_url || null,
    mediaKind: row.media_kind || null,
    gameMatchId: row.game_match_id || null,
    from: row.user_id === user.id
      ? 'me'
      : { name: (row.user && row.user.name) || (peer && peer.name) || 'Someone', avatar: (row.user && row.user.avatar_url) || (peer && peer.avatar) || AV_NEUTRAL },
    text: row.body,
  });

  // Snapchat-style streak with this person — real, from the moments you
  // and they have actually exchanged (number, milestone badge, and an
  // ⏳ warning when you both still need to send today or lose it).
  const streak = (!group && peer && peer.id) ? streakInfo(msgs, user && user.id, peer.id) : { n: 0 };

  // ── Moments in chat: shoot a snap and send it right here ──
  const [momentOpen, setMomentOpen] = useState(false);
  const [viewMoment, setViewMoment] = useState(null); // { mediaUrl, mediaKind } — full-screen viewer
  // ── Snaps: a Moment is a circular mystery snap. The receiver can open it
  //    twice, then it's gone. Long-press to save it before it disappears. ──
  const [snapTick, setSnapTick] = useState(0); // force re-render after a view
  const snapViews = (id) => { try { return +((typeof localStorage !== 'undefined' && localStorage.getItem('mm_snap_v_' + id)) || 0); } catch (e) { return 0; } };
  const openSnap = (m, mine) => {
    tapLight();
    if (!mine) { try { if (typeof localStorage !== 'undefined') localStorage.setItem('mm_snap_v_' + m.id, String(snapViews(m.id) + 1)); } catch (e) {} setSnapTick((t) => t + 1); }
    setViewMoment({ mediaUrl: m.mediaUrl, mediaKind: m.mediaKind });
  };
  const saveSnap = (url, kind) => {
    tapSuccess();
    try {
      const a = document.createElement('a');
      a.href = url; a.download = kind === 'video' ? 'moment.mp4' : 'moment.jpg'; a.target = '_blank';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  };
  const handleSendMoment = async ({ mediaUrl, mediaKind, caption }) => {
    if (isReal) {
      const squadId = group ? chat.id : null;
      if (!squadId && !dmThreadId) {
        setChatErr('Messages need one more step: run supabase/RUN_ME.sql in the Supabase SQL Editor.');
        return;
      }
      try {
        const row = await sendMoment({ squadId, dmThreadId, userId: user.id, mediaUrl, mediaKind, caption });
        setChatErr(null);
        setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, toLocal(row)]));
      } catch (e) {
        setChatErr(explainChat(e));
      }
    } else {
      setMsgs((m) => [...m, { id: 'x' + Date.now(), from: 'me', userId: user && user.id, kind: 'moment', mediaUrl, mediaKind, createdAt: new Date().toISOString(), text: caption || '🔥 Moment' }]);
    }
    setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80);
  };

  useEffect(() => {
    if (!isReal) return;
    let unsub = null;
    let cancelled = false;
    (async () => {
      const squadId = group ? chat.id : null;
      let threadId = dmThreadId;
      if (!group && !threadId) {
        try {
          threadId = await getOrCreateDmThread(peer.id);
        } catch (e) {
          if (!cancelled) setChatErr(explainChat(e));
          threadId = null;
        }
        if (cancelled) return;
        setDmThreadId(threadId);
      }
      if (!squadId && !threadId) return;
      const rows = await fetchMessages({ squadId, dmThreadId: threadId }).catch(() => []);
      if (cancelled) return;
      const local = (rows || []).map(toLocal);
      setMsgs(local);
      local.filter((r) => r.gameMatchId).forEach((r) => loadMatch(r.gameMatchId));
      setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: false }), 60);
      unsub = subscribeMessages({ squadId, dmThreadId: threadId }, (payload) => {
        const row = payload.new;
        setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, toLocal(row)]));
        if (row.game_match_id) loadMatch(row.game_match_id);
        setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
      });
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (explicit) => {
    const t = (typeof explicit === 'string' ? explicit : draft).trim();
    if (!t) return;
    tapLight(); sfxPop();
    if (typeof explicit !== 'string') setDraft('');
    if (isReal) {
      const squadId = group ? chat.id : null;
      if (!squadId && !dmThreadId) {
        setChatErr('Messages need one more step: run supabase/RUN_ME.sql in the Supabase SQL Editor.');
        setDraft(t); // give the text back — nothing was sent
        return;
      }
      try {
        const row = await sendMessage({ squadId, dmThreadId, userId: user.id, body: t });
        setChatErr(null);
        setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, { id: row.id, from: 'me', text: t }]));
      } catch (e) {
        setChatErr(explainChat(e));
        setDraft(t); // honest failure: keep the message in the box
      }
    } else {
      setMsgs((m) => [...m, { id: 'x' + Date.now(), from: 'me', text: t }]);
    }
    setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 60);
  };

  const callPeer = group ? { name: chat.name, avatar: chat.members ? chat.members[0] : AV_NEUTRAL } : peer;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#FFF' }}>
          <Pressable onPress={() => { tapLight(); onClose(); }} hitSlop={10} style={{ marginRight: 4 }}>
            <Ionicons name="chevron-back" size={28} color={C.text} />
          </Pressable>
          {group ? (
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{chat.emoji}</Text>
            </View>
          ) : (
            <View>
              <Image source={{ uri: avatarUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              {peerOnlineNow ? <OnlineDot size={11} ring={1.5} /> : null}
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{title}</Text>
              {streak.n > 0 ? <View style={{ marginLeft: 7 }}><StreakBadge info={streak} /></View> : null}
            </View>
            <Text style={{ color: ttl > 0 ? C.purple : (/now/.test(activeLabel) ? C.green : C.faint), fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>
              {ttl > 0 ? '⏳ Disappear after ' + ((TTL_OPTIONS.find((o) => o.h === ttl) || {}).label || '').replace(' · default', '') : activeLabel}
            </Text>
          </View>
          {!group && isReal ? (
            <Pressable onPress={() => { tapLight(); setTtlOpen((v) => !v); }} hitSlop={8} style={{ marginRight: 10 }}>
              <Ionicons name="timer-outline" size={22} color={ttl ? C.purple : C.dim} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => { tapMedium(); setCall({ video: false }); }} hitSlop={8} style={{ marginHorizontal: 10 }}>
            <Ionicons name="call-outline" size={23} color={C.purple} />
          </Pressable>
          <Pressable onPress={() => { tapMedium(); setCall({ video: true }); }} hitSlop={8}>
            <Ionicons name="videocam-outline" size={25} color={C.purple} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {visibleMsgs.map((m) => {
              const mine = m.from === 'me';
              return (
                <View key={m.id} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end' }}>
                  {!mine && group ? <Image source={{ uri: m.from.avatar }} style={{ width: 26, height: 26, borderRadius: 13, marginRight: 7 }} /> : null}
                  <View style={{ maxWidth: '76%' }}>
                    {!mine && group ? <Text style={{ color: C.faint, fontSize: 10.5, marginBottom: 3, marginLeft: 4 }}>{m.from.name}</Text> : null}
                    {m.kind === 'game_invite' ? (
                      /* a real Catch Your Mate invite — state-driven off
                         the actual game_matches row, not a static card */
                      (() => {
                        const match = matches[m.gameMatchId];
                        const status = match ? match.status : 'pending';
                        const myResult = match && match.status === 'done'
                          ? (match.winner_id == null ? 'tie' : match.winner_id === user.id ? 'won' : 'lost')
                          : null;
                        return (
                          <View style={{ backgroundColor: '#0D2B5E', borderRadius: 18, padding: 14, minWidth: 210 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ fontSize: 20, marginRight: 8 }}>🏃</Text>
                              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900', flex: 1 }}>Catch Your Mate</Text>
                            </View>
                            {status === 'declined' ? (
                              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}>Declined</Text>
                            ) : status === 'done' ? (
                              <Text style={{ color: myResult === 'won' ? C.gold : '#FFF', fontSize: 12.5, fontWeight: '800' }}>
                                {myResult === 'won' ? '🏆 You won this duel' : myResult === 'lost' ? '😅 You lost this one' : '🤝 It was a tie'}
                              </Text>
                            ) : mine ? (
                              <Pressable onPress={() => setActiveMatch({ matchId: m.gameMatchId, isHost: true, opponent: { id: peer.id, name: peer.name, avatar: peer.avatar } })}>
                                <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 8, alignItems: 'center' }}>
                                  <Text style={{ color: '#081226', fontSize: 12.5, fontWeight: '900' }}>{status === 'active' ? 'Open' : 'Waiting…'}</Text>
                                </View>
                              </Pressable>
                            ) : (
                              <View style={{ flexDirection: 'row' }}>
                                <Pressable onPress={() => joinMatch(m.gameMatchId)} style={{ flex: 1, marginRight: 8 }}>
                                  <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingVertical: 8, alignItems: 'center' }}>
                                    <Text style={{ color: '#081226', fontSize: 12.5, fontWeight: '900' }}>Join</Text>
                                  </View>
                                </Pressable>
                                <Pressable onPress={() => declineMatch(m.gameMatchId)} style={{ flex: 1 }}>
                                  <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 8, alignItems: 'center' }}>
                                    <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>Decline</Text>
                                  </View>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      })()
                    ) : (m.kind === 'moment' || m.mediaUrl) ? (
                      /* a Moment — a circular snap. Received: mystery circle you
                         can open twice, then it's gone. Long-press to save it. */
                      (() => {
                        const vc = snapViews(m.id);
                        const expired = !mine && vc >= 2;
                        return (
                          <Pressable
                            onPress={() => { if (!expired) openSnap(m, mine); }}
                            onLongPress={() => saveSnap(m.mediaUrl, m.mediaKind)}
                            delayLongPress={450}
                          >
                            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                              <LinearGradient
                                colors={expired ? ['#B9B9C2', '#B9B9C2'] : [C.coral, C.gold, C.purple]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', opacity: expired ? 0.55 : 1 }}
                              >
                                <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: mine ? '#000' : C.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {mine ? (
                                    m.mediaKind === 'video' ? <Text style={{ fontSize: 28 }}>🎬</Text> : <Image source={{ uri: m.mediaUrl }} style={{ width: 88, height: 88 }} resizeMode="cover" />
                                  ) : (
                                    <Text style={{ fontSize: 30 }}>{expired ? '👀' : '🔥'}</Text>
                                  )}
                                </View>
                              </LinearGradient>
                              <Text style={{ color: expired ? C.faint : C.dim, fontSize: 10.5, fontWeight: '800', marginTop: 4, marginHorizontal: 4 }}>
                                {mine ? 'Sent 🔥' : expired ? 'Opened' : (vc === 1 ? 'Tap once more 🔥' : 'Tap to view 🔥')}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })()
                    ) : (
                    <View style={{ backgroundColor: mine ? C.purple : '#FFF', borderWidth: mine ? 0 : 1, borderColor: C.line, borderRadius: 18, borderBottomRightRadius: mine ? 5 : 18, borderBottomLeftRadius: mine ? 18 : 5, paddingHorizontal: 14, paddingVertical: 9 }}>
                      <Text style={{ color: mine ? '#FFF' : C.text, fontSize: 14.5, lineHeight: 20 }}>{m.text}</Text>
                    </View>
                    )}
                  </View>
                </View>
              );
            })}

            {todOn ? <TruthOrDare players={players} onRemove={() => setTodOn(false)} /> : null}
            {wyrOn ? <WouldYouRather onRemove={() => setWyrOn(false)} /> : null}
          </ScrollView>

          {/* disappearing-messages picker */}
          {ttlOpen ? (
            <View style={{ position: 'absolute', top: 4, right: 12, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 6, zIndex: 20, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
              <Text style={{ color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>DISAPPEARING MESSAGES ⏳</Text>
              {TTL_OPTIONS.map((o) => (
                <Pressable key={String(o.h)} onPress={() => pickTtl(o.h)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Ionicons name={effTtl === o.h ? 'radio-button-on' : 'radio-button-off'} size={16} color={effTtl === o.h ? C.purple : C.faint} />
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: effTtl === o.h ? '900' : '600', marginLeft: 9 }}>{o.label}</Text>
                  </View>
                </Pressable>
              ))}
              <Text style={{ color: C.faint, fontSize: 10, paddingHorizontal: 12, paddingBottom: 8, maxWidth: 200 }}>
                Older messages are really deleted for both of you — not just hidden.
              </Text>
            </View>
          ) : null}

          {/* games menu */}
          {menu ? (
            <View style={{ position: 'absolute', bottom: 70, left: 12, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
              <Pressable onPress={() => { tapLight(); setMenu(false); setTodOn(true); setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 20 }}>🎲</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Truth or Dare</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>Play it right here</Text>
                  </View>
                </View>
              </Pressable>
              <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 10 }} />
              <Pressable onPress={() => { tapLight(); setMenu(false); setWyrOn(true); setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 20 }}>🤔</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Would You Rather</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>Pick a side, see the split</Text>
                  </View>
                </View>
              </Pressable>
              <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 10 }} />
              <Pressable onPress={() => { tapLight(); setMenu(false); setSplitOn(true); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                  <Text style={{ fontSize: 20 }}>🧾</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Split a bill</Text>
                    <Text style={{ color: C.faint, fontSize: 11 }}>Share the total fairly, send it here</Text>
                  </View>
                </View>
              </Pressable>
              {!group && isReal ? (
                <>
                  <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 10 }} />
                  <Pressable onPress={() => { setMenu(false); inviteToMatch(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 }}>
                      <Text style={{ fontSize: 20 }}>🏃</Text>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>Catch Your Mate</Text>
                        <Text style={{ color: C.faint, fontSize: 11 }}>Real-time duel — 45 seconds, live</Text>
                      </View>
                    </View>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {/* streak-about-to-break nudge — send a Moment today to keep it */}
          {!group && streak.n > 0 && streak.expiring ? (
            <Pressable onPress={() => { tapMedium(); setMomentOpen(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.14)', borderTopWidth: 1, borderTopColor: 'rgba(245,158,11,0.35)', paddingHorizontal: 14, paddingVertical: 9 }}>
                <Text style={{ fontSize: 15 }}>⏳</Text>
                <Text style={{ color: '#B45309', fontSize: 12.5, fontWeight: '800', marginLeft: 8, flex: 1 }}>
                  Keep your {streak.n}-day streak 🔥 — send a Moment today{streak.hoursLeft > 0 ? ' · ' + streak.hoursLeft + 'h left' : ''}
                </Text>
                <Text style={{ color: '#B45309', fontSize: 12, fontWeight: '900' }}>Send →</Text>
              </View>
            </Pressable>
          ) : null}

          {/* honest failure banner — the message is still in the box */}
          {chatErr ? (
            <View style={{ backgroundColor: C.coralSoft, borderTopWidth: 1, borderTopColor: 'rgba(244,63,94,0.35)', paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ color: C.coral, fontSize: 12, fontWeight: '700', lineHeight: 17 }}>⚠️ {chatErr}</Text>
            </View>
          ) : null}

          {/* input bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#FFF' }}>
            <Pressable onPress={() => { tapLight(); setMenu((v) => !v); }} hitSlop={8} style={{ marginRight: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: menu ? C.purple : C.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={menu ? 'close' : 'game-controller'} size={19} color={menu ? '#FFF' : C.purple} />
              </View>
            </Pressable>
            {/* shoot a Moment — a Snapchat-style snap, straight into the chat */}
            <Pressable onPress={() => { tapMedium(); setMomentOpen(true); }} hitSlop={8} style={{ marginRight: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.coralSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera" size={19} color={C.coral} />
              </View>
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 22, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 3 }}>
              <TextInput
                placeholder="Message…"
                placeholderTextColor={C.faint}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={send}
                style={{ flex: 1, color: C.text, fontSize: 14.5 }}
              />
              <Ionicons name="happy-outline" size={20} color={C.faint} />
            </View>
            <Pressable onPress={send} hitSlop={8} style={{ marginLeft: 8 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="send" size={17} color="#FFF" style={{ marginLeft: -1 }} />
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      {call ? <CallScreen peer={callPeer} video={call.video} onClose={() => setCall(null)} /> : null}

      {/* ── Catch Your Mate — real live duel ── */}
      {activeMatch ? (
        <GameRunner
          key={activeMatch.matchId}
          matchId={activeMatch.matchId}
          isHost={activeMatch.isHost}
          opponent={activeMatch.opponent}
          onRematch={rematch}
          onClose={() => setActiveMatch(null)}
        />
      ) : null}

      {/* ── shoot a Moment — full camera (filters · effects · songs) ── */}
      {momentOpen ? (
        <CaptureModal
          sendMode
          sendToName={group ? chat.name : (peer && (peer.name || '').split(' ')[0])}
          onMoment={handleSendMoment}
          onClose={() => setMomentOpen(false)}
        />
      ) : null}

      {/* ── full-screen Moment viewer ── */}
      {viewMoment ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewMoment(null)}>
          <Pressable onPress={() => setViewMoment(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' }}>
            {viewMoment.mediaKind === 'video' && Platform.OS === 'web' ? (
              <video src={viewMoment.mediaUrl} controls autoPlay loop playsInline style={{ width: '100%', height: '80%', objectFit: 'contain' }} />
            ) : (
              <Image source={{ uri: viewMoment.mediaUrl }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
            )}
            <Pressable onPress={() => setViewMoment(null)} style={{ position: 'absolute', top: insets.top + 14, right: 18 }} hitSlop={12}>
              <Ionicons name="close" size={30} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => saveSnap(viewMoment.mediaUrl, viewMoment.mediaKind)} style={{ position: 'absolute', bottom: insets.bottom + 26, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 }} hitSlop={8}>
              <Ionicons name="download-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900', marginLeft: 7 }}>Save</Text>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* ── SPLIT A BILL — real calculator, sends the result to the chat ── */}
      {splitOn ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSplitOn(false)}>
          <Pressable onPress={() => setSplitOn(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 22 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 }} />
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Split a bill 🧾</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 14 }}>Split the total fairly and drop it in the chat.</Text>

              <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Total amount</Text>
              <TextInput
                placeholder="e.g. 800" placeholderTextColor={C.faint} value={splitTotal} onChangeText={setSplitTotal}
                keyboardType="decimal-pad"
                style={{ color: C.text, fontSize: 20, fontWeight: '800', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>People</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 14 }}>
                    <Pressable onPress={() => { tapLight(); setSplitPeople(String(Math.max(1, (parseInt(splitPeople, 10) || 1) - 1))); }} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="remove" size={18} color={C.purple} />
                    </Pressable>
                    <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: 17, fontWeight: '800' }}>{splitPeople}</Text>
                    <Pressable onPress={() => { tapLight(); setSplitPeople(String((parseInt(splitPeople, 10) || 1) + 1)); }} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="add" size={18} color={C.purple} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ width: 110 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Tip %</Text>
                  <TextInput
                    placeholder="0" placeholderTextColor={C.faint} value={splitTip} onChangeText={setSplitTip}
                    keyboardType="number-pad"
                    style={{ color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12 }}
                  />
                </View>
              </View>

              <View style={{ backgroundColor: C.purpleSoft, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>EACH PERSON PAYS</Text>
                <Text style={{ color: C.text, fontSize: 30, fontWeight: '900', marginTop: 4 }}>
                  {(Math.round(splitShare.per * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>
                  total {(Math.round(splitShare.grand * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ {splitShare.ppl}
                </Text>
              </View>

              <Pressable onPress={sendSplit}>
                <View style={{ backgroundColor: parseFloat(splitTotal) > 0 ? C.purple : C.glassHi, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: parseFloat(splitTotal) > 0 ? '#FFF' : C.faint, fontSize: 14.5, fontWeight: '900' }}>Send to chat 🧾</Text>
                </View>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Modal>
  );
};
