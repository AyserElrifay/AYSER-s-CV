import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform, Image, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { ME, DOING_OPTIONS, DEALS, DEAL_FILTERS, av, AV_NEUTRAL } from '../constants/mockData';
import { MAP_PEOPLE, CAMPFIRES, BOOKINGS } from '../constants/mockData'; // demo-mode fallback only
import { MapView, Marker, MAPS_READY } from '../utils/maps';
import { kmBetween, projectToMap } from '../utils/geo';
import { requestLocationPermission, getCurrentCoords } from '../utils/location';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { shareMyLocation, goInvisible, fetchNearbyPeople, subscribeNearby, fetchMyLiveLocation } from '../services/locations';
import { fetchLiveCampfires, hostCampfire, joinCampfire } from '../services/campfires';
import { fetchLiveVenues, applyAsVenue } from '../services/venues';
import { buildAvatarUrl } from '../services/avatarBuilder';
import { fetchNearbyPlaces } from '../services/places';
import { DESTINATIONS } from '../constants/destinations';
import { fetchDestReviews, addDestReview } from '../services/destinations';
import { requestTrip } from '../services/trips';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { openPartner } from '../services/broker';
import {
  Glass, Micro, Chip, NeonButton, GhostButton, FauxMap,
  PersonPin, CampfirePin, MePin, SOSButton, ProfileModal, BookingSheet, LeafletMap,
} from '../components';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ─────────────────── TAB 2 · MAP — THE LIVING WORLD ────────────────── */
/* In real mode (SUPABASE_READY), every pin is a real signed-in person's
   real shared location, every campfire is a real live room someone is
   actually hosting, and every booking is a real venue that applied and
   was reviewed. Nothing here is scripted content once the backend is
   configured. Demo mode (no Supabase project) keeps the mock scene so
   the app still runs for local development. */

const normalizePerson = (row) => ({
  id: row.user_id,
  name: (row.profile && row.profile.name) || 'Explorer',
  handle: row.profile && row.profile.handle,
  avatar: (row.profile && row.profile.avatar_url) || AV_NEUTRAL, // real photo — used in their full profile
  cartoonAvatar: buildAvatarUrl(row.user_id, row.profile && row.profile.avatar_dna), // shown on the live map instead
  emoji: (row.profile && row.profile.emoji) || '🧿',
  verified: !!(row.profile && row.profile.verified),
  intent: (row.profile && row.profile.intent) || 'Exploring 🧭',
  countryFlag: row.profile && row.profile.country_flag,
  doing: row.doing,
  coords: { latitude: row.lat, longitude: row.lng },
});

const normalizeCampfire = (row) => ({
  id: row.id,
  title: row.title,
  topic: row.topic,
  hostId: row.host_id,
  host: { name: (row.host && row.host.name) || 'Someone' },
  coords: row.lat != null && row.lng != null ? { latitude: row.lat, longitude: row.lng } : null,
});

const VENUE_KINDS = ['Sport', 'Stay', 'Food', 'Experience'];

