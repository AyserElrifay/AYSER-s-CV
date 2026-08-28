import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../services/profiles';
import { mateUp, fetchMateStates } from '../services/mates';
import {
  fetchPeople, fetchPeopleYouMayKnow, fetchNearby, fetchSameInterests,
  fetchSeriousLearners, fetchPlaces, activeLabel,
} from '../services/discover';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { ProfileModal } from './ProfileModal';
import { tapLight, tapMedium } from '../utils/feedback';
import { useStable } from '../hooks/useStable';

/* ── DISCOVER PEOPLE ────────────────────────────────────────────────
   Browsing instead of guessing a name into a search box. Five lanes,
   a country and a city filter, and one rule: every row is a real
   account. An empty lane says it is empty — it never gets padded. */

const LANES = [
  { id: 'all', label: 'All' },
  { id: 'know', label: 'People you may know' },
  { id: 'near', label: 'Nearby' },
  { id: 'interests', label: 'Same interests' },
  { id: 'learners', label: 'Serious learners' },
];

const SHORT = { english: 'EN', arabic: 'AR', french: 'FR', german: 'DE', spanish: 'ES', italian: 'IT', turkish: 'TR', russian: 'RU', portuguese: 'PT', japanese: 'JA', korean: 'KO', chinese: 'ZH', romanian: 'RO', dutch: 'NL', hindi: 'HI', urdu: 'UR', persian: 'FA', greek: 'EL', polish: 'PL', swedish: 'SV' };
const short = (l) => { const k = String(l || '').trim().toLowerCase(); return SHORT[k] || (k ? k.slice(0, 2).toUpperCase() : ''); };
const LEVELS = { beginner: 1, elementary: 2, intermediate: 3, advanced: 4, fluent: 5, native: 5 };

const Dots = ({ level, on }) => {
  const n = LEVELS[String(level || '').toLowerCase()] || 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, marginRight: 2, backgroundColor: i <= n ? on : C.line }} />
      ))}
    </View>
  );
};

const Chip = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginRight: 8, backgroundColor: on ? C.purple : C.glassHi }}>
    <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 13, fontWeight: '800' }}>{label}</Text>
  </Pressable>
);

const Tag = ({ text, tone }) => (
  <View style={{ borderWidth: 1, borderColor: tone, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginTop: 6 }}>
    <Text style={{ color: tone, fontSize: 10.5, fontWeight: '800' }}>{text}</Text>
  </View>
);

