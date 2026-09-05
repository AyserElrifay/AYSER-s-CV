import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView, Modal, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { SQUADS, DMS } from '../constants/mockData'; // demo-mode fallback only
import { SUPABASE_READY } from '../lib/supabase';
import { compressImage, uploadMediaSmart } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { usePresence } from '../context/PresenceContext';
import { fetchMyDmThreads, fetchMySquads, createSquad, leaveSquad, addSquadMember, fetchSquadMemberIds, fetchDmStreaks } from '../services/messages';
import { fetchIncomingRequests, acceptRequest, fetchMyMates } from '../services/mates';
import { getProfile, updateProfile } from '../services/profiles';
import { AV_NEUTRAL } from '../constants/mockData';
import { fetchLanguagePartners, searchProfiles } from '../services/social';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { AvatarStack } from '../components/AvatarStack';
import { Chip } from '../components/Chip';
import { Glass } from '../components/Glass';
import { OnlineDot } from '../components/OnlineDot';
import { Page } from '../components/Page';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { StreakBadge } from '../components/StreakBadge';
import { Tick } from '../components/Tick';
import { sendMoment } from '../services/messages';
import { ChatThread } from './ChatThread';
import { AlbumSheet } from '../components/green/AlbumSheet';
import { ProgrammesSheet } from '../components/green/ProgrammesSheet';
import { isOwner } from '../services/music';
import { tapLight, tapSelection, tapSuccess, tapCelebrate } from '../utils/feedback';
import { isUnread, markThreadSeen } from '../lib/seen';
import { setupNotice } from '../lib/plumbing';

/* Fetched when it is opened, not when the app starts. */
import { lazyOverlay } from '../lib/lazyScreen';
const CaptureModal = lazyOverlay(() => import('../components/CaptureModal').then((m) => ({ default: m.CaptureModal })));

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

/* ── language-exchange row helpers ────────────────────────────────
   All of these read what the person actually put on their profile —
   none of them invent a status, a level or a time. */

// "Español Spanish" / "English" → the short badge (ES, EN, RO…)
const LANG_CODES = {
  english: 'EN', arabic: 'AR', french: 'FR', spanish: 'ES', german: 'DE',
  italian: 'IT', portuguese: 'PT', russian: 'RU', turkish: 'TR', dutch: 'NL',
  romanian: 'RO', japanese: 'JA', korean: 'KO', chinese: 'ZH', mandarin: 'ZH',
  hindi: 'HI', urdu: 'UR', persian: 'FA', farsi: 'FA', greek: 'EL',
  polish: 'PL', swedish: 'SV', hebrew: 'HE', indonesian: 'ID', thai: 'TH',
};
function shortLang(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  for (const word of raw.toLowerCase().split(/[^a-z]+/)) {
    if (LANG_CODES[word]) return LANG_CODES[word];
  }
  const letters = raw.replace(/[^A-Za-z]/g, '');
  return (letters ? letters.slice(0, 2) : raw.slice(0, 2)).toUpperCase();
}

// their OWN stated level (A1…C2) → how many of the five dots are filled
function levelDots(level) {
  const l = String(level || '').trim().toUpperCase();
  const map = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 5 };
  return map[l] || 0;
}

/* Somebody with no character built and no photo used to get the neutral
   grey figure, which on a dark card is a hole where a face should be.
   A letter on a colour is better in every way: it always renders, it
   needs no network, and the colour is stable per person so you start to
   recognise them by it. */
const INITIAL_COLORS = ['#7C5CFF', '#FB7185', '#F5B301', '#38BDF8', '#34D399', '#F472B6'];
function colorFor(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return INITIAL_COLORS[h % INITIAL_COLORS.length];
}
const initialOf = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

const ONLINE_MS = 5 * 60 * 1000;
const isOnline = (iso) => !!iso && Date.now() - new Date(iso).getTime() < ONLINE_MS;

/* Only ever says something when we genuinely know when they were last
   here — no "Active now" for someone we've never seen. */
function activeLabel(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 0) return null;
  if (mins < 5) return 'Active now';
  if (mins < 60) return 'Active ' + mins + ' minutes ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return 'Active ' + hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days <= 7) return 'Active ' + days + 'd ago';
  return 'Recently active';
}

/* ─── ONE ROW FOR EVERYTHING THAT IS NOT A CONVERSATION ───────────────
   Ayser, a second time: "أنا مش عجبني ان tap chats زحمه كده".

   The first pass fixed the ORDER — conversations went to the top. It
   did not fix the amount. Under two conversations there were still
   two cards with a subtitle each, two section headings, a paragraph
   explaining the language exchange, a settings row and a line saying
   nobody had switched it on: about two hundred and fifty pixels of
   places-to-go and admin, permanently, on the screen you open to talk
   to somebody.

   None of it is unimportant and none of it is a conversation. So it is
   one row of round buttons under the title — the same move Telegram
   makes with folders and WhatsApp with the status row — and everything
   they used to explain lives inside the thing they open.

   The rest of the screen is people, which is what it is for. */
