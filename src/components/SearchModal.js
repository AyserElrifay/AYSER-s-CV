import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { USERS, FEED, TRENDING, GROUPS, PLAY_GAMES, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { searchProfiles } from '../services/social';
import { searchPosts, fetchTravelPlans } from '../services/posts';
import { planWhen, upForLabel } from '../constants/travel';
import { fetchGroups, createGroup, joinGroup, leaveGroup, explainGroups } from '../services/groups';
import { fetchTrending, trendWhy, logSearch } from '../services/trending';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { Micro } from './Micro';
import { GameRunner } from './GameRunner';
import { RooftopRush } from './RooftopRush';
import { RockPaperScissors } from './RockPaperScissors';
import { StackGame } from './StackGame';
import { TowerClimb } from './TowerClimb';
import { StreetHop } from './StreetHop';
import { PeopleDiscover } from './PeopleDiscover';
import { isOwner } from '../services/music';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';
import { setupNotice } from '../lib/plumbing';

/* Discover — people, groups, posts and what's trending (X / Facebook style).
   One search box, a tab row, and results that filter as you type. */

const TABS = ['Top', 'People', 'Travel', 'Groups', 'Posts', 'Play'];

const fromProfileRow = (row) => ({
  id: row.id,
  name: row.name || 'Explorer',
  handle: row.handle || '@' + (row.name || 'explorer').toLowerCase().replace(/\s+/g, '.'),
  emoji: row.emoji || '🧿',
  avatar: row.avatar_url || AV_NEUTRAL,
  verified: !!row.verified,
  vouches: row.vouches || 1,
  vouchTag: row.vouch_tag || 'New Explorer',
  intent: row.intent || 'Exploring 🧭',
  moments: row.moments || 0, mates: row.mates || 0, campfires: row.campfires || 0,
  bio: row.bio || 'New to Moments — say hi! 👋',
});

/* ─── THE ROWS LIVE OUT HERE ON PURPOSE ───────────────────────────────
   Every one of these used to be declared inside SearchModal, which
   meant a brand-new component on every single render. React cannot
   tell that this render's GroupRow is last render's GroupRow, so it
   threw the whole list away and built it again — on every keystroke.

   Two things came out of that, and both were reported. The list
   flickered and stuttered as you typed, because it was being rebuilt
   from nothing sixty times a minute. And the group name box lost its
   cursor after every letter, because the box itself was destroyed and
   replaced between one character and the next — which is exactly what
   "it writes one letter and won't let me type a name" is.

   Declared once, out here, they are the same components every time.
   React updates them instead of rebuilding them, memo skips the ones
   whose row did not change, and the text box keeps your cursor. */

const PLAYABLE = ['runner', 'stack', 'rooftop', 'rps', 'tower', 'hop'];

const Section = React.memo(({ title }) => (
  <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 18, marginBottom: 4 }}>{title}</Text>
));

