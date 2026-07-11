import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TextInput, Pressable, Image, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { USERS, FEED, TRENDING, GROUPS, PLAY_GAMES, av } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { searchProfiles } from '../services/social';
import { Chip } from './Chip';
import { Tick } from './Tick';
import { Micro } from './Micro';
import { GameRunner } from './GameRunner';
import { tapLight } from '../utils/feedback';

/* Discover — people, groups, posts and what's trending (X / Facebook style).
   One search box, a tab row, and results that filter as you type. */

const TABS = ['Top', 'People', 'Groups', 'Posts', 'Play'];

const fromProfileRow = (row) => ({
  id: row.id,
  name: row.name || 'Explorer',
  handle: row.handle || '@' + (row.name || 'explorer').toLowerCase().replace(/\s+/g, '.'),
  emoji: row.emoji || '🧿',
  avatar: row.avatar_url || av(60),
  verified: !!row.verified,
  vouches: row.vouches || 1,
  vouchTag: row.vouch_tag || 'New Explorer',
  intent: row.intent || 'Exploring 🧭',
  moments: row.moments || 0, mates: row.mates || 0, campfires: row.campfires || 0,
  bio: row.bio || 'New to Moments — say hi! 👋',
});

export const SearchModal = ({ onClose, onOpenProfile }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Top');
  const [remote, setRemote] = useState(null);
  const [game, setGame] = useState(null);

  const q = query.trim().toLowerCase();
  const mockPeople = useMemo(() => Object.values(USERS), []);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    if (!q) { setRemote(null); return; }
    const t = setTimeout(async () => {
      try { setRemote((await searchProfiles(query)).map(fromProfileRow)); }
      catch (e) { setRemote([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const people = (SUPABASE_READY && remote !== null ? remote : mockPeople).filter((u) =>
    !q || u.name.toLowerCase().includes(q) || (u.handle || '').toLowerCase().includes(q));
  const groups = GROUPS.filter((g) => !q || g.name.toLowerCase().includes(q) || g.about.toLowerCase().includes(q));
  const posts = FEED.filter((p) => !q || (p.caption || '').toLowerCase().includes(q) || (p.place || '').toLowerCase().includes(q));
  const trends = TRENDING.filter((t) => !q || t.tag.toLowerCase().includes(q));
  const games = PLAY_GAMES.filter((g) => !q || g.name.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q));

  const launchGame = (g) => {
    tapLight();
    if (g.kind === 'runner') setGame(g);
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
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.players} · {item.plays} plays</Text>
        </View>
        <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>{item.kind === 'runner' ? 'Play' : 'In chat'}</Text>
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
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.members} members · {item.about}</Text>
        </View>
        <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>Join</Text>
        </View>
      </View>
    </Pressable>
  );

  const PostRow = ({ item }) => (
    <Pressable>
      <View style={{ flexDirection: 'row', paddingVertical: 11 }}>
        <Image source={{ uri: item.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View style={{ flex: 1, marginLeft: 11 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{item.user.name}</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginLeft: 6 }}>· {item.place}</Text>
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
                  {trends.map((t, i) => <TrendRow key={t.id} item={t} rank={i + 1} />)}
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
          {tab === 'Groups' ? (groups.length ? groups.map((g) => <GroupRow key={g.id} item={g} />) : <Empty q={q} />) : null}
          {tab === 'Posts' ? (posts.length ? posts.map((p) => <PostRow key={p.id} item={p} />) : <Empty q={q} />) : null}
          {tab === 'Play' ? (games.length ? games.map((g) => <GameRow key={g.id} item={g} />) : <Empty q={q} />) : null}
        </ScrollView>
      </View>
      {game ? <GameRunner onClose={() => setGame(null)} /> : null}
    </Modal>
  );
};

const Empty = ({ q }) => (
  <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 30 }}>
    {q ? 'Nothing found for “' + q + '” — yet 🌱' : 'Start typing to search ✨'}
  </Text>
);