const Shortcut = ({ emoji, label, onPress }) => (
  <Pressable onPress={onPress} style={{ alignItems: 'center', width: 76 }}>
    <View style={{
      width: 52, height: 52, borderRadius: 26, backgroundColor: C.glass,
      borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 23 }}>{emoji}</Text>
    </View>
    {/* two lines, because "شركاء التبادل" does not fit on one and a
        label cut off mid-word is worse than a label on two lines */}
    <Text numberOfLines={2} style={{ color: C.dim, fontSize: 10.5, lineHeight: 13, fontWeight: '800', marginTop: 5, textAlign: 'center', width: 74 }}>
      {label}
    </Text>
  </Pressable>
);

export const ChatsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOnline } = usePresence(); // real-time — a live Supabase Presence connection
  const { t } = useLang();
  const [thread, setThread] = useState(null); // { chat, group }
  const [composing, setComposing] = useState(false); // new-message search sheet
  const [albumOpen, setAlbumOpen] = useState(false);  // the Green Minds album
  const [progOpen, setProgOpen] = useState(false);    // exchanges & programmes
  /* Whether this row is drawn at all. It is a convenience, never the
     protection: the server refuses green_album() to anybody who is not
     an owner regardless of what any screen chooses to show. */
  const owner = isOwner(user);
  const [composeQ, setComposeQ] = useState('');
  const [composeResults, setComposeResults] = useState([]);
  const [composeBusy, setComposeBusy] = useState(false);
  /* ── null MEANS "WE DO NOT KNOW YET" ──────────────────────────────
     These used to start as empty arrays, and an empty array is a
     statement: it says there is nobody. So the very first frame of this
     screen announced "Nobody in here yet" — with a card, an
     illustration and two buttons — to somebody with a dozen
     conversations, and then replaced it with the real list a moment
     later. That flash of a confident, wrong screen is what reads as the
     app hanging and then correcting itself.

     null is the honest starting value: nothing has answered yet. The
     empty card is only allowed to appear once something actually has. */
  const [realDms, setRealDms] = useState(null);
  const [realSquads, setRealSquads] = useState(null);
  const [realPartners, setRealPartners] = useState(null);
  const [chatsErr, setChatsErr] = useState(false);
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
  /* The exchange settings live in a sheet now, not on the main screen —
     see the note above the render for why. */
  const [exOpen, setExOpen] = useState(false);
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

  /* ── A REQUEST THAT NEVER COMES BACK ──────────────────────────────
     Catching a rejection is only half of it. A request can also simply
     never answer — the connection dies mid-flight, the phone changes
     network, the socket is left open — and then nothing rejects and
     nothing resolves. The placeholder rows sit there for ever, and
     "loading" that never ends is the most confusing state a screen can
     be in, because it looks like your conversations might still be
     coming.

     Twelve seconds is long enough for a slow connection and short
     enough to stop pretending. After that it says the connection
     failed, which is what has actually happened, and offers to try
     again. Same bell the travel plans use, for the same reason. */
  const bellRef = useRef(null);
  const dmsAnswered = useRef(false);
  useEffect(() => () => clearTimeout(bellRef.current), []);
  const reload = useCallback(() => {
    if (!SUPABASE_READY || !user) return;
    /* A failure has to resolve too, or the screen waits for ever on a
       request that is never coming back. */
    setChatsErr(false);
    dmsAnswered.current = false;
    clearTimeout(bellRef.current);
    bellRef.current = setTimeout(() => {
      if (!dmsAnswered.current) { setRealDms([]); setChatsErr(true); }
      // squads are secondary: stop waiting, don't call it an error
      setRealSquads((v) => (v === null ? [] : v));
    }, 12000);
    fetchMyDmThreads(user.id)
      .then((rows) => { dmsAnswered.current = true; setRealDms(rows); })
      .catch(() => { dmsAnswered.current = true; setRealDms([]); setChatsErr(true); });
    fetchMySquads(user.id).then(setRealSquads).catch(() => setRealSquads([]));
    fetchLanguagePartners(user.id).then(setRealPartners).catch(() => setRealPartners([]));
    fetchIncomingRequests(user.id).then(setMateRequests).catch(() => {});
    fetchMyMates(user.id).then(setMyMates).catch(() => {});
    fetchDmStreaks(user.id).then(setStreaks).catch(() => {});
  }, [user]);

  const accept = async (req) => {
    // letting someone in is not a button press, and shouldn't feel like one
    tapCelebrate();
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

  /* ── PULL DOWN, SHOOT, SEND ──────────────────────────────────────
     A streak is only worth having if keeping it is easy. Pull the list
     down, the camera opens; take the shot, tick whoever it's going to,
     send. No hunting for a button, no opening a conversation first. */
  const [shooting, setShooting] = useState(false);
  const [pendingShot, setPendingShot] = useState(null);   // { mediaUrl, mediaKind, caption }
  const [sendTo, setSendTo] = useState({});               // { [threadId]: true }
  const [sendBusy, setSendBusy] = useState(false);
  const [sendDone, setSendDone] = useState(0);

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
  const [squadPhoto, setSquadPhoto] = useState(null); // { preview, url } once uploaded
  const [squadPhotoBusy, setSquadPhotoBusy] = useState(false);
  const pickSquadPhoto = () => {
    if (typeof document === 'undefined') return;
    tapLight();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      setSquadPhotoBusy(true);
      try {
        const small = await compressImage(URL.createObjectURL(f), 600, 0.85);
        const url = await uploadMediaSmart(user.id, small, 'jpg', 'image/jpeg');
        setSquadPhoto({ preview: url, url });
      } catch (e) { setSquadErr('Could not upload that photo.'); }
      finally { setSquadPhotoBusy(false); }
    };
    input.click();
  };
  const submitSquad = async () => {
    if (!squadName.trim() || !SUPABASE_READY || !user) return;
    setSquadErr(null);
    try {
      await createSquad(user.id, { name: squadName.trim(), emoji: squadEmoji.trim() || '🏕️', avatarUrl: squadPhoto && squadPhoto.url });
      tapLight();
      setSquadCreating(false); setSquadName(''); setSquadEmoji('🏕️'); setSquadPhoto(null);
      reload();
    } catch (e) {
      setSquadErr(/does not exist|policy|security/i.test(e.message || '')
        ? setupNotice('Squads need one setup step in Supabase — run RUN_ME.sql.')
        : 'Could not create the squad.');
    }
  };
  const closeSquad = async (s) => {
    tapLight();
    setRealSquads((list) => list.filter((x) => x.id !== s.id));
    try { await leaveSquad(s.id, user.id); } catch (e) { reload(); }
  };

  // ── invite mates into a squad — a real membership row per person ──
  const [inviteSquad, setInviteSquad] = useState(null); // the squad you're adding people to
  const [invited, setInvited] = useState({});           // { mateId: true } — just-added this session
  const [members, setMembers] = useState({});           // { mateId: true } — already in the squad (persisted)
  const [inviteErr, setInviteErr] = useState(null);
  const openInvite = (s) => {
    tapLight(); setInviteErr(null); setInvited({}); setMembers({}); setInviteSquad(s);
    // load who's already a member so saved invites clearly show as "Member"
    fetchSquadMemberIds(s.id).then((ids) => {
      const map = {}; ids.forEach((id) => { map[id] = true; });
      setMembers(map);
    }).catch(() => {});
  };
  const inviteMate = async (mate) => {
    if (!inviteSquad || !user) return;
    tapLight();
    setInvited((v) => ({ ...v, [mate.id]: true }));
    try {
      await addSquadMember(inviteSquad.id, mate.id);
      setMembers((v) => ({ ...v, [mate.id]: true })); // it's saved — mark as a real member
    } catch (e) {
      setInvited((v) => { const n = { ...v }; delete n[mate.id]; return n; });
      setInviteErr(/does not exist|policy|security|row-level/i.test(e.message || '')
        ? setupNotice('Inviting mates needs the latest setup step — run RUN_ME.sql once.')
        : 'Could not add them.');
    }
  };

  const squads = SUPABASE_READY ? (realSquads || []) : SQUADS;
  // still waiting on the server — not "there is nobody"
  const loadingChats = SUPABASE_READY && !!user && (realDms === null || realSquads === null);
  /* `d.user` is somebody else's profile row, and a row that can't be
     read comes back empty. Reaching into it without asking is what
     turned one unreadable profile into a crash that took the whole tab
     with it — the service hands back a stand-in now, and this reads
     defensively on top of that, because the cost of being wrong here is
     every conversation you have. */
  const dms = SUPABASE_READY
    ? (realDms || [])
        .filter((d) => d && d.threadId)
        .map((d) => {
          const u = d.user || {};
          return {
            id: d.threadId,
            threadId: d.threadId,
            user: {
              id: u.id,
              name: u.name || 'Someone',
              /* The character they built, when they built one — it's
                 their face in this app, and a list of drawn people
                 reads as a place rather than a contacts book. Their
                 photo, then a neutral, when they haven't. */
              avatar: (u.id && u.avatar_dna ? buildAvatarUrl(u.id, u.avatar_dna) : null) || u.avatar_url || null,
              verified: !!u.verified,
            },
            last: d.last,
            time: timeAgo(d.time),
            // nothing has been said in here yet
            fresh: !d.time,
            // real now — see src/lib/seen.js
            unread: isUnread(d.threadId, d.time, d.lastFrom, user && user.id),
            translated: false,
          };
        })
    : DMS;
  const myFlag = user && user.country_flag;
  /* ONLY people who really switched exchange on. Nothing here is
     invented: every language, flag, bio and "active" time is that
     person's own data. Without a backend there are no partners to
     show, so the list is honestly empty rather than filled with
     made-up people. */
  const partners = SUPABASE_READY
    ? (realPartners || [])
        .map((p) => ({
          id: p.id,
          name: p.name || 'Explorer',
          avatar: p.avatar_url || buildAvatarUrl(p.id, p.avatar_dna),
          flag: p.country_flag || '',
          country: p.country,
          speaks: p.speaks_language || '',
          learning: p.learning_language || '',
          level: p.learning_level || '',
          bio: p.bio || '',
          hobbies: String(p.hobbies || '').split(',').map((h) => h.trim()).filter(Boolean).slice(0, 4),
          lastActive: p.last_active_at || null,
          abroad: !!(p.country_flag && myFlag && p.country_flag !== myFlag),
        }))
        // people from ANOTHER country first — the whole point of exchange
        .sort((a, b) => (b.abroad ? 1 : 0) - (a.abroad ? 1 : 0))
    : [];

  return (
  <Page onSwipeCamera={() => { setShooting(true); }}>

    {/* ─── WHY THIS ORDER CHANGED ──────────────────────────────────────
       Ayser: "ليه شكل الشاتس زحمه و مش سهل ومش طبيعي و كائيب مش ممتع مش
       محفز علي الكلام".

       He was right, and the reason was not the styling. Your actual
       conversations were the SIXTH thing on this screen — under Green
       Minds, under Exchanges, under mate requests, under your mates,
       under squads — and when you had no conversations yet the section
       did not render at all. So the Chats screen opened onto five
       headings, two navigation cards and a settings form with a toggle,
       two text boxes and a Save button, and not one word anybody had
       said to anybody.

       That is why it felt crowded and discouraging: everything on it was
       admin, and the thing you came to do was not there. Every messaging
       app worth copying opens onto people and what they last said.

       So: conversations first, then the fastest ways to start one (your
       mates, requests, squads), then the places to go, and the exchange
       settings moved off the screen entirely into a sheet behind one
       button — because it is configuration you touch twice a year, not
       content. */}

    <ScreenHeader
      kicker={t('connections_kicker')}
      title={t('chats_title')}
      right={
        <Pressable onPress={() => { tapLight(); setComposing(true); setComposeQ(''); setComposeResults([]); }} hitSlop={8}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="create-outline" size={17} color={C.purple} />
          </View>
        </Pressable>
      }
    />

    {/* the places to go, in one line, above your conversations */}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16, marginTop: 2 }}>
      {owner ? <Shortcut emoji="🌿" label={t('green_album')} onPress={() => { tapLight(); setAlbumOpen(true); }} /> : null}
      <Shortcut emoji="🎒" label={t('prog_title')} onPress={() => { tapLight(); setProgOpen(true); }} />
      {SUPABASE_READY ? (
        <Shortcut emoji="🌍" label={t('exchange_partners')} onPress={() => { tapLight(); setExOpen(true); }} />
      ) : null}
    </View>

    {dms.length ? <SectionHeader title={t('direct_label')} /> : null}
    {dms.length ? dms.map((d) => (
      <Pressable key={d.id} onPress={() => { tapLight(); markThreadSeen(d.threadId); setThread({ chat: d, group: false }); }}>
        <Glass style={{ padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <View>
            {d.user.avatar ? (
              <Image source={{ uri: d.user.avatar }} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.glassHi }} />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colorFor(d.user.id), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>{initialOf(d.user.name)}</Text>
              </View>
            )}
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
            {/* ── THE STATUS LINE ──────────────────────────────────────
                The thing that makes a chat list readable without
                reading it: a colour and a shape that say what is
                waiting for you. A filled square means something new,
                a hollow one means you've seen it, and the word next
                to it names it. You can run your eye down the column
                and know where to go. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View
                style={{
                  width: 9, height: 9, borderRadius: 2.5, marginRight: 6,
                  backgroundColor: d.unread ? C.purple : 'transparent',
                  borderWidth: d.unread ? 0 : 1.5, borderColor: C.faint,
                }}
              />
              <Text
                style={{ color: d.unread ? C.purple : C.dim, fontSize: 11.5, fontWeight: d.unread ? '900' : '700' }}
                numberOfLines={1}
              >
                {d.unread ? 'New message' : d.fresh ? 'Say hi' : 'Opened'}
              </Text>
              {/* a brand-new thread has no last message — the status
                  already says everything, so don't echo it back */}
              {d.fresh ? null : (
                <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 6, flex: 1 }} numberOfLines={1}>
                  · {d.last}
                </Text>
              )}
            </View>
            {d.translated ? (
              <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>{t('ch_tap_translate')}</Text>
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
    )) : null}

    {/* ── NOTHING HERE YET ─────────────────────────────────────────────
        One invitation, not three apologies. An empty inbox used to be
        announced by a stack of identical grey boxes — no squads, no
        chats, no partners — which is a wall of nothing where the first
        thing you see should be a way in. This is one card with the two
        things that actually start a conversation. */}
    {loadingChats ? (
      /* Quiet placeholder rows while the real ones are on their way.
         They say "something is coming" without saying what, which is
         all we honestly know at this point. */
      [0, 1, 2].map((i) => (
        <Glass key={i} style={{ padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', opacity: 0.5 - i * 0.12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.glassHi }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ height: 11, width: '45%', borderRadius: 6, backgroundColor: C.glassHi }} />
            <View style={{ height: 9, width: '65%', borderRadius: 5, backgroundColor: C.glassHi, marginTop: 8 }} />
          </View>
        </Glass>
      ))
    ) : null}

    {/* ── ASKED, AND COULD NOT BE TOLD ─────────────────────────────────
        An unreachable server and an empty inbox look identical on
        screen, and they are not the same thing: one of them means every
        conversation you have is still there and this is the connection.
        Saying "Nobody in here yet" to somebody whose phone simply lost
        signal is the same lie in a different hat. */}
    {!loadingChats && chatsErr && !dms.length && !squads.length ? (
      <Glass style={{ padding: 22, alignItems: 'center' }}>
        <Text style={{ fontSize: 32 }}>📡</Text>
        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginTop: 8 }}>{t('ch_offline_t')}</Text>
        <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
          {t('ch_offline_b')}
        </Text>
        {/* back to "we don't know yet" first, so the placeholder rows
            come back and the tap visibly does something */}
        <Pressable onPress={() => { tapLight(); setRealDms(null); setRealSquads(null); reload(); }} style={{ marginTop: 14 }}>
          <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 11 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('ch_try_again')}</Text>
          </View>
        </Pressable>
      </Glass>
    ) : null}

    {!loadingChats && !chatsErr && !dms.length && !squads.length ? (
      <Glass style={{ padding: 22, alignItems: 'center', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {['#7C5CFF', '#FB7185', '#F5B301'].map((c, i) => (
            <View
              key={c}
              style={{
                width: 40, height: 40, borderRadius: 20, backgroundColor: c,
                marginLeft: i ? -12 : 0, borderWidth: 2.5, borderColor: C.bg2,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 17 }}>{['👋', '🔥', '💬'][i]}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{t('nobody_here_yet')}</Text>
        <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
          {t('nobody_here_hint')}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 16, alignSelf: 'stretch' }}>
          <Pressable onPress={() => { tapLight(); setComposing(true); setComposeQ(''); setComposeResults([]); }} style={{ flex: 1, marginRight: 9 }}>
            <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('start_a_chat')}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => { tapLight(); setShooting(true); }} style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '900' }}>{t('send_a_snap')}</Text>
            </View>
          </Pressable>
        </View>
        {SUPABASE_READY ? (
          <Pressable onPress={() => { tapLight(); setSquadCreating(true); setSquadErr(null); }} style={{ marginTop: 13 }}>
            <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800' }}>{t('or_start_squad')}</Text>
          </Pressable>
        ) : null}
      </Glass>
    ) : null}

    {/* ── YOUR MATES — one tap opens the chat ── */}
    {myMates.length ? (
      <>
        <SectionHeader title={t('your_mates')} />
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
                <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('wants_to_be_mate')}</Text>
              </View>
              {done ? (
                <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '900' }}>{t('mates_check')}</Text>
                </View>
              ) : (
                <Pressable onPress={() => accept(req)}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('accept_mate')}</Text>
                  </View>
                </Pressable>
              )}
            </Glass>
          );
        })}
        <View style={{ height: 10 }} />
      </>
    ) : null}

    {/* A heading over nothing is worse than no heading. When there are
        no squads yet the label and its button disappear — the empty
        card below carries the way to make one. */}
    {squads.length || squadCreating ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title={t('squads_label')} />
        {SUPABASE_READY ? (
          <Pressable onPress={() => { tapLight(); setSquadCreating((v) => !v); setSquadErr(null); }} hitSlop={8}>
            <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: C.purple, fontSize: 12, fontWeight: '900' }}>{squadCreating ? t('close_x') : t('new_squad')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    ) : null}
    {squadCreating ? (
      <Glass style={{ padding: 12, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={pickSquadPhoto} style={{ marginRight: 8 }}>
            {squadPhoto ? (
              <Image source={{ uri: squadPhoto.preview }} style={{ width: 48, height: 48, borderRadius: 14 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={squadPhotoBusy ? 'hourglass-outline' : 'camera-outline'} size={20} color={C.purple} />
              </View>
            )}
          </Pressable>
          <TextInput value={squadEmoji} onChangeText={setSquadEmoji} maxLength={4}
            style={{ width: 48, textAlign: 'center', fontSize: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginRight: 8 }} />
          <TextInput placeholder={t('ch_squad_name_ph')} placeholderTextColor={C.faint} value={squadName} onChangeText={setSquadName}
            style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }} />
        </View>
        {squadErr ? <Text style={{ color: C.coral, fontSize: 11.5, marginTop: 8 }}>{squadErr}</Text> : null}
        <Pressable onPress={submitSquad} style={{ marginTop: 10 }}>
          <View style={{ backgroundColor: squadName.trim() ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ color: squadName.trim() ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>{t('create_squad')}</Text>
          </View>
        </Pressable>
      </Glass>
    ) : null}
    {squads.length ? squads.map((s) => (
      <Pressable key={s.id} onPress={() => { tapLight(); setThread({ chat: s, group: true }); }}>
        <Glass tint={C.blueSoft} border="rgba(59,130,246,0.35)" style={{ padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {s.avatar_url ? (
              <Image source={{ uri: s.avatar_url }} style={{ width: 46, height: 46, borderRadius: 15, marginRight: 12 }} />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
              </View>
            )}
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
                    <Text style={{ color: C.purple, fontSize: 10.5, fontWeight: '900' }}>＋ {t('ch_invite')}</Text>
                  </Pressable>
                  <Pressable onPress={() => closeSquad(s)} hitSlop={8}>
                    <Text style={{ color: C.coral, fontSize: 10.5, fontWeight: '800' }}>{t('ch_leave')} ✕</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          {s.members ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <AvatarStack uris={s.members} />
              <Text style={{ color: C.faint, fontSize: 11.5, marginLeft: 10 }}>
                {s.members.length} {t('ch_mates_expire')}
              </Text>
            </View>
          ) : null}
        </Glass>
      </Pressable>
    )) : (
      /* No squads and no chats is one situation, not two. It used to be
         told twice, in two grey boxes, one under the other — see the
         single invitation below. */
      null
    )}

    {/* Green Minds, Exchanges and the language partners all used to sit
        here as stacked cards with their own headings and a paragraph of
        explanation. They are three buttons at the top of the screen now,
        and what they used to explain is inside the sheet each one opens.
        See the Shortcut row above, and the note on the component. */}

    {/* The exchange settings, off the main screen. */}
    {exOpen ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setExOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={() => setExOpen(false)} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: insets.bottom + 20 }}>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginBottom: 4 }}>{t('exchange_partners')}</Text>
          <Text style={{ color: C.faint, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>{t('exchange_blurb')}</Text>
      {/* ── your exchange switch — HelloTalk-style, right here ── */}
      {SUPABASE_READY ? (
        <Glass style={{ padding: 13, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 20 }}>🌍</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>
                {exOn ? t('youre_open_exchange') : t('join_exchange')}
              </Text>
              <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>
                {exOn ? t('exchange_on') : t('exchange_off')}
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
                  placeholder={t('i_speak_placeholder')} placeholderTextColor={C.faint}
                  value={exSpeaks} onChangeText={setExSpeaks}
                  style={{ flex: 1, color: C.text, fontSize: 12.5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, marginRight: 8 }}
                />
                <TextInput
                  placeholder={t('ch_learning_ph')} placeholderTextColor={C.faint}
                  value={exLearning} onChangeText={setExLearning}
                  style={{ flex: 1, color: C.text, fontSize: 12.5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9 }}
                />
              </View>
              <Pressable onPress={() => saveExchange(true)} style={{ marginTop: 8 }}>
                <View style={{ backgroundColor: exSaved ? C.greenSoft : C.purpleSoft, borderRadius: 11, paddingVertical: 9, alignItems: 'center' }}>
                  <Text style={{ color: exSaved ? C.green : C.purple, fontSize: 12, fontWeight: '900' }}>
                    {exSaved ? t('saved_live_exchange') : exBusy ? t('saving_dots') : t('save_my_languages')}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}
        </Glass>
      ) : null}

          {/* ── AND THE PEOPLE THEMSELVES ────────────────────────────
              The partner list used to be the bottom third of the Chats
              screen whether or not anybody was in it. It belongs with
              the switch that puts you in it: open the row, set your
              languages, see who else did. */}
          <ScrollView style={{ maxHeight: 430 }} showsVerticalScrollIndicator={false}>
    {partners.length ? (
      <View style={{ marginBottom: 20 }}>
        {partners.map((lp, i) => (
          <Pressable
            key={lp.id}
            onPress={() => { tapLight(); setThread({ chat: { user: lp }, group: false }); }}
            style={{ paddingVertical: 14, borderBottomWidth: i < partners.length - 1 ? 1 : 0, borderBottomColor: C.line }}
          >
            <View style={{ flexDirection: 'row' }}>
              {/* photo + their flag, the way a passport reads */}
              <View style={{ width: 58 }}>
                <Image source={{ uri: lp.avatar }} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.glassHi }} />
                {lp.flag ? (
                  <View style={{ position: 'absolute', bottom: -2, left: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13 }}>{lp.flag}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }} numberOfLines={1}>{lp.name}</Text>

                {/* the actual exchange: what they speak ⇌ what they're learning */}
                {lp.speaks || lp.learning ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    {lp.speaks ? (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '900' }}>{shortLang(lp.speaks)}</Text>
                        <View style={{ height: 2.5, width: 22, borderRadius: 2, backgroundColor: C.green, marginTop: 2 }} />
                      </View>
                    ) : null}
                    {lp.speaks && lp.learning ? (
                      <Ionicons name="swap-horizontal" size={13} color={C.faint} style={{ marginHorizontal: 7 }} />
                    ) : null}
                    {lp.learning ? (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '900' }}>{shortLang(lp.learning)}</Text>
                        {/* their own stated level — five dots, filled to it */}
                        <View style={{ flexDirection: 'row', marginTop: 3 }}>
                          {[0, 1, 2, 3, 4].map((d) => (
                            <View key={d} style={{ width: 4, height: 4, borderRadius: 2, marginRight: 2, backgroundColor: d < levelDots(lp.level) ? C.purple : C.glassHi }} />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* only shown when their profile actually says it */}
                {activeLabel(lp.lastActive) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOnline(lp.lastActive) ? C.green : C.faint, marginRight: 5 }} />
                    <Text style={{ color: C.faint, fontSize: 11 }}>{activeLabel(lp.lastActive)}</Text>
                  </View>
                ) : null}

                {lp.bio ? (
                  <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 6 }} numberOfLines={2}>{lp.bio}</Text>
                ) : null}

                {lp.abroad || lp.hobbies.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                    {lp.abroad && lp.country ? (
                      <View style={{ backgroundColor: C.blueSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginRight: 6, marginBottom: 6 }}>
                        <Text style={{ color: C.blue, fontSize: 11.5, fontWeight: '700' }}>🌍 {lp.country}</Text>
                      </View>
                    ) : null}
                    {lp.hobbies.map((h) => (
                      <View key={h} style={{ backgroundColor: C.glassHi, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginRight: 6, marginBottom: 6 }}>
                        <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700' }}>{h}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* say hi — opens the real chat with them */}
              <Pressable
                onPress={() => { tapLight(); setThread({ chat: { user: lp }, group: false }); }}
                style={{ marginLeft: 8, alignSelf: 'flex-start' }}
              >
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
                  <Text style={{ fontSize: 15 }}>👋</Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>
    ) : (
      // a quiet line, not another grey box — the switch above already
      // says everything this needs to
      <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', paddingVertical: 14, marginBottom: 20 }}>
        {t('exchange_empty')}
      </Text>
    )}
          </ScrollView>
        </View>
      </Modal>
    ) : null}

    {/* stamped again on the way out, so anything that arrived while you
        were reading doesn't come back marked new */}
    {thread ? (
      <ChatThread
        chat={thread.chat}
        group={thread.group}
        onClose={() => { if (!thread.group && thread.chat) markThreadSeen(thread.chat.threadId); setThread(null); }}
      />
    ) : null}

    {/* the pharaohs people made, and the buttons that save them */}
    {albumOpen ? <AlbumSheet onClose={() => setAlbumOpen(false)} /> : null}

    {/* the programmes, and the group chat behind each one */}
    {progOpen ? (
      <ProgrammesSheet
        onClose={() => setProgOpen(false)}
        onOpenGroup={(p) => {
          /* Straight into the squad thread the app already has —
             opening it here rather than inventing a second chat is the
             entire reason a programme is a squad. */
          setProgOpen(false);
          setThread({ chat: { id: p.squad_id, name: p.title, emoji: p.emoji }, group: true });
        }}
      />
    ) : null}

    {/* pull-down camera → shoot → pick who gets it */}
    {shooting ? (
      <CaptureModal
        sendMode
        sendToName="your mates"
        onMoment={async (shot) => { setPendingShot(shot); setSendTo({}); setSendDone(0); setShooting(false); }}
        onClose={() => setShooting(false)}
      />
    ) : null}

    {pendingShot ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setPendingShot(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setPendingShot(null)} />
        <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.line, maxHeight: '76%', paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassHi }} />
          </View>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 10 }}>{t('ch_send_to')}</Text>
          <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 3 }}>
            {sendDone ? t('ch_sent_to') + ' ' + sendDone + ' ' + t(sendDone === 1 ? 'ch_person' : 'ch_people') : t('ch_pick_anyone')}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12 }}>
            {dms.filter((d) => d.threadId).map((d) => {
              const on = !!sendTo[d.threadId];
              return (
                <Pressable key={d.id} onPress={() => { tapSelection(); setSendTo((m) => ({ ...m, [d.threadId]: !m[d.threadId] })); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                    <Image source={{ uri: d.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', flex: 1, marginLeft: 12 }} numberOfLines={1}>{d.user.name}</Text>
                    {streaks[d.threadId] ? <View style={{ marginRight: 10 }}><StreakBadge info={streaks[d.threadId]} /></View> : null}
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? C.purple : C.faint} />
                  </View>
                </Pressable>
              );
            })}
            {!dms.filter((d) => d.threadId).length ? (
              <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 30, lineHeight: 19 }}>
                {t('ch_no_convos')}
              </Text>
            ) : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Pressable
              disabled={sendBusy || !Object.values(sendTo).some(Boolean)}
              onPress={async () => {
                const ids = Object.keys(sendTo).filter((k) => sendTo[k]);
                if (!ids.length || !user) return;
                setSendBusy(true);
                let ok = 0;
                for (const threadId of ids) {
                  try {
                    await sendMoment({ dmThreadId: threadId, userId: user.id, mediaUrl: pendingShot.mediaUrl, mediaKind: pendingShot.mediaKind, caption: pendingShot.caption });
                    ok++;
                  } catch (e) { /* one failing doesn't stop the rest */ }
                }
                setSendBusy(false);
                setSendDone(ok);
                tapSuccess();
                setTimeout(() => { setPendingShot(null); setSendDone(0); }, 900);
              }}
            >
              <View style={{ backgroundColor: C.purple, borderRadius: 16, paddingVertical: 14, alignItems: 'center', opacity: sendBusy || !Object.values(sendTo).some(Boolean) ? 0.5 : 1 }}>
                <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900' }}>
                  {sendBusy ? 'Sending…' : 'Send'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    ) : null}

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
              {inviteSquad.emoji} {t('ch_invite_to')} {inviteSquad.name}
            </Text>
            <Pressable onPress={() => setInviteSquad(null)} hitSlop={8}><Ionicons name="close" size={18} color={C.dim} /></Pressable>
          </View>
          {inviteErr ? <Text style={{ color: C.coral, fontSize: 11.5, paddingHorizontal: 18, marginBottom: 6 }}>{inviteErr}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            {myMates.length ? myMates.map((m) => {
              const isMember = !!members[m.id];
              const justAdded = !!invited[m.id];
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 }}>
                  <Image source={{ uri: m.avatar_url || AV_NEUTRAL }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{m.name || 'Explorer'} {m.country_flag || ''}</Text>
                  </View>
                  {isMember ? (
                    <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                      <Text style={{ color: C.green, fontSize: 12, fontWeight: '900' }}>{justAdded ? t('added_check') : 'In squad ✓'}</Text>
                    </View>
                  ) : justAdded ? (
                    <View style={{ backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                      <Text style={{ color: C.dim, fontSize: 12, fontWeight: '900' }}>{t('ch_adding')}</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => inviteMate(m)}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 7 }}>
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('add_plus')}</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            }) : (
              <View style={{ alignItems: 'center', paddingVertical: 34, paddingHorizontal: 30 }}>
                <Text style={{ fontSize: 26 }}>🤝</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', marginTop: 8 }}>{t('no_mates_yet')}</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{t('invite_mates_hint')}</Text>
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
                placeholder={t('search_people_placeholder')}
                placeholderTextColor={C.faint}
                value={composeQ}
                onChangeText={setComposeQ}
                autoFocus autoCapitalize="none"
                style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 14.5 }}
              />
            </View>
            <Pressable onPress={() => setComposing(false)} style={{ marginLeft: 12 }} hitSlop={8}>
              <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>{t('cancel')}</Text>
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
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>“{composeQ.trim()}” — {t('ch_none_found')}</Text>
            ) : null}
            {!composeQ.trim() && !myMates.length ? (
              <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>{t('ch_search_anyone')}</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    ) : null}
  </Page>
  );
};