const GameRow = React.memo(({ item, onPlay, t }) => (
  <Pressable onPress={() => onPlay(item)}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
      <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t(item.nameKey)}</Text>
          <View style={{ backgroundColor: C.purpleSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 7 }}>
            <Text style={{ color: C.purple, fontSize: 10, fontWeight: '800' }}>{item.tag}</Text>
          </View>
        </View>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{t(item.playersKey)}</Text>
      </View>
      <View style={{ backgroundColor: PLAYABLE.includes(item.kind) ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
        <Text style={{ color: PLAYABLE.includes(item.kind) ? '#FFF' : C.dim, fontSize: 12, fontWeight: '900' }}>{PLAYABLE.includes(item.kind) ? t('tab_play') : t('in_chat')}</Text>
      </View>
    </View>
  </Pressable>
));

const PersonRow = React.memo(({ item, onOpen }) => (
  <Pressable onPress={() => onOpen(item)}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <Image source={{ uri: item.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{item.name}</Text>
          {item.verified ? <Tick /> : null}
        </View>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{item.handle}</Text>
      </View>
      <Chip label={item.intent} tint={C.purpleSoft} color={C.purple} style={{ borderColor: 'rgba(124,58,237,0.35)' }} />
    </View>
  </Pressable>
));

const GroupRow = React.memo(({ item, onToggle, t }) => (
  <Pressable>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{item.name}</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.members} members{item.about ? ' · ' + item.about : ''}</Text>
      </View>
      {SUPABASE_READY ? (
        <Pressable onPress={() => onToggle(item)}>
          <View style={{ backgroundColor: item.joined ? C.greenSoft : C.purple, borderWidth: item.joined ? 1 : 0, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: item.joined ? C.green : '#FFF', fontSize: 12, fontWeight: '900' }}>{item.joined ? 'Joined ✓' : 'Join'}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{t('join')}</Text>
        </View>
      )}
    </View>
  </Pressable>
));

/* ─── MAKING A GROUP ──────────────────────────────────────────────────
   What you type here stays here. It used to live in SearchModal's own
   state, so every letter re-rendered the entire Discover screen —
   tabs, results, trending, all of it — to show one more character in
   one small box. That is the whole reason this felt heavy.

   It also says what happened. Create either makes a group or explains
   itself; it no longer swallows the reason and leaves you guessing. */
const CreateGroupCard = ({ onCreate, owner, t }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🌐');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!SUPABASE_READY) return null;

  const go = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      await onCreate({ name: name.trim(), emoji: emoji.trim() || '🌐', about: about.trim() });
      setOpen(false); setName(''); setAbout(''); setEmoji('🌐');
    } catch (e) {
      const msg = String((e && (e.message || e.hint)) || '');
      const code = e && e.code;
      /* Told plainly, and differently, because the fix is different:
         a missing table is Ayser's to run, a refused row is a sign-in,
         a dead connection is a retry. */
      setErr(
        msg === 'signin' ? 'Sign in first — a group needs an owner.'
        : msg === 'offline' ? 'Not connected yet. Try again in a moment.'
        /* What to do about it is only useful to the one person who can
           do it. Everybody else gets the plain fact and no back-office
           instructions — a stranger reading "someone has to run the
           setup" learns nothing except that the app is unfinished. */
        : code === '42P01' || /does not exist|schema cache/i.test(msg)
          ? setupNotice('Groups are not switched on yet — run supabase/RUN_ME.sql once.',
                        'Groups aren’t switched on yet. Nothing you did — check back soon.')
        : code === '42501' || /row-level security|policy/i.test(msg) ? "You don't have permission to create a group yet."
        : /fetch|network|Failed to fetch/i.test(msg) ? 'No connection. Check your internet and try again.'
        : 'That did not go through. Try again.'
      );
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <Pressable onPress={() => { tapLight(); setOpen(true); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 14, paddingVertical: 13, marginTop: 12 }}>
          <Ionicons name="add" size={18} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginLeft: 6 }}>{t('create_a_group')}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 12 }}>
      <View style={{ flexDirection: 'row', marginBottom: 9 }}>
        <TextInput value={emoji} onChangeText={setEmoji} maxLength={4} style={{ width: 48, textAlign: 'center', fontSize: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginRight: 8 }} />
        <TextInput
          placeholder={t('group_name_ph')}
          placeholderTextColor={C.faint}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={go}
          style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
        />
      </View>
      <TextInput placeholder={t('group_about_ph')} placeholderTextColor={C.faint} value={about} onChangeText={setAbout} style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }} />
      {err ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(244,63,94,0.10)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 10 }}>
          <Ionicons name="alert-circle-outline" size={14} color={C.coral} style={{ marginTop: 1 }} />
          <Text style={{ color: C.coral, fontSize: 12, marginLeft: 7, flex: 1, lineHeight: 17 }}>{err}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row' }}>
        <Pressable onPress={() => { setOpen(false); setErr(null); }} style={{ flex: 1, marginRight: 8 }}>
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}><Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>{t('cancel')}</Text></View>
        </Pressable>
        <Pressable onPress={go} style={{ flex: 1 }} disabled={busy}>
          <View style={{ backgroundColor: name.trim() && !busy ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
            <Text style={{ color: name.trim() && !busy ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>{busy ? 'Creating…' : 'Create'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const PostRow = React.memo(({ item }) => (
  <Pressable>
    <View style={{ flexDirection: 'row', paddingVertical: 11 }}>
      <Image source={{ uri: item.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{item.user.name}</Text>
          {item.place ? <Text style={{ color: C.faint, fontSize: 12, marginLeft: 6 }}>· {item.place}</Text> : null}
        </View>
        <Text style={{ color: C.dim, fontSize: 13, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>{item.caption}</Text>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 5 }}>
          <MaterialCommunityIcons name="star-four-points" size={11} color={C.gold} /> {item.vibes} · 📜 {item.comments}
        </Text>
      </View>
      {item.media ? <Image source={{ uri: item.media }} style={{ width: 54, height: 54, borderRadius: 12, marginLeft: 10 }} /> : null}
    </View>
  </Pressable>
));

const PlanRow = React.memo(({ item, onOpenProfile }) => {
  const plan = item.plan || {};
  const when = planWhen(plan);
  return (
    <Pressable onPress={() => { tapLight(); onOpenProfile && onOpenProfile({ id: item.user_id, name: (item.user && item.user.name) || 'Explorer', avatar: (item.user && item.user.avatar_url) || AV_NEUTRAL }); }}>
      <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: (item.user && item.user.avatar_url) || AV_NEUTRAL }} style={{ width: 34, height: 34, borderRadius: 17 }} />
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginLeft: 9, flex: 1 }} numberOfLines={1}>
            {(item.user && item.user.name) || 'Explorer'}{item.user && item.user.country_flag ? ' ' + item.user.country_flag : ''}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={C.faint} />
        </View>
        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginTop: 9, lineHeight: 21 }} numberOfLines={2}>
          {plan.title || item.caption}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {when ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 7, marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={12} color={C.dim} />
              <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '800', marginLeft: 5 }}>{when}</Text>
            </View>
          ) : null}
          {item.place ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 }}>
              <Ionicons name="location-outline" size={12} color={C.dim} />
              <Text style={{ color: C.text, fontSize: 11.5, fontWeight: '800', marginLeft: 5 }}>{item.place}</Text>
            </View>
          ) : null}
        </View>
        {plan.upFor && plan.upFor.length ? (
          <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
            {plan.upFor.slice(0, 3).map(upForLabel).join('  ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

/* A trending hashtag is a room — tapping it should walk you into it,
   not type it into a box and leave you to press search. */
const TrendRow = React.memo(({ item, rank, onPick }) => (
  <Pressable onPress={() => onPick(item)}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
      <Text style={{ color: C.faint, fontSize: 15, fontWeight: '900', width: 26 }}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.faint, fontSize: 11.5 }}>{item.category}</Text>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 1 }}>{item.tag}</Text>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{trendWhy(item)}</Text>
      </View>
      <MaterialCommunityIcons name="trending-up" size={20} color={C.green} />
    </View>
  </Pressable>
));