export const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [sos, setSos] = useState(null); // null | 'ask' | 'sent'
  /* ONE sheet at a time — 'nearby' | 'doing' | 'drop' | 'partner' | null.
     A single source of truth means sheets can never stack on each other. */
  const [sheet, setSheet] = useState(null);
  const openSheet = (name) => { tapLight(); setSheet(name); };
  const closeSheet = () => setSheet(null);
  const [placeOpen, setPlaceOpen] = useState(null); // a tapped real-world place
  const [rail, setRail] = useState('fires');     // 'fires' | 'book'
  const [myDoing, setMyDoing] = useState(null);  // your activity badge
  const [waved, setWaved] = useState({});
  const [partnerSent, setPartnerSent] = useState(false);
  const [dealFilter, setDealFilter] = useState('All');
  const [dropTitle, setDropTitle] = useState('');
  const [joinedFires, setJoinedFires] = useState({});
  const [vName, setVName] = useState('');
  const [vKind, setVKind] = useState('Sport');
  const [vSub, setVSub] = useState('');
  const [vPrice, setVPrice] = useState('');
  const [booked, setBooked] = useState({});
  const [bookingVenue, setBookingVenue] = useState(null);

  const [myCoords, setMyCoords] = useState(ME.coords); // internal fallback for distances only
  const [located, setLocated] = useState(false);       // true ONLY when real GPS resolved
  const [locating, setLocating] = useState(true);
  const [hasLocationPerm, setHasLocationPerm] = useState(false);
  const [realPeople, setRealPeople] = useState([]);
  const [realCampfires, setRealCampfires] = useState([]);
  const [realVenues, setRealVenues] = useState([]);
  const [realPlaces, setRealPlaces] = useState([]); // genuine venues from OpenStreetMap

  /* ── REAL places around you (OpenStreetMap) — only once we know
     where you ACTUALLY are; nothing is drawn around a fake default. ── */
  useEffect(() => {
    if (!located) return;
    let cancelled = false;
    fetchNearbyPlaces(myCoords).then((rows) => { if (!cancelled) setRealPlaces(rows); });
    return () => { cancelled = true; };
  }, [located, myCoords.latitude, myCoords.longitude]);

  /* ── real GPS: your pin exists only where YOU really are ── */
  const locateMe = useCallback(async () => {
    setLocating(true);
    const granted = await requestLocationPermission();
    setHasLocationPerm(granted);
    if (granted) {
      const coords = await getCurrentCoords();
      if (coords) { setMyCoords(coords); setLocated(true); }
    }
    setLocating(false);
  }, []);

  useEffect(() => { locateMe(); }, [locateMe]);

  /* Rehydrate your real "doing" status from the server on load — the
     local myDoing state resets to null every time the app opens, but
     your visibility on the map is whatever the DATABASE says, not what
     the UI defaults to. Without this, the badge could show "not set"
     while you were still actually visible to everyone (or the reverse). */
  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    fetchMyLiveLocation(user.id).then((row) => setMyDoing(row ? row.doing : null)).catch(() => {});
  }, [user]);

  /* Heartbeat — while you're sharing, refresh your live_locations row
     every few minutes so you don't silently expire off the map (the
     "active in the last 30 min" cutoff) just from the app sitting open. */
  useEffect(() => {
    if (!SUPABASE_READY || !user || !myDoing || !located) return;
    const id = setInterval(() => {
      shareMyLocation(user.id, myCoords, myDoing).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, myDoing, located, myCoords.latitude, myCoords.longitude]);

  /* ── real data: nearby people, campfires, venues ── */
  const loadNearby = useCallback(() => {
    if (!SUPABASE_READY) return;
    fetchNearbyPeople()
      .then((rows) => setRealPeople((rows || []).filter((r) => r.user_id !== (user && user.id)).map(normalizePerson)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    loadNearby();
    fetchLiveCampfires().then((rows) => setRealCampfires((rows || []).map(normalizeCampfire))).catch(() => {});
    fetchLiveVenues().then(setRealVenues).catch(() => {});
    const unsub = subscribeNearby(loadNearby);
    return unsub;
  }, [loadNearby]);

  const people = SUPABASE_READY ? realPeople : MAP_PEOPLE;
  const campfires = SUPABASE_READY ? realCampfires : [...realCampfires, ...CAMPFIRES];
  const venues = SUPABASE_READY ? realVenues : BOOKINGS;
  const filteredDeals = DEALS.filter((d) => dealFilter === 'All' || d.cat === dealFilter);

  const nearbyPeople = useMemo(
    () => [...people].map((p) => ({ ...p, km: kmBetween(myCoords, p.coords) })).sort((a, b) => a.km - b.km),
    [people, myCoords]
  );

  /* Markers for the real (web) Leaflet map, on true coordinates. */
  const mapMarkers = useMemo(() => {
    const out = [];
    people.forEach((p) => p.coords && out.push({ id: 'p_' + p.id, srcId: p.id, kind: 'person', lat: p.coords.latitude, lng: p.coords.longitude, emoji: p.doing || p.emoji || '🧿', avatar: p.cartoonAvatar || p.avatar, flag: p.countryFlag, label: (p.countryFlag ? p.countryFlag + ' ' : '') + p.name }));
    campfires.forEach((c) => c.coords && out.push({ id: 'c_' + c.id, srcId: c.id, kind: 'fire', lat: c.coords.latitude, lng: c.coords.longitude, emoji: '🔥', label: c.title }));
    (SUPABASE_READY ? realVenues : []).forEach((v) => v.lat != null && out.push({ id: 'v_' + v.id, srcId: v.id, kind: 'venue', lat: v.lat, lng: v.lng, emoji: v.emoji || '📍', label: v.name }));
    // REAL places from OpenStreetMap, pinned at their true coordinates
    realPlaces.forEach((pl) => out.push({ id: pl.id, srcId: pl.id, kind: 'place', lat: pl.lat, lng: pl.lng, emoji: pl.emoji, label: pl.name }));
    // curated adventure destinations — real spots across the planet
    DESTINATIONS.forEach((d) => out.push({ id: 'dest_' + d.id, srcId: d.id, kind: 'dest', lat: d.lat, lng: d.lng, emoji: d.emoji, flag: d.flag, label: d.name }));
    return out;
  }, [people, campfires, realVenues, realPlaces]);

  const onMarkerPress = (m) => {
    setSheet(null); // whatever's open, a map tap replaces it — never stacks
    if (m.kind === 'person') { const p = people.find((x) => x.id === m.srcId); if (p) setProfileUser(p); }
    else if (m.kind === 'venue') { const v = realVenues.find((x) => x.id === m.srcId); setRail('book'); if (v) setBookingVenue(v); }
    else if (m.kind === 'fire') { const c = campfires.find((x) => x.id === m.srcId); if (c) joinFire(c); }
    else if (m.kind === 'place') { const pl = realPlaces.find((x) => x.id === m.srcId); if (pl) setPlaceOpen(pl); }
    else if (m.kind === 'dest') { const d = DESTINATIONS.find((x) => x.id === m.srcId); if (d) openDest(d); }
  };

  /* ── curated destination sheet: guide + reviews + Uber ── */
  const [destOpen, setDestOpen] = useState(null);
  const [destReviews, setDestReviews] = useState(null);
  const [revStars, setRevStars] = useState(0);
  const [revText, setRevText] = useState('');
  const [revErr, setRevErr] = useState(null);
  const [revSaved, setRevSaved] = useState(false);

  // Book Trip form (far destinations — Uber makes no sense at 500km)
  const [tripOpen, setTripOpen] = useState(false);
  const [tripName, setTripName] = useState('');
  const [tripPhone, setTripPhone] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [tripPeople, setTripPeople] = useState('2');
  const [tripNotes, setTripNotes] = useState('');
  const [tripErr, setTripErr] = useState(null);
  const [tripSent, setTripSent] = useState(false);

  const openDest = (d) => {
    setDestOpen(d); setDestReviews(null); setRevStars(0); setRevText(''); setRevErr(null); setRevSaved(false);
    setTripOpen(false); setTripErr(null); setTripSent(false);
    if (SUPABASE_READY) fetchDestReviews(d.id).then(setDestReviews).catch(() => setDestReviews([]));
    else setDestReviews([]);
  };

  const submitTrip = async () => {
    if (!tripName.trim() || !tripPhone.trim()) { setTripErr('Name and phone are required so we can reach you.'); return; }
    if (!SUPABASE_READY || !user) { setTripErr('Sign in to book a trip.'); return; }
    setTripErr(null);
    try {
      await requestTrip({
        userId: user.id, destId: destOpen.id, destName: destOpen.name,
        fullName: tripName.trim(), phone: tripPhone.trim(),
        travelDate: tripDate.trim(), people: tripPeople, notes: tripNotes.trim(),
      });
      tapSuccess(); sfxSuccess();
      setTripSent(true);
    } catch (e) {
      setTripErr(/does not exist|schema cache/i.test(e.message || '')
        ? 'One step left: run the updated supabase/RUN_ME.sql to turn on trip booking.'
        : (e.message || 'Could not send your request — try again.'));
    }
  };

  const submitReview = async () => {
    if (!revStars || !destOpen) { setRevErr('Pick your stars first ⭐'); return; }
    if (!SUPABASE_READY || !user) { setRevErr('Sign in to leave feedback'); return; }
    setRevErr(null);
    try {
      const row = await addDestReview(destOpen.id, user.id, revStars, revText.trim());
      tapSuccess(); sfxSuccess();
      setRevSaved(true);
      setDestReviews((r) => [row, ...(r || []).filter((x) => x.user_id !== user.id)]);
      setRevText('');
    } catch (e) {
      setRevErr(/does not exist|schema cache/i.test(e.message || '')
        ? 'Run supabase/RUN_ME.sql to turn on reviews'
        : (e.message || 'Could not save your feedback'));
    }
  };

  /* Uber straight to the destination — tracked referral (the money trail). */
  const uberTo = (d) => {
    tapLight();
    openPartner(user, {
      id: d.id,
      partner: 'uber',
      url: 'https://m.uber.com/ul/?action=setPickup&pickup=my_location'
        + '&dropoff[latitude]=' + d.lat + '&dropoff[longitude]=' + d.lng
        + '&dropoff[nickname]=' + encodeURIComponent(d.name),
    });
  };

  /* Directions to a real place — opens the maps app / Google Maps. */
  const directionsTo = (pl) => {
    tapLight();
    Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + pl.lat + ',' + pl.lng).catch(() => {});
  };

  /* Deals for a real place — a tracked Waffarha referral (the money trail). */
  const dealsFor = (pl) => {
    tapSuccess(); sfxSuccess();
    openPartner(user, { id: pl.id, partner: 'waffarha', url: 'https://waffarha.com/ar/search?word=' + encodeURIComponent(pl.name) });
  };

  /* ── your activity badge → a real row in live_locations ──
     Honesty fix: the UI used to flip to "invisible" instantly and
     swallow any server error, so a failed delete left you SILENTLY
     still visible to everyone while the app told you you'd vanished.
     Now the badge only changes after the server confirms it. */
  const pickDoing = async (emoji) => {
    tapSelection(); sfxPop();
    const next = myDoing === emoji ? null : emoji;
    closeSheet();
    if (!SUPABASE_READY || !user) { setMyDoing(next); return; }
    try {
      if (next) await shareMyLocation(user.id, myCoords, next);
      else await goInvisible(user.id);
      setMyDoing(next);
      loadNearby();
    } catch (e) {
      note((next ? '🧿 ' : '👻 ') + explainMap(e));
    }
  };

  const goInvisibleNow = async () => {
    tapLight();
    closeSheet();
    if (!SUPABASE_READY || !user) { setMyDoing(null); return; }
    try {
      await goInvisible(user.id);
      setMyDoing(null);
      loadNearby();
    } catch (e) {
      note('👻 ' + explainMap(e));
    }
  };

  /* ── SOS: real mode marks your real pin with 🚨 so it's visible ── */
  const sendSos = async () => {
    setSos('sent');
    if (SUPABASE_READY && user) {
      try { await shareMyLocation(user.id, myCoords, '🚨'); setMyDoing('🚨'); loadNearby(); } catch (e) {}
    }
  };

  /* Map-level toast — honest feedback for every map action. */
  const [mapNote, setMapNote] = useState(null);
  const note = (msg) => {
    setMapNote(msg);
    setTimeout(() => setMapNote(null), 3200);
  };
  const explainMap = (e) => {
    const m = (e && e.message) || '';
    return /does not exist|schema cache|get_or_create/i.test(m)
      ? 'One step left: run supabase/RUN_ME.sql to turn this on.'
      : (m || 'Something went wrong — try again.');
  };

  /* ── Wave → a real DM. "Waved ✓" appears ONLY when it truly sent. ── */
  const wave = async (person) => {
    tapLight();
    if (!SUPABASE_READY || !user) { setWaved((w) => ({ ...w, [person.id]: true })); return; }
    try {
      const threadId = await getOrCreateDmThread(person.id);
      await sendMessage({ dmThreadId: threadId, userId: user.id, body: '👋' });
      sfxPop();
      setWaved((w) => ({ ...w, [person.id]: true }));
    } catch (e) {
      note('👋 ' + explainMap(e));
    }
  };

  /* ── Book → open the pay-and-earn booking sheet (commission flows) ── */
  const bookVenue = (venue) => {
    tapLight();
    setBookingVenue(venue);
  };

  /* ── Drop a Moment: put YOURSELF on the map & let people join ── */
  const dropMoment = async () => {
    const title = dropTitle.trim();
    if (!title) return;
    tapSuccess(); sfxSuccess();
    closeSheet();
    setDropTitle('');
    if (SUPABASE_READY && user) {
      try {
        const row = await hostCampfire(user.id, { title, topic: null, lat: myCoords.latitude, lng: myCoords.longitude });
        setRealCampfires((c) => [normalizeCampfire(row), ...c]);
      } catch (e) {}
    } else {
      setRealCampfires((c) => [{ id: 'local-' + Date.now(), title, topic: null, host: { name: 'You' }, coords: myCoords }, ...c]);
    }
  };

  /* ── Join the Moment — "You're in!" ONLY after the real join lands ── */
  const joinFire = async (c) => {
    if (!SUPABASE_READY || !user || !c.hostId || c.hostId === user.id) {
      tapSuccess(); sfxSuccess();
      setJoinedFires((j) => ({ ...j, [c.id]: true }));
      return;
    }
    try {
      await joinCampfire(c.id, user.id);
      tapSuccess(); sfxSuccess();
      setJoinedFires((j) => ({ ...j, [c.id]: true }));
      // the hello to the host is best-effort — the join itself is done
      try {
        const threadId = await getOrCreateDmThread(c.hostId);
        await sendMessage({ dmThreadId: threadId, userId: user.id, body: 'I’m in for “' + c.title + '”! 🙌' });
      } catch (e2) {}
    } catch (e) {
      note('🔥 ' + explainMap(e));
    }
  };

  /* ── Partner application → a real pending venue row ── */
  const submitVenue = async () => {
    if (!vName.trim()) return;
    if (!SUPABASE_READY || !user) { setPartnerSent(true); return; }
    try {
      await applyAsVenue(user.id, {
        name: vName.trim(), kind: vKind, emoji: vKind === 'Sport' ? '🎾' : vKind === 'Stay' ? '🏨' : vKind === 'Food' ? '🍽️' : '🛶',
        sub: vSub.trim() || null, price: vPrice.trim() || null, lat: myCoords.latitude, lng: myCoords.longitude,
      });
      setPartnerSent(true);
    } catch (e) {}
  };

  const overlays = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }}>
      {/* floating glass search */}
      <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: C.line,
            borderRadius: 999, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
          }}
        >
          <Ionicons name="search" size={16} color={C.dim} />
          <TextInput
            placeholder="Search vibes, people, places…"
            placeholderTextColor={C.faint}
            style={{ color: C.text, marginLeft: 10, flex: 1, fontSize: 13.5 }}
          />
          <Text style={{ fontSize: 15 }}>🧿</Text>
        </View>
        <Chip
          label={'🟢 ' + nearbyPeople.length + ' nearby · ' + campfires.length + ' campfires' + (realPlaces.length ? ' · ' + realPlaces.length + ' real places' : '')}
          tint="rgba(255,255,255,0.94)"
          color={C.dim}
          style={{ alignSelf: 'flex-start', marginTop: 10 }}
        />
      </View>

      {/* right-side actions: locate me · your activity · nearby people · SOS */}
      <View style={{ position: 'absolute', right: 14, bottom: 168, alignItems: 'center' }}>
        <Pressable onPress={() => { tapLight(); locateMe(); }} style={{ marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: located ? 'rgba(16,185,129,0.5)' : C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={locating ? 'ellipsis-horizontal' : 'locate'} size={21} color={located ? C.green : C.purple} />
          </View>
        </Pressable>
        <Pressable onPress={() => openSheet('doing')} style={{ marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: myDoing ? C.purple : C.line, alignItems: 'center', justifyContent: 'center' }}>
            {myDoing ? <Text style={{ fontSize: 21 }}>{myDoing}</Text> : <Ionicons name="happy-outline" size={21} color={C.purple} />}
          </View>
        </Pressable>
        <Pressable onPress={() => openSheet('nearby')} style={{ marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', shadowColor: C.purple, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
            <Ionicons name="people" size={21} color="#FFF" />
          </View>
        </Pressable>
        <SOSButton onPress={() => setSos('ask')} />
      </View>

      {/* bottom rail — campfires or bookings */}
      <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }}>
        <View style={{ flexDirection: 'row', marginLeft: 16, marginBottom: 8 }}>
          {[
            { k: 'fires', label: '🔥 Campfires' },
            { k: 'book', label: '📅 Book' },
            { k: 'deals', label: '🎟️ Deals' },
          ].map((o) => (
            <Pressable key={o.k} onPress={() => { tapSelection(); setRail(o.k); }}>
              <View style={{ backgroundColor: rail === o.k ? C.purple : 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: rail === o.k ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
                <Text style={{ color: rail === o.k ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{o.label}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={() => openSheet('drop')}>
            <View style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
              <Text style={{ color: '#4A3200', fontSize: 12, fontWeight: '900' }}>＋ Drop a Moment</Text>
            </View>
          </Pressable>
        </View>
        {rail === 'deals' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginBottom: 8 }}>
            {DEAL_FILTERS.map((f) => (
              <Pressable key={f} onPress={() => { tapSelection(); setDealFilter(f); }}>
                <View style={{ backgroundColor: dealFilter === f ? C.text : 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: dealFilter === f ? C.text : C.line, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginRight: 7 }}>
                  <Text style={{ color: dealFilter === f ? '#FFF' : C.dim, fontSize: 11, fontWeight: '800' }}>{f}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {rail === 'deals' ? (
            filteredDeals.map((d) => (
              <Pressable key={d.id} onPress={() => { tapLight(); sfxPop(); openPartner(user, d); }}>
                <Glass tint="rgba(255,255,255,0.96)" style={{ width: 236, padding: 13, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, marginRight: 9 }}>{d.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{d.title}</Text>
                      <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>{d.sub} · {d.region}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 }}>
                      <Text style={{ color: C.green, fontSize: 10.5, fontWeight: '900' }}>{d.badge}</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(245,179,1,0.15)', borderWidth: 1, borderColor: 'rgba(245,179,1,0.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#8A6400', fontSize: 10, fontWeight: '900' }}>✦ +{d.cashback} $M back</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    <Text style={{ color: C.faint, fontSize: 10 }}>↗</Text>
                  </View>
                </Glass>
              </Pressable>
            ))
          ) : rail === 'fires' ? (
            campfires.length ? campfires.map((c) => (
              <Glass key={c.id} tint="rgba(255,255,255,0.96)" style={{ width: 252, padding: 13, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{c.title}</Text>
                    <Text style={{ color: C.dim, fontSize: 11, marginTop: 1 }}>
                      {c.host.name.split(' ')[0]} hosting now
                    </Text>
                  </View>
                </View>
                {c.topic ? (
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 8, fontStyle: 'italic' }} numberOfLines={1}>
                    "{c.topic}"
                  </Text>
                ) : null}
                {joinedFires[c.id] ? (
                  <View style={{ marginTop: 10, borderRadius: 14, backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)', paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: C.green, fontSize: 12, fontWeight: '900' }}>You're in! 🙌 Host got your message</Text>
                  </View>
                ) : (
                  <NeonButton small label="JOIN THE MOMENT 🙌" style={{ marginTop: 10 }} onPress={() => joinFire(c)} />
                )}
              </Glass>
            )) : (
              <Glass tint="rgba(255,255,255,0.96)" style={{ width: 252, padding: 16, marginRight: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>🔥</Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>No live campfires yet</Text>
                <Text style={{ color: C.faint, fontSize: 11, marginTop: 3, textAlign: 'center' }}>Be the first to host one</Text>
              </Glass>
            )
          ) : (
            <>
              {venues.length ? venues.map((b) => (
                <Glass key={b.id} tint="rgba(255,255,255,0.96)" style={{ width: 232, padding: 13, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, marginRight: 9 }}>{b.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{b.name}</Text>
                      {b.sub ? <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>{b.sub}</Text> : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', flex: 1 }}>{b.price || ''}</Text>
                    {booked[b.id] ? (
                      <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 }}>
                        <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '900' }}>Requested ✓</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => bookVenue(b)}>
                        <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 6 }}>
                          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>Book</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                </Glass>
              )) : (
                <Glass tint="rgba(255,255,255,0.96)" style={{ width: 232, padding: 16, marginRight: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22 }}>📅</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>No venues yet</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 3, textAlign: 'center' }}>Own a place? Get listed →</Text>
                </Glass>
              )}
              <Pressable onPress={() => openSheet('partner')}>
                <Glass tint="rgba(124,58,237,0.08)" border="rgba(124,58,237,0.35)" style={{ width: 200, padding: 13, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24 }}>🤝</Text>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>Own a place?</Text>
                  <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 3, textAlign: 'center' }}>Get on the Moments map — people book you from here</Text>
                  <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 9 }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Partner with us</Text>
                  </View>
                </Glass>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {MAPS_READY ? (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: myCoords.latitude, longitude: myCoords.longitude, latitudeDelta: 0.042, longitudeDelta: 0.03 }}
          userInterfaceStyle="light"
          showsUserLocation={hasLocationPerm}
        >
          <Marker coordinate={myCoords}>
            <MePin doing={myDoing} />
          </Marker>
          {people.map((p) => (
            <Marker key={p.id} coordinate={p.coords} onPress={() => setProfileUser(p)}>
              <PersonPin p={p} onPress={() => setProfileUser(p)} />
            </Marker>
          ))}
          {campfires.filter((c) => c.coords).map((c) => (
            <Marker key={c.id} coordinate={c.coords}>
              <CampfirePin c={c} />
            </Marker>
          ))}
          {SUPABASE_READY ? realVenues.filter((v) => v.lat != null).map((v) => (
            <Marker key={v.id} coordinate={{ latitude: v.lat, longitude: v.lng }} onPress={() => setRail('book')}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ backgroundColor: '#FFF', borderWidth: 1.5, borderColor: C.purple, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 14 }}>{v.emoji || '📍'}</Text>
                </View>
              </View>
            </Marker>
          )) : null}
        </MapView>
      ) : Platform.OS === 'web' ? (
        <LeafletMap center={myCoords} markers={mapMarkers} onPress={onMarkerPress} locate={located} />
      ) : (
        <FauxMap center={myCoords}>
          <View style={{ position: 'absolute', left: '38%', top: '50%' }}>
            <MePin doing={myDoing} />
          </View>
          {people.map((p) => {
            const pos = SUPABASE_READY ? projectToMap(myCoords, p.coords) : { left: p.fx, top: p.fy };
            return (
              <View key={p.id} style={{ position: 'absolute', left: pos.left, top: pos.top }}>
                <PersonPin p={p} onPress={() => setProfileUser(p)} />
              </View>
            );
          })}
          {campfires.filter((c) => SUPABASE_READY ? c.coords : true).map((c) => {
            const pos = (SUPABASE_READY || !c.fx) ? projectToMap(myCoords, c.coords || myCoords) : { left: c.fx, top: c.fy };
            return (
              <View key={c.id} style={{ position: 'absolute', left: pos.left, top: pos.top }}>
                <CampfirePin c={c} />
              </View>
            );
          })}
          {SUPABASE_READY ? realVenues.filter((v) => v.lat != null).map((v) => {
            const pos = projectToMap(myCoords, { latitude: v.lat, longitude: v.lng });
            return (
              <Pressable key={v.id} onPress={() => setRail('book')} style={{ position: 'absolute', left: pos.left, top: pos.top }}>
                <View style={{ backgroundColor: '#FFF', borderWidth: 1.5, borderColor: C.purple, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 14 }}>{v.emoji || '📍'}</Text>
                </View>
              </Pressable>
            );
          }) : null}
        </FauxMap>
      )}

      {overlays}

      {/* honest toast — errors & confirmations for map actions */}
      {mapNote ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 78, left: 24, right: 24, alignItems: 'center', zIndex: 40 }}>
          <View style={{ backgroundColor: 'rgba(17,24,39,0.94)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>{mapNote}</Text>
          </View>
        </View>
      ) : null}

      {/* SOS confirm sheet */}
      {sos ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSos(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Glass tint="rgba(24,18,20,0.97)" border="rgba(244,63,94,0.5)" style={{ padding: 22, alignSelf: 'stretch' }}>
              {sos === 'ask' ? (
                <View>
                  <Text style={{ fontSize: 34, textAlign: 'center' }}>🚨</Text>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Send SOS?</Text>
                  <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                    Your live pin turns into an SOS marker so people around you on the map can see you need help.
                  </Text>
                  <NeonButton color={C.coral} label="SEND SOS NOW" style={{ marginTop: 18 }} onPress={sendSos} />
                  <GhostButton small label="Cancel" style={{ marginTop: 10 }} onPress={() => setSos(null)} />
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 34, textAlign: 'center' }}>📍</Text>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Your SOS pin is live</Text>
                  <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                    Anyone nearby on the Moments map can see it right now. Stay where you are.
                  </Text>
                  <GhostButton small label="Close" style={{ marginTop: 18 }} onPress={() => setSos(null)} />
                </View>
              )}
            </Glass>
          </View>
        </Modal>
      ) : null}

      {/* nearby people — who's around you right now */}
      {sheet === 'nearby' ? (
        <Pressable onPress={closeSheet} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16, maxHeight: '70%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Nearby people 📍</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 10 }}>
              {SUPABASE_READY ? 'People sharing their activity right now' : 'Mates & explorers around you right now'}
            </Text>
            {nearbyPeople.length ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {nearbyPeople.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}>
                    <Pressable onPress={() => { closeSheet(); setProfileUser(p); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View>
                        <Image source={{ uri: p.cartoonAvatar || p.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                        {p.doing ? (
                          <View style={{ position: 'absolute', bottom: -2, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10 }}>{p.doing}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{p.name}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{p.intent} · {p.km.toFixed(1)} km away</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => wave(p)}>
                      <View style={{ backgroundColor: waved[p.id] ? C.greenSoft : C.purpleSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: waved[p.id] ? C.green : C.purple, fontSize: 12, fontWeight: '900' }}>{waved[p.id] ? 'Waved ✓' : 'Wave 👋'}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 28 }}>🧭</Text>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginTop: 8 }}>No one nearby yet</Text>
                <Text style={{ color: C.faint, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                  Set your activity below — you'll be the first pin on the map.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      ) : null}

      {/* pick the activity you appear with on the map */}
      {sheet === 'doing' ? (
        <Pressable onPress={closeSheet} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>What are you up to? </Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>
              {SUPABASE_READY && !hasLocationPerm
                ? 'Turn on location access to share your real pin with nearby people'
                : 'This shows on your real pin so the right people find you'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DOING_OPTIONS.map((e) => {
                const on = myDoing === e;
                return (
                  <Pressable key={e} onPress={() => pickDoing(e)}>
                    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 26 }}>{e}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {myDoing ? (
              <Pressable onPress={goInvisibleNow}>
                <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginTop: 6 }}>Go invisible (hide my activity)</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      ) : null}

      {/* drop a moment — put yourself on the map so people gather around you */}
      {sheet === 'drop' ? (
        <Pressable onPress={closeSheet} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Drop a Moment 📍</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 12 }}>
              A pin lands on your exact spot — people around you can see it and join
            </Text>
            <TextInput
              placeholder="What's happening? (e.g. Football at the club, 6PM ⚽)"
              placeholderTextColor={C.faint}
              value={dropTitle}
              onChangeText={setDropTitle}
              style={{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 12 }}
            />
            <Pressable onPress={dropMoment}>
              <View style={{ backgroundColor: dropTitle.trim() ? C.purple : C.glassHi, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: dropTitle.trim() ? '#FFF' : C.faint, fontSize: 14, fontWeight: '900' }}>Put it on the map 🔥</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}

      {/* partner program — restaurants, cafés & venues join the map */}
      {sheet === 'partner' ? (
        <Pressable onPress={closeSheet} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            {partnerSent ? (
              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ fontSize: 34 }}>🎉</Text>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginTop: 8 }}>Application in!</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                  Our crew reviews every venue (quality over quantity). You'll hear back within 48h.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Put your place on Moments 🤝</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6, lineHeight: 19 }}>
                  Restaurants, cafés, courts & venues — get a pin on the map and take bookings straight from the people around you.
                </Text>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginTop: 12 }}>
                  {[
                    ['📍', 'A live pin on the Moments map'],
                    ['📅', 'Bookings & reservations through the app'],
                    ['📣', 'Boost your place with Moments Ads'],
                    ['💸', 'Simple deal: 10% commission per booking — nothing upfront'],
                  ].map(([e, t]) => (
                    <View key={t} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                      <Text style={{ fontSize: 15, marginRight: 10 }}>{e}</Text>
                      <Text style={{ color: C.text, fontSize: 12.5, flex: 1 }}>{t}</Text>
                    </View>
                  ))}
                </View>

                <TextInput
                  placeholder="Venue or business name"
                  placeholderTextColor={C.faint}
                  value={vName}
                  onChangeText={setVName}
                  style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }}
                />
                <View style={{ flexDirection: 'row', marginTop: 9 }}>
                  {VENUE_KINDS.map((k) => (
                    <Pressable key={k} onPress={() => { tapSelection(); setVKind(k); }} style={{ marginRight: 8 }}>
                      <View style={{ backgroundColor: vKind === k ? C.purple : C.glass, borderWidth: 1, borderColor: vKind === k ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: vKind === k ? '#FFF' : C.dim, fontSize: 11.5, fontWeight: '800' }}>{k}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  placeholder="What's the offer? (e.g. Padel court, 4 players)"
                  placeholderTextColor={C.faint}
                  value={vSub}
                  onChangeText={setVSub}
                  style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 9 }}
                />
                <TextInput
                  placeholder="Price (e.g. E£220/hr)"
                  placeholderTextColor={C.faint}
                  value={vPrice}
                  onChangeText={setVPrice}
                  style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 9 }}
                />

                <Pressable onPress={submitVenue} style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: vName.trim() ? C.purple : C.glassHi, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: vName.trim() ? '#FFF' : C.faint, fontSize: 14, fontWeight: '900' }}>Apply — takes 2 minutes</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      ) : null}

      {/* a REAL place (OpenStreetMap) — directions + tracked deals */}
      {placeOpen ? (
        <Pressable onPress={() => setPlaceOpen(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 26 }}>{placeOpen.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{placeOpen.name}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>
                  {placeOpen.category}{placeOpen.cuisine ? ' · ' + placeOpen.cuisine : ''}
                </Text>
                {placeOpen.address ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>📍 {placeOpen.address}</Text> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Pressable onPress={() => dealsFor(placeOpen)} style={{ flex: 1, marginRight: 10 }}>
                <View style={{ backgroundColor: C.green, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>🎟️ Deals on Waffarha</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => directionsTo(placeOpen)} style={{ width: 132 }}>
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>🧭 Directions</Text>
                </View>
              </Pressable>
            </View>
            <Text style={{ color: C.faint, fontSize: 10.5, textAlign: 'center', marginTop: 12 }}>
              Real place · OpenStreetMap — deals open Waffarha with your referral tracked
            </Text>
          </Pressable>
        </Pressable>
      ) : null}

      {/* curated destination — the guide sheet: story, reviews, Uber */}
      {destOpen ? (
        <Pressable onPress={() => setDestOpen(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 30 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, maxHeight: '82%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 10 }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(245,179,1,0.14)', borderWidth: 1.5, borderColor: 'rgba(245,179,1,0.5)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 28 }}>{destOpen.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{destOpen.name} {destOpen.flag}</Text>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{destOpen.area} · {destOpen.country}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 5 }}>
                    {(destOpen.tags || []).map((t) => (
                      <View key={t} style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginRight: 6 }}>
                        <Text style={{ color: C.purple, fontSize: 10, fontWeight: '900' }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 21, marginTop: 14 }}>{destOpen.desc}</Text>

              {/* get there — Uber for nearby spots, Book Trip when it's far */}
              {(() => {
                const km = located ? kmBetween(myCoords, { latitude: destOpen.lat, longitude: destOpen.lng }) : null;
                const nearEnough = km != null && km < 80;
                return (
                  <>
                    {km != null ? (
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 10 }}>
                        📍 {km < 1 ? 'Right next to you' : Math.round(km) + ' km from you'}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', marginTop: 10 }}>
                      {nearEnough ? (
                        <Pressable onPress={() => uberTo(destOpen)} style={{ flex: 1, marginRight: 10 }}>
                          <View style={{ backgroundColor: '#111827', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>🚗 Uber there</Text>
                          </View>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => { tapLight(); setTripOpen((o) => !o); }} style={{ flex: 1, marginRight: 10 }}>
                          <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>🧳 Book this trip</Text>
                          </View>
                        </Pressable>
                      )}
                      <Pressable onPress={() => directionsTo(destOpen)} style={{ width: 132 }}>
                        <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}>
                          <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>🧭 Directions</Text>
                        </View>
                      </Pressable>
                    </View>
                  </>
                );
              })()}

              {/* the Book Trip form — real request, we call you back */}
              {tripOpen ? (
                <Glass style={{ padding: 14, marginTop: 12 }}>
                  {tripSent ? (
                    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                      <Text style={{ fontSize: 32 }}>🎉</Text>
                      <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 8 }}>Trip request received!</Text>
                      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
                        Our crew will call you within 24h to plan {destOpen.name} — dates, group, budget, everything.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>Plan my trip to {destOpen.name} {destOpen.flag}</Text>
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, marginBottom: 10 }}>
                        Fill this in — we arrange transport, stay & guides, then call you to confirm.
                      </Text>
                      <TextInput placeholder="Your full name" placeholderTextColor={C.faint} value={tripName} onChangeText={setTripName}
                        style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }} />
                      <TextInput placeholder="Phone (WhatsApp) e.g. +20…" placeholderTextColor={C.faint} value={tripPhone} onChangeText={setTripPhone} keyboardType="phone-pad"
                        style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }} />
                      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                        <TextInput placeholder="When? (e.g. 20 Aug)" placeholderTextColor={C.faint} value={tripDate} onChangeText={setTripDate}
                          style={{ flex: 1, color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 }} />
                        <TextInput placeholder="People" placeholderTextColor={C.faint} value={tripPeople} onChangeText={setTripPeople} keyboardType="number-pad" maxLength={2}
                          style={{ width: 86, color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />
                      </View>
                      <TextInput placeholder="Anything else? (budget, camping vs hotel…)" placeholderTextColor={C.faint} value={tripNotes} onChangeText={setTripNotes}
                        style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }} />
                      {tripErr ? <Text style={{ color: C.coral, fontSize: 11.5, textAlign: 'center', marginBottom: 8 }}>{tripErr}</Text> : null}
                      <Pressable onPress={submitTrip}>
                        <View style={{ backgroundColor: tripName.trim() && tripPhone.trim() ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}>
                          <Text style={{ color: tripName.trim() && tripPhone.trim() ? '#FFF' : C.faint, fontSize: 13.5, fontWeight: '900' }}>Send trip request 🧳</Text>
                        </View>
                      </Pressable>
                    </>
                  )}
                </Glass>
              ) : null}

              {/* community feedback — real reviews, written right here */}
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>
                COMMUNITY FEEDBACK
                {destReviews && destReviews.length
                  ? ' · ⭐ ' + (destReviews.reduce((s, r) => s + r.stars, 0) / destReviews.length).toFixed(1) + ' (' + destReviews.length + ')'
                  : ''}
              </Text>

              <Glass style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Pressable key={s} onPress={() => { tapSelection(); setRevStars(s); }} hitSlop={6}>
                      <Text style={{ fontSize: 26, marginHorizontal: 4, opacity: revStars >= s ? 1 : 0.25 }}>⭐</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  placeholder="Been here? Tell the crew how it was…"
                  placeholderTextColor={C.faint}
                  value={revText}
                  onChangeText={setRevText}
                  style={{ color: C.text, fontSize: 13, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                />
                {revErr ? <Text style={{ color: C.coral, fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>{revErr}</Text> : null}
                {revSaved ? <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>Feedback saved — thank you! 🙌</Text> : null}
                <Pressable onPress={submitReview} style={{ marginTop: 10 }}>
                  <View style={{ backgroundColor: revStars ? C.purple : C.glassHi, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                    <Text style={{ color: revStars ? '#FFF' : C.faint, fontSize: 13, fontWeight: '900' }}>Leave feedback ⭐</Text>
                  </View>
                </Pressable>
              </Glass>

              {destReviews === null ? (
                <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', paddingVertical: 14 }}>Loading reviews…</Text>
              ) : destReviews.length === 0 ? (
                <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', paddingVertical: 14 }}>No feedback yet — be the first explorer to rate it ✨</Text>
              ) : (
                destReviews.slice(0, 8).map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', marginTop: 12 }}>
                    <Image source={{ uri: (r.user && r.user.avatar_url) || AV_NEUTRAL }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                    <View style={{ flex: 1, marginLeft: 10, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10 }}>
                      <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>
                        {(r.user && r.user.name) || 'Explorer'} {(r.user && r.user.country_flag) || ''}  <Text style={{ color: '#B8860B' }}>{'⭐'.repeat(r.stars)}</Text>
                      </Text>
                      {r.body ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{r.body}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}

      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
      {bookingVenue ? <BookingSheet venue={bookingVenue} onClose={() => { setBooked((x) => ({ ...x, [bookingVenue.id]: true })); setBookingVenue(null); }} /> : null}
    </View>
  );
};
