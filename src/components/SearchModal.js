import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { USERS, FEED, TRENDING, GROUPS, PLAY_GAMES, AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { searchProfiles } from '../services/social';
import { searchPosts } from '../services/posts';
import { fetchGroups, createGroup, joinGroup, leaveGroup } from '../services/groups';
import { fetchTrending } from '../services/trending';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { Micro } from './Micro';
import { GameRunner } from './GameRunner';
import { RooftopRush } from './RooftopRush';
import { SekoSeko } from './SekoSeko';
import { BoxingGame } from './BoxingGame';
import { StackGame } from './StackGame';
import { tapLight, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';

/* Discover — people, groups, posts and what's trending (X / Facebook style).
   One search box, a tab row, and results that filter as you type. */

const TABS = ['Top', 'People', 'Groups', 'Posts', 'Play'];

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

export const SearchModal = ({ onClose, onOpenProfile }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Top');
  const [remote, setRemote] = useState(null);
  const [game, setGame] = useState(null);
  const [realGroups, setRealGroups] = useState(null);
  const [realTrends, setRealTrends] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🌐');
  const [newAbout, setNewAbout] = useState('');

  const loadGroups = () => {
    if (!SUPABASE_READY) return;
    fetchGroups(user && user.id).then(setRealGroups).catch(() => setRealGroups([]));
  };
  useEffect(loadGroups, [user]);

  // Real trending — computed from actual recent posts, never fabricated.
  useEffect(() => {
    if (!SUPABASE_READY) return;
    fetchTrending().then(setRealTrends).catch(() => setRealTrends([]));
  }, []);

  const toggleGroup = async (g) => {
    if (!SUPABASE_READY || !user) return;
    tapLight();
    setRealGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, joined: !x.joined, members: x.members + (x.joined ? -1 : 1) } : x));
    try { g.joined ? await leaveGroup(g.id, user.id) : await joinGroup(g.id, user.id); }
    catch (e) { loadGroups(); }
  };

  const submitGroup = async () => {
    if (!newName.trim() || !SUPABASE_READY || !user) return;
    tapSuccess(); sfxSuccess();
    try {
      await createGroup(user.id, { name: newName.trim(), emoji: newEmoji.trim() || '🌐', about: newAbout.trim() });
      setCreating(false); setNewName(''); setNewAbout(''); setNewEmoji('🌐');
      loadGroups();
    } catch (e) {}
  };

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

  const PLAYABLE = ['runner', 'stack', 'rooftop', 'sekoseko', 'boxing'];
  const launchGame = (g) => {
    tapLight();
    if (PLAYABLE.includes(g.kind)) setGame(g);
    // 'chat' games (Truth or Dare) are added from inside a conversation
  };

  const GameRow = ({ item }) => (
    <Pressable onPress={() => launchGame(item)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
        <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{item.name}</Text>
            <View style={{ backgroundColor: C.purpleSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 7 }}>
              <Text style={{ color: C.purple, fontSize: 10, fontWeight: '800' }}>{item.tag}</Text>
            </View>
          </View>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.players}</Text>
        </View>
        <View style={{ backgroundColor: PLAYABLE.includes(item.kind) ? C.purple : C.glassHi, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
          <Text style={{ color: PLAYABLE.includes(item.kind) ? '#FFF' : C.dim, fontSize: 12, fontWeight: '900' }}>{PLAYABLE.includes(item.kind) ? 'Play' : 'In chat'}</Text>
        </View>
      </View>
    </Pressable>
  );

  const PersonRow = ({ item }) => (
    <Pressable onPress={() => onOpenProfile(item)}>
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
  );

  const GroupRow = ({ item }) => (
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
          <Pressable onPress={() => toggleGroup(item)}>
            <View style={{ backgroundColor: item.joined ? C.greenSoft : C.purple, borderWidth: item.joined ? 1 : 0, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ color: item.joined ? C.green : '#FFF', fontSize: 12, fontWeight: '900' }}>{item.joined ? 'Joined ✓' : 'Join'}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Join</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  const CreateGroupCard = () => (
    !SUPABASE_READY ? null : creating ? (
      <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', marginBottom: 9 }}>
          <TextInput value={newEmoji} onChangeText={setNewEmoji} style={{ width: 48, textAlign: 'center', fontSize: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, marginRight: 8 }} />
          <TextInput placeholder="Group name" placeholderTextColor={C.faint} value={newName} onChangeText={setNewName} style={{ flex: 1, color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12 }} />
        </View>
        <TextInput placeholder="What's it about?" placeholderTextColor={C.faint} value={newAbout} onChangeText={setNewAbout} style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setCreating(false)} style={{ flex: 1, marginRight: 8 }}>
            <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}><Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>Cancel</Text></View>
          </Pressable>
          <Pressable onPress={submitGroup} style={{ flex: 1 }}>
            <View style={{ backgroundColor: newName.trim() ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}><Text style={{ color: newName.trim() ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>Create</Text></View>
          </Pressable>
        </View>
      </View>
    ) : (
      <Pressable onPress={() => { tapLight(); setCreating(true); }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 14, paddingVertical: 13, marginTop: 12 }}>
          <Ionicons name="add" size={18} color={C.purple} />
          <Text style={{ color: C.purple, fontSize: 13.5, fontWeight: '900', marginLeft: 6 }}>Create a group</Text>
        </View>
      </Pressable>
    )
  );

  const PostRow = ({ item }) => (
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
  );

  const TrendRow = ({ item, rank }) => (
    <Pressable onPress={() => setQuery(item.tag)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
        <Text style={{ color: C.faint, fontSize: 15, fontWeight: '900', width: 26 }}>{rank}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.faint, fontSize: 11.5 }}>{item.category}</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 1 }}>{item.tag}</Text>
          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{item.moments} moments</Text>
        </View>
        <MaterialCommunityIcons name="trending-up" size={20} color={C.green} />
      </View>
    </Pressable>
  );

  const Section = ({ title }) => (
    <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 18, marginBottom: 4 }}>{title}</Text>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12 }}>
        {/* search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4 }}>
            <Ionicons name="search" size={16} color={C.dim} />
            <TextInput
              placeholder="Search Moments…"
              placeholderTextColor={C.faint}
              value={query}
              onChangeText={setQuery}
              autoFocus autoCapitalize="none"
              style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 14.5 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={C.faint} /></Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} style={{ marginLeft: 12 }}>
            <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginTop: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ color: tab === t ? C.text : C.faint, fontSize: 13.5, fontWeight: tab === t ? '900' : '600' }}>{t}</Text>
              {tab === t ? <View style={{ height: 3, width: 28, borderRadius: 2, backgroundColor: C.purple, marginTop: 7 }} /> : null}
            </Pressable>
          ))}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
          {tab === 'Top' ? (
            <View>
              {!q ? (
                <>
                  <Section title="Trending now 🔥" />
                  {trends.length ? trends.map((t, i) => <TrendRow key={t.id} item={t} rank={i + 1} />) : (
                    SUPABASE_READY && realTrends !== null ? (
                      <Text style={{ color: C.faint, fontSize: 12.5, paddingVertical: 10 }}>
                        Nothing trending yet — tag a #hashtag or a place in your next moment ✨
                      </Text>
                    ) : null
                  )}
                </>
              ) : trends.length ? (
                <>
                  <Section title="Trends" />
                  {trends.map((t, i) => <TrendRow key={t.id} item={t} rank={i + 1} />)}
                </>
              ) : null}
              {people.length ? <><Section title="People" />{people.slice(0, 3).map((u) => <PersonRow key={u.id} item={u} />)}</> : null}
              {groups.length ? <><Section title="Groups" />{groups.slice(0, 3).map((g) => <GroupRow key={g.id} item={g} />)}</> : null}
              {!q && games.length ? <><Section title="Play together 🎮" />{games.slice(0, 3).map((g) => <GameRow key={g.id} item={g} />)}</> : null}
              {q && posts.length ? <><Section title="Posts" />{posts.slice(0, 3).map((p) => <PostRow key={p.id} item={p} />)}</> : null}
            </View>
          ) : null}

          {tab === 'People' ? (people.length ? people.map((u) => <PersonRow key={u.id} item={u} />) : <Empty q={q} />) : null}
          {tab === 'Groups' ? (<>{groups.length ? groups.map((g) => <GroupRow key={g.id} item={g} />) : <Empty q={q} />}<CreateGroupCard /></>) : null}
          {tab === 'Posts' ? (posts.length ? posts.map((p) => <PostRow key={p.id} item={p} />) : <Empty q={q} />) : null}
          {tab === 'Play' ? (games.length ? games.map((g) => <GameRow key={g.id} item={g} />) : <Empty q={q} />) : null}
        </ScrollView>
      </View>
      {game && game.kind === 'stack' ? <StackGame onClose={() => setGame(null)} />
        : game && game.kind === 'rooftop' ? <RooftopRush onClose={() => setGame(null)} />
        : game && game.kind === 'sekoseko' ? <SekoSeko onClose={() => setGame(null)} />
        : game && game.kind === 'boxing' ? <BoxingGame onClose={() => setGame(null)} />
        : game ? <GameRunner onClose={() => setGame(null)} /> : null}
    </Modal>
  );
};

const Empty = ({ q }) => (
  <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
    {q ? 'Nothing found for “' + q + '” — yet 🌱' : 'Start typing to search ✨'}
  </Text>
);