export const SearchModal = ({ onClose, onOpenProfile, onOpenTopics, onOpenTag }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Top');
  const [remote, setRemote] = useState(null);
  const [game, setGame] = useState(null);
  const [realGroups, setRealGroups] = useState(null);
  const [realTrends, setRealTrends] = useState(null);
  const [groupsErr, setGroupsErr] = useState(null);   // null | 'setup' | 'permission' | 'offline'

  const loadGroups = () => {
    if (!SUPABASE_READY) return;
    setGroupsErr(null);
    /* A request that never answers leaves "Looking…" on screen for
       ever — see src/lib/deadline.js */
    withDeadline(fetchGroups(user && user.id))
      .then((rows) => { setRealGroups(rows); })
      .catch((e) => { setRealGroups([]); setGroupsErr(explainGroups(e)); });
  };
  useEffect(loadGroups, [user]);

  // Real trending — computed from actual recent posts, never fabricated.
  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTrending().then(setRealTrends).catch(() => setRealTrends([]));
  }, []);

  /* These are handed to memoised rows, so they have to keep the same
     identity between renders — a callback rebuilt every keystroke would
     defeat the memo and we would be back to re-rendering every row for
     every letter. */
  const toggleGroup = useCallback(async (g) => {
    if (!SUPABASE_READY || !user) return;
    tapLight();
    setRealGroups((gs) => (gs || []).map((x) => x.id === g.id ? { ...x, joined: !x.joined, members: x.members + (x.joined ? -1 : 1) } : x));
    try { g.joined ? await leaveGroup(g.id, user.id) : await joinGroup(g.id, user.id); }
    catch (e) { loadGroups(); }
  }, [user]);

  /* A trend is a place, not a word — tapping one should walk you into
     it. A hashtag opens its room, a group opens the Groups tab already
     filtered to it, and a place goes into the box where it belongs. */
  const pickTrend = useCallback((item) => {
    tapLight();
    if (item.isGroup) { setTab('Groups'); setQuery(item.tag.replace(/^👥\s*/, '')); return; }
    if (onOpenTag && /^#/.test(item.tag)) { onOpenTag(item.tag); return; }
    setQuery(item.tag.replace(/^📍\s*/, ''));
  }, [onOpenTag]);

  /* Making a group used to end in `catch (e) {}` — the button did its
     happy little sound, the card closed, and if the server had refused
     you were never told. You pressed Create, nothing existed, and
     nothing explained why. A failure nobody is told about is worse than
     a failure: it makes the app look broken AND makes you doubt what
     you typed. This one throws its reason back to the card, which puts
     it on screen. */
  const submitGroup = useCallback(async ({ name, emoji, about }) => {
    if (!SUPABASE_READY) throw new Error('offline');
    if (!user) throw new Error('signin');
    const row = await createGroup(user.id, { name, emoji: emoji || '🌐', about });
    tapSuccess(); sfxSuccess();
    /* On screen the moment it exists, rather than after a round trip —
       and then reconciled with what the server actually has. */
    setRealGroups((gs) => [{ id: row.id, name: row.name, emoji: row.emoji || '🌐', about: row.about || '', members: 1, owner_id: row.owner_id, joined: true }].concat(gs || []));
    loadGroups();
  }, [user]);

  /* ── TRAVEL PLANS ─────────────────────────────────────────────────
     A plan posted into a chronological feed is a message in a bottle:
     whoever would have answered it is somewhere else, on another day.
     Here they are asked for by destination instead, soonest first,
     which is the entire reason somebody writes one. */
  const [plans, setPlans] = useState(null);
  const [plansErr, setPlansErr] = useState(false);
  const [planTry, setPlanTry] = useState(0);
  useEffect(() => {
    if (tab !== 'Travel') return undefined;
    if (!SUPABASE_READY) { setPlans([]); return undefined; }
    let alive = true;
    setPlans(null);
    setPlansErr(false);
    /* A request that never comes back leaves "Looking…" on the screen
       for ever, which on a weak connection is most of the time. Give it
       ten seconds and then say so, with a way to try again — waiting
       silently is the one thing that tells nobody anything. */
    const bell = setTimeout(() => { if (alive) { setPlansErr(true); setPlans([]); } }, 10000);
    const t = setTimeout(() => {
      fetchTravelPlans({ q: query })
        .then((rows) => { if (alive) { clearTimeout(bell); setPlans(rows); } })
        .catch(() => { if (alive) { clearTimeout(bell); setPlansErr(true); setPlans([]); } });
    }, query ? 280 : 0);
    return () => { alive = false; clearTimeout(t); clearTimeout(bell); };
  }, [tab, query, planTry]);

  const q = query.trim().toLowerCase();
  const mockPeople = useMemo(() => Object.values(USERS), []);
  const [realPosts, setRealPosts] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    if (!q) { setRemote(null); setRealPosts(null); return; }
    const t = setTimeout(async () => {
      try { setRemote((await searchProfiles(query)).map(fromProfileRow)); }
      catch (e) { setRemote([]); }
      try {
        setRealPosts((await searchPosts(query)).map((r) => ({
          id: r.id, caption: r.caption, place: r.place, media: r.media_url,
          vibes: r.vibes, comments: r.comments,
          user: { name: (r.user && r.user.name) || 'Explorer', avatar: (r.user && r.user.avatar_url) || AV_NEUTRAL },
        })));
      } catch (e) { setRealPosts([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Real mode NEVER shows scripted people or posts — only rows that
  // actually exist in the database. Mock lists are demo-mode only.
  const people = SUPABASE_READY
    ? (remote || [])
    : mockPeople.filter((u) => !q || u.name.toLowerCase().includes(q) || (u.handle || '').toLowerCase().includes(q));
  const groupsSource = SUPABASE_READY ? (realGroups || []) : GROUPS;
  const groups = groupsSource.filter((g) => !q || g.name.toLowerCase().includes(q) || (g.about || '').toLowerCase().includes(q));
  const posts = SUPABASE_READY
    ? (realPosts || [])
    : FEED.filter((p) => !q || (p.caption || '').toLowerCase().includes(q) || (p.place || '').toLowerCase().includes(q));
  const trendsSource = SUPABASE_READY ? (realTrends || []) : TRENDING;
  const trends = trendsSource.filter((t) => !q || t.tag.toLowerCase().includes(q));
  const games = PLAY_GAMES.filter((g) => !q || g.name.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q));

  const launchGame = (g) => {
    tapLight();
    if (PLAYABLE.includes(g.kind)) setGame(g);
    // 'chat' games (Truth or Dare) are added from inside a conversation
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12 }}>
        {/* search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4 }}>
            <Ionicons name="search" size={16} color={C.dim} />
            <TextInput
              placeholder={tab === 'Travel' ? t('where_going_ph') : t('search_moments_ph')}
              placeholderTextColor={C.faint}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => logSearch(query)}
              returnKeyType="search"
              autoFocus autoCapitalize="none"
              style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 14.5 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={C.faint} /></Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} style={{ marginLeft: 12 }}>
            <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>{t('cancel')}</Text>
          </Pressable>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginTop: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {/* The tab's VALUE stays English — the rest of this file
              compares against it — and only the label is translated.
              And the loop is `name`, not `t`, because `t` is the
              translator two lines down. */}
          {TABS.map((name) => (
            <Pressable key={name} onPress={() => setTab(name)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ color: tab === name ? C.text : C.faint, fontSize: 13.5, fontWeight: tab === name ? '900' : '600' }}>
                {t('tab_' + name.toLowerCase())}
              </Text>
              {tab === name ? <View style={{ height: 3, width: 28, borderRadius: 2, backgroundColor: C.purple, marginTop: 7 }} /> : null}
            </Pressable>
          ))}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
          {tab === 'Top' ? (
            <View>
              {!q && onOpenTopics ? (
                /* Rooms to post into, rather than a search box and hope.
                   Every count in there is counted off real moments. */
                <Pressable onPress={() => { tapLight(); onOpenTopics(); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.purpleSoft, borderRadius: 16, padding: 14, marginTop: 16 }}>
                    <Text style={{ fontSize: 22 }}>#</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{t('topics')}</Text>
                      <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
                        {t('topics_hint')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.purple} />
                  </View>
                </Pressable>
              ) : null}
              {!q ? (
                <>
                  <Section title={t('trending_now')} />
                  {trends.length ? trends.map((t, i) => <TrendRow key={t.id} item={t} rank={i + 1} onPick={pickTrend} />)
                    : SUPABASE_READY && realTrends === null ? (
                      /* Still counting. Saying nothing here reads as "there
                         is nothing", which is a different statement. */
                      <Text style={{ color: C.faint, fontSize: 12.5, paddingVertical: 10 }}>{t('counting')}</Text>
                    ) : SUPABASE_READY ? (
                      <Pressable onPress={() => { tapLight(); onOpenTopics && onOpenTopics(); }}>
                        <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 4 }}>
                          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{t('quiet_fortnight')}</Text>
                          <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, lineHeight: 19 }}>
                            {t('quiet_fortnight_hint')}
                          </Text>
                          {onOpenTopics ? (
                            <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginTop: 9 }}>{t('pick_a_topic')}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ) : null}
                </>
              ) : trends.length ? (
                <>
                  <Section title={t('trends')} />
                  {trends.map((t, i) => <TrendRow key={t.id} item={t} rank={i + 1} onPick={pickTrend} />)}
                </>
              ) : null}
              {people.length ? <><Section title={t('tab_people')} />{people.slice(0, 3).map((u) => <PersonRow key={u.id} item={u} onOpen={onOpenProfile} />)}</> : null}
              {groups.length ? <><Section title={t('tab_groups')} />{groups.slice(0, 3).map((g) => <GroupRow key={g.id} item={g} onToggle={toggleGroup} t={t} />)}</> : null}
              {!q && games.length ? <><Section title={t('play_together')} />{games.slice(0, 3).map((g) => <GameRow key={g.id} item={g} onPlay={launchGame} t={t} />)}</> : null}
              {q && posts.length ? <><Section title={t('tab_posts')} />{posts.slice(0, 3).map((p) => <PostRow key={p.id} item={p} />)}</> : null}
            </View>
          ) : null}

          {/* With nothing typed, People is a place to browse rather than a
              blank "start typing" — real accounts, in lanes, filterable
              by country and city. Typing goes back to searching. */}
          {tab === 'People' ? (
            q ? (people.length ? people.map((u) => <PersonRow key={u.id} item={u} onOpen={onOpenProfile} />) : <Empty q={q} />)
              : <PeopleDiscover />
          ) : null}
          {tab === 'Travel' ? (
            plans === null ? (
              <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 28 }}>{t('looking')}</Text>
            ) : plans.length ? (
              <>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 14, lineHeight: 18 }}>
                  {q ? 'Plans matching “' + query.trim() + '” — soonest first.'
                     : 'Who is going where, soonest first. Type a country or a city to narrow it down.'}
                </Text>
                {plans.map((pl) => <PlanRow key={pl.id} item={pl} onOpenProfile={onOpenProfile} />)}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 34 }}>{plansErr ? '📡' : '🧳'}</Text>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
                  {plansErr
                    ? "Couldn't reach the server"
                    : q ? 'Nobody has posted a plan for that yet' : 'No travel plans yet'}
                </Text>
                <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                  {plansErr
                    ? 'Check your connection and try again.'
                    : "Post one from Create → Travel: where you're going, when, and what you're up for. People there can find you and say hello."}
                </Text>
                {plansErr ? (
                  <Pressable onPress={() => { tapLight(); setPlanTry((n) => n + 1); }} style={{ marginTop: 14 }}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 }}>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('try_again')}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            )
          ) : null}
          {tab === 'Groups' ? (
            <>
              {/* An empty list, an unreachable server and a feature that
                  was never switched on look identical on screen, and
                  they are three different things with three different
                  fixes. This banner used to insist "this is the
                  connection, not you" while the card directly below it
                  correctly said the tables were not there yet — two
                  answers to the same question, one of them wrong. */}
              {groupsErr ? (
                <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20 }}>
                  <Text style={{ fontSize: 30 }}>{groupsErr === 'setup' ? '🧩' : '📡'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
                    {groupsErr === 'setup' ? 'Groups aren’t switched on yet'
                      : groupsErr === 'permission' ? 'You can’t see groups yet'
                      : "Couldn't load groups"}
                  </Text>
                  <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 19 }}>
                    {groupsErr === 'setup' ? 'This one needs a one-time setup before anybody can make or join a group. Nothing is missing — it just hasn’t been turned on.'
                      : groupsErr === 'permission' ? 'Sign in and try again.'
                      : 'This is the connection, not you — the ones that exist are still there.'}
                  </Text>
                  {/* Retrying a table that does not exist just fails
                      again, so it is not offered. */}
                  {groupsErr === 'setup' ? null : (
                    <Pressable onPress={() => { tapLight(); loadGroups(); }} style={{ marginTop: 12 }}>
                      <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 9 }}>
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{t('try_again')}</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              ) : realGroups === null && SUPABASE_READY ? (
                <Text style={{ color: C.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 28 }}>{t('looking')}</Text>
              ) : groups.length ? groups.map((g) => <GroupRow key={g.id} item={g} onToggle={toggleGroup} t={t} />) : <Empty q={q} />}
              <CreateGroupCard onCreate={submitGroup} owner={isOwner(user)} t={t} />
            </>
          ) : null}
          {tab === 'Posts' ? (posts.length ? posts.map((p) => <PostRow key={p.id} item={p} />) : <Empty q={q} />) : null}
          {tab === 'Play' ? (games.length ? games.map((g) => <GameRow key={g.id} item={g} onPlay={launchGame} t={t} />) : <Empty q={q} />) : null}
        </ScrollView>
      </View>
      {game && game.kind === 'stack' ? <StackGame onClose={() => setGame(null)} />
        : game && game.kind === 'tower' ? <TowerClimb onClose={() => setGame(null)} />
        : game && game.kind === 'hop' ? <StreetHop onClose={() => setGame(null)} />
        : game && game.kind === 'rooftop' ? <RooftopRush onClose={() => setGame(null)} />
        : game && game.kind === 'rps' ? <RockPaperScissors onClose={() => setGame(null)} />
        : game ? <GameRunner onClose={() => setGame(null)} /> : null}
    </Modal>
  );
};

const Empty = ({ q }) => (
  <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
    {q ? 'Nothing found for “' + q + '” — yet 🌱' : 'Start typing to search ✨'}
  </Text>
);