export const PeopleDiscover = () => {
  const { user } = useAuth();
  const [lane, setLane] = useState('all');
  const [country, setCountry] = useState(null);
  const [city, setCity] = useState(null);
  const [places, setPlaces] = useState({ countries: [], cities: [] });
  const [placeOpen, setPlaceOpen] = useState(null); // 'country' | 'city'
  const [rows, setRows] = useState(null);           // null = loading
  const [err, setErr] = useState(null);
  const [mates, setMates] = useState({});
  const [open, setOpen] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    getProfile(user.id).then(setMe).catch(() => {});
    fetchPlaces().then(setPlaces).catch(() => {});
    fetchMateStates(user.id).then(setMates).catch(() => {});
  }, [user]);

  const load = useCallback(async () => {
    if (!SUPABASE_READY || !user) { setRows([]); return; }
    setRows(null); setErr(null);
    try {
      const opts = { country, city, excludeId: user.id };
      let out = [];
      if (lane === 'know') out = await fetchPeopleYouMayKnow(user.id);
      else if (lane === 'near') out = await fetchNearby(user.id, { lat: me && me.lat, lng: me && me.lng });
      else if (lane === 'interests') out = await fetchSameInterests(me || { id: user.id });
      else if (lane === 'learners') out = await fetchSeriousLearners(opts);
      else out = await fetchPeople(opts);
      // the country/city filter applies to every lane, even the ones the
      // database couldn't filter for us
      if (country) out = out.filter((p) => p.country === country);
      if (city) out = out.filter((p) => (p.city || '').toLowerCase() === city.toLowerCase());
      setRows(out);
    } catch (e) {
      setRows([]);
      setErr('Could not load people');
    }
  }, [lane, country, city, user, me]);

  useEffect(() => { load(); }, [load]);

  const wave = (p) => {
    const s = mates[p.id];
    if (s === 'mates' || s === 'requested') { tapLight(); setOpen(p); return; }
    tapMedium();
    setMates((m) => ({ ...m, [p.id]: s === 'incoming' ? 'mates' : 'requested' }));
    mateUp(user.id, p.id)
      .then((real) => setMates((m) => ({ ...m, [p.id]: real })))
      .catch(() => setMates((m) => { const n = { ...m }; delete n[p.id]; return n; }));
  };

  const Row = useStable(({ p }) => {
    const s = mates[p.id];
    const speaks = short(p.speaks_language), learns = short(p.learning_language);
    const active = activeLabel(p.last_active_at);
    const avatar = p.avatar_url || buildAvatarUrl(p.id, p.avatar_dna);
    return (
      <Pressable onPress={() => { tapLight(); setOpen(p); }} style={{ flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ width: 58, alignItems: 'center' }}>
          <View>
            <Image source={{ uri: avatar }} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.glassHi }} />
            {p.country_flag ? (
              <Text style={{ position: 'absolute', bottom: -2, left: -2, fontSize: 15 }}>{p.country_flag}</Text>
            ) : null}
          </View>
          {active ? <Text style={{ color: C.faint, fontSize: 9.5, marginTop: 4, textAlign: 'center' }} numberOfLines={2}>{active}</Text> : null}
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', flexShrink: 1 }} numberOfLines={1}>{p.name}</Text>
            {p.verified ? <Ionicons name="checkmark-circle" size={14} color={C.purple} style={{ marginLeft: 4 }} /> : null}
          </View>

          {speaks || learns ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 3 }}>
              <View>
                <Text style={{ color: C.text, fontSize: 12, fontWeight: '800' }}>{speaks || '—'}</Text>
                <Dots level="native" on={C.green} />
              </View>
              <Ionicons name="swap-horizontal" size={13} color={C.faint} style={{ marginHorizontal: 7, marginTop: 1 }} />
              <View>
                <Text style={{ color: C.text, fontSize: 12, fontWeight: '800' }}>{learns || '—'}</Text>
                <Dots level={p.learning_level} on={C.purple} />
              </View>
            </View>
          ) : null}

          {p.bio ? (
            <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 5 }} numberOfLines={2}>{p.bio}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {p.mutuals ? <Tag text={`${p.mutuals} mutual${p.mutuals > 1 ? 's' : ''}`} tone={C.purple} /> : null}
            {p.km != null ? <Tag text={p.km < 1 ? 'Less than 1 km' : `${Math.round(p.km)} km away`} tone={C.green} /> : null}
            {p.mirror ? <Tag text="Perfect match" tone={C.gold} /> : null}
            {(p.shared || []).slice(0, 2).map((h) => <Tag key={h} text={h} tone={C.dim} />)}
            {p.city ? <Tag text={p.city} tone={C.faint} /> : null}
          </View>
        </View>

        <Pressable
          onPress={() => wave(p)}
          hitSlop={6}
          style={{
            alignSelf: 'flex-start', marginTop: 4, marginLeft: 8, borderRadius: 999,
            paddingHorizontal: 14, paddingVertical: 9,
            backgroundColor: s === 'mates' ? C.glassHi : s === 'requested' ? C.glassHi : C.purple,
          }}
        >
          <Text style={{ color: s ? C.dim : '#FFF', fontSize: 12.5, fontWeight: '900' }}>
            {s === 'mates' ? 'Mates ✓' : s === 'requested' ? 'Sent' : s === 'incoming' ? 'Accept' : '👋'}
          </Text>
        </Pressable>
      </Pressable>
    );
  });

  const placeList = placeOpen === 'country' ? places.countries : places.cities;

  return (
    <View style={{ flex: 1 }}>
      {/* lanes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 10 }}>
        {LANES.map((l) => <Chip key={l.id} label={l.label} on={lane === l.id} onPress={() => { tapLight(); setLane(l.id); }} />)}
      </ScrollView>

      {/* place filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 10 }}>
        <Chip label={country ? `${country} ✕` : 'Country ▾'} on={!!country} onPress={() => { tapLight(); if (country) setCountry(null); else setPlaceOpen(placeOpen === 'country' ? null : 'country'); }} />
        <Chip label={city ? `${city} ✕` : 'City ▾'} on={!!city} onPress={() => { tapLight(); if (city) setCity(null); else setPlaceOpen(placeOpen === 'city' ? null : 'city'); }} />
      </ScrollView>

      {placeOpen ? (
        <View style={{ backgroundColor: C.bg2, borderRadius: R, borderWidth: 1, borderColor: C.line, padding: 8, marginBottom: 10 }}>
          {placeList.length ? (
            <View>
              {placeList.slice(0, 14).map((pl) => (
                <Pressable
                  key={pl.name}
                  onPress={() => {
                    tapLight();
                    if (placeOpen === 'country') setCountry(pl.name); else setCity(pl.name);
                    setPlaceOpen(null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6 }}
                >
                  <Text style={{ fontSize: 16, marginRight: 8 }}>{pl.flag || '📍'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{pl.name}</Text>
                  <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{pl.count}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ color: C.faint, fontSize: 12.5, padding: 10, textAlign: 'center' }}>
              Nobody has set a {placeOpen} yet — this fills in as people complete their profile.
            </Text>
          )}
        </View>
      ) : null}

      {/* results */}
      {rows === null ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={C.purple} /></View>
      ) : rows.length ? (
        /* plain View: this lives inside the search sheet's own scroller,
           and a scroll view inside a scroll view eats the gesture */
        <View>
          {rows.map((p) => <Row key={p.id} p={p} />)}
          <View style={{ height: 30 }} />
        </View>
      ) : (
        <View style={{ paddingVertical: 42, paddingHorizontal: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 34 }}>🌱</Text>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>{emptyTitle(lane)}</Text>
          <Text style={{ color: C.faint, fontSize: 12.5, lineHeight: 19, marginTop: 6, textAlign: 'center' }}>{emptyBody(lane, err)}</Text>
        </View>
      )}

      {open ? (
        <ProfileModal
          user={{ id: open.id, name: open.name, avatar: open.avatar_url || buildAvatarUrl(open.id, open.avatar_dna), verified: !!open.verified, countryFlag: open.country_flag, bio: open.bio }}
          onClose={() => {
            setOpen(null);
            if (user) fetchMateStates(user.id).then(setMates).catch(() => {});
          }}
        />
      ) : null}
    </View>
  );
};

/* Empty states that tell the truth about WHY a lane is empty, so it
   never reads as a broken screen. */
function emptyTitle(lane) {
  return lane === 'know' ? 'No mutual friends yet'
    : lane === 'near' ? 'Nobody nearby yet'
    : lane === 'interests' ? 'No shared interests yet'
    : lane === 'learners' ? 'No learners here yet'
    : 'No one here yet';
}
function emptyBody(lane, err) {
  if (err) return err;
  return lane === 'know' ? 'Mate up with a few people and their friends will start showing up here.'
    : lane === 'near' ? 'This uses the location people choose to share. Turn yours on and check back.'
    : lane === 'interests' ? 'Add your hobbies and the languages you speak — matches appear the moment someone overlaps.'
    : lane === 'learners' ? 'People appear here once they switch their learning profile on.'
    : 'Real accounts show up here as people join. Nothing is invented to fill the space.';
}
