import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Dimensions, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, R, TEXT_BGS } from '../constants/theme';
import { ME, HIGHLIGHTS, MY_MOMENTS, BADGES, COUNTRIES, av } from '../constants/mockData'; // demo-mode fallback only
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profiles';
import { uploadCapture } from '../services/social';
import { fetchMyMoments } from '../services/posts';
import { countMyCampfires } from '../services/campfires';
import { Tick, GhostButton, BoostSheet } from '../components';
import { SettingsScreen } from './SettingsScreen';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';

/* ─── YOUR SPACE — the profile, Facebook / Instagram / X style ───
   Real mode shows your actual profile, your actual posts (with real
   star counts) and stats computed from real data — nothing fabricated.
   Demo mode (no Supabase project) keeps the original mock scene. */

const GAP = 3;
const COL = 3;
const SIZE = (Dimensions.get('window').width - 32 - GAP * (COL - 1)) / COL;

const monthYear = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const Stat = ({ n, label }) => (
  <Pressable onPress={tapSelection} style={{ alignItems: 'center', flex: 1 }}>
    <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{n}</Text>
    <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2, letterSpacing: 0.3 }}>{label}</Text>
  </Pressable>
);

const GridCell = ({ item }) => {
  if (item.text) {
    const bg = TEXT_BGS[item.textBg] || TEXT_BGS.plain;
    return (
      <LinearGradient
        colors={bg.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', padding: 8 }}
      >
        <Text style={{ color: bg.text, fontSize: 11.5, fontWeight: '700', textAlign: 'center', lineHeight: 15 }} numberOfLines={4}>
          {item.text}
        </Text>
      </LinearGradient>
    );
  }
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Image source={{ uri: item.media }} style={{ width: SIZE, height: SIZE }} />
      {item.kind === 'reel' ? (
        <MaterialCommunityIcons name="play-box-outline" size={16} color="#fff" style={{ position: 'absolute', top: 6, right: 6, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 }} />
      ) : null}
      <View style={{ position: 'absolute', bottom: 5, left: 6, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name="star-four-points" size={11} color={C.gold} />
        <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 }}>{item.vibes}</Text>
      </View>
    </View>
  );
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState('grid');
  const [menu, setMenu] = useState(false);            // the ☰ sheet
  const [accountType, setAccountType] = useState('public'); // public | private | professional
  const [category, setCategory] = useState('Creator');
  const [dash, setDash] = useState(false);            // professional dashboard
  const [pageMade, setPageMade] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);      // ads manager
  const [boostOpen, setBoostOpen] = useState(false);  // paid boost purchase
  const [editOpen, setEditOpen] = useState(false);

  // ── real profile + real moments (empty/zero until data actually exists) ──
  const [myProfile, setMyProfile] = useState(null);
  const [myMoments, setMyMoments] = useState([]);
  const [campfiresHosted, setCampfiresHosted] = useState(0);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editIntent, setEditIntent] = useState('');
  const [editAvatar, setEditAvatar] = useState(null); // new avatar url after upload
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState(null);
  const [editFlag, setEditFlag] = useState('');
  const [savedEdit, setSavedEdit] = useState(false);

  /* Pick a new profile photo → upload → save avatar_url on your profile.
     Derive the extension + content-type from the asset's real mime type
     (a web blob:/data: URI has no file extension, which used to corrupt
     the upload so the new photo never rendered). */
  const changeAvatar = async () => {
    if (avatarBusy) return;
    setAvatarErr(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain !== false) { /* web grants implicitly */ }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets || !res.assets[0]) return;
    const asset = res.assets[0];
    setEditAvatar(asset.uri); // instant preview
    if (!SUPABASE_READY || !user) { setAvatarErr('Sign in with a real account to save your photo.'); return; }
    setAvatarBusy(true);
    try {
      const mime = asset.mimeType || 'image/jpeg';
      const ext = (mime.split('/')[1] === 'jpeg' ? 'jpg' : (mime.split('/')[1] || 'jpg'));
      const publicUrl = await uploadCapture(user.id, asset.uri, ext, mime);
      await updateProfile(user.id, { avatar_url: publicUrl });
      setEditAvatar(publicUrl);
      tapSuccess(); sfxSuccess();
      reload();
    } catch (e) {
      setAvatarErr(e.message || 'Upload failed — is the “media” storage bucket created?');
    } finally { setAvatarBusy(false); }
  };

  const reload = () => {
    if (!SUPABASE_READY || !user) return;
    getProfile(user.id).then((p) => {
      setMyProfile(p);
      setEditName(p.name || '');
      setEditBio(p.bio || '');
      setEditIntent(p.intent || '');
      setEditFlag(p.country_flag || '');
    }).catch(() => {});
    fetchMyMoments(user.id).then(setMyMoments).catch(() => {});
    countMyCampfires(user.id).then(setCampfiresHosted).catch(() => {});
  };

  useEffect(reload, [user]);

  const CATEGORIES = ['Creator', 'Photographer', 'Coach', 'Musician', 'Local Business', 'Community'];

  const MenuRow = ({ icon, label, sub, onPress, right }) => (
    <Pressable onPress={() => { tapSelection(); onPress && onPress(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={icon} size={17} color={C.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }}>{label}</Text>
          {sub ? <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 1 }}>{sub}</Text> : null}
        </View>
        {right || <Ionicons name="chevron-forward" size={16} color={C.faint} />}
      </View>
    </Pressable>
  );

  const saveEdit = async () => {
    if (!SUPABASE_READY || !user) { setEditOpen(false); return; }
    try {
      const c = COUNTRIES.find((x) => x.flag === editFlag);
      await updateProfile(user.id, { name: editName.trim() || 'Explorer', bio: editBio.trim() || null, intent: editIntent.trim() || null, country: c ? c.name : null, country_flag: editFlag || null });
      tapSuccess(); sfxSuccess();
      setSavedEdit(true);
      reload();
      setTimeout(() => { setSavedEdit(false); setEditOpen(false); }, 900);
    } catch (e) {}
  };

  /* Real mode: your actual profile row. Demo mode: the mock ME. */
  const me = SUPABASE_READY
    ? {
        handle: (myProfile && myProfile.handle && '@' + myProfile.handle) || (user && user.email ? '@' + user.email.split('@')[0] : '@you'),
        verified: !!(myProfile && myProfile.verified),
        avatar: (myProfile && myProfile.avatar_url) || av(5),
        name: (myProfile && myProfile.name) || 'Explorer',
        intent: (myProfile && myProfile.intent) || null,
        bio: (myProfile && myProfile.bio) || 'Add a bio — tell people what you\'re about ✨',
      }
    : ME;

  const gridItems = SUPABASE_READY
    ? myMoments.map((row) => row.media_url
        ? { id: row.id, media: row.media_url, kind: row.type === 'reel' ? 'reel' : undefined, vibes: row.vibesCount }
        : { id: row.id, text: row.caption, textBg: row.text_bg || 'plain', vibes: row.vibesCount })
    : MY_MOMENTS;

  const moments = SUPABASE_READY ? myMoments.length : ME.moments;
  const mates = SUPABASE_READY ? 0 : ME.mates; // no follow/mates system built yet — honest zero, not fabricated
  const campfires = SUPABASE_READY ? campfiresHosted : ME.campfires;

  /* Real badges are derived, never invented: verified + how long you've been here. */
  const realBadges = [
    me.verified ? { id: 'b-verified', emoji: '✦', label: 'Verified' } : null,
    myProfile && myProfile.created_at ? { id: 'b-joined', emoji: '📅', label: 'Joined ' + monthYear(myProfile.created_at) } : null,
  ].filter(Boolean);
  const badges = SUPABASE_READY ? realBadges : BADGES;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar — handle + gear */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{me.handle}</Text>
            {me.verified ? <Tick /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={tapLight} hitSlop={8} style={{ marginRight: 18 }}>
              <MaterialCommunityIcons name="plus-box-outline" size={24} color={C.text} />
            </Pressable>
            <Pressable onPress={() => { tapLight(); setMenu(true); }} hitSlop={8} style={{ marginRight: 18 }}>
              <Ionicons name="menu-outline" size={26} color={C.text} />
            </Pressable>
            <Pressable onPress={() => { tapLight(); setSettings(true); }} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={C.text} />
            </Pressable>
          </View>
        </View>

        {/* identity */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { tapLight(); setEditOpen(true); }}>
              <LinearGradient
                colors={[C.gold, C.purple, C.green]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ backgroundColor: C.bg, borderRadius: 46, padding: 3 }}>
                  <Image source={{ uri: me.avatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                </View>
              </LinearGradient>
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', marginLeft: 6 }}>
              <Stat n={moments} label="Moments" />
              <Stat n={mates} label="Mates" />
              <Stat n={campfires} label="Campfires" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{me.name}</Text>
            {accountType === 'private' ? (
              <Ionicons name="lock-closed" size={13} color={C.faint} style={{ marginLeft: 6 }} />
            ) : null}
            {accountType === 'professional' ? (
              <Text style={{ color: C.faint, fontSize: 12.5, marginLeft: 8 }}>· {category}</Text>
            ) : null}
            {me.intent ? (
              <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 }}>
                <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800' }}>{me.intent}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>{me.bio}</Text>

          {/* badges */}
          {badges.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {badges.map((b) => (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12 }}>{b.emoji}</Text>
                  <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginLeft: 5 }}>{b.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* actions */}
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <GhostButton small label="Edit your space" onPress={() => { tapLight(); setEditOpen(true); }} style={{ flex: 1, marginRight: 8 }} />
            <GhostButton small label="Share profile" onPress={tapLight} style={{ flex: 1, marginRight: 8 }} />
            <Pressable onPress={tapLight} style={{ width: 44 }}>
              <View style={{ borderRadius: R - 4, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 10, alignItems: 'center' }}>
                <Ionicons name="person-add-outline" size={16} color={C.text} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* highlights — demo only; real story highlights need the stories
            feature built first, so real mode simply doesn't show fake ones */}
        {!SUPABASE_READY ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginTop: 20 }}>
            {HIGHLIGHTS.map((h) => (
              <Pressable key={h.id} onPress={tapSelection} style={{ alignItems: 'center', marginRight: 16 }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.line, padding: 3 }}>
                  <Image source={{ uri: h.cover }} style={{ width: '100%', height: '100%', borderRadius: 28 }} />
                </View>
                <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 5, fontWeight: '600' }}>{h.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* tab strip */}
        <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: C.line }}>
          {[
            { key: 'grid', icon: 'grid-outline' },
            { key: 'posts', icon: 'chatbox-ellipses-outline' },
            { key: 'reels', icon: 'play-outline' },
            { key: 'tagged', icon: 'pricetag-outline' },
          ].map((t) => (
            <Pressable key={t.key} onPress={() => { tapSelection(); setTab(t.key); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name={t.icon} size={22} color={tab === t.key ? C.text : C.faint} />
              {tab === t.key ? <View style={{ height: 2, width: '60%', backgroundColor: C.text, marginTop: 10, position: 'absolute', bottom: -1 }} /> : null}
            </Pressable>
          ))}
        </View>

        {/* grid */}
        {tab === 'tagged' ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 }}>
            <Ionicons name="pricetag-outline" size={30} color={C.faint} />
            <Text style={{ color: C.faint, fontSize: 13, marginTop: 10, textAlign: 'center' }}>Moments you're tagged in will show up here ✨</Text>
          </View>
        ) : tab === 'posts' ? (
          /* written posts, X-style — your words front and centre */
          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            {gridItems.filter((m) => m.text).length ? gridItems.filter((m) => m.text).map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Image source={{ uri: me.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{me.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 12.5, marginLeft: 6 }}>{me.handle}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 15, lineHeight: 22, marginTop: 4 }}>{item.text}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color={C.gold} />
                    <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>{item.vibes}</Text>
                  </View>
                </View>
              </View>
            )) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 26 }}>✍️</Text>
                <Text style={{ color: C.faint, fontSize: 13, marginTop: 8 }}>No written moments yet</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: GAP }}>
            {(tab === 'reels' ? gridItems.filter((m) => m.kind === 'reel') : gridItems).length ? (
              (tab === 'reels' ? gridItems.filter((m) => m.kind === 'reel') : gridItems).map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={tapSelection}
                  style={{ marginRight: (i % COL === COL - 1) ? 0 : GAP, marginBottom: GAP, borderRadius: 4, overflow: 'hidden' }}
                >
                  <GridCell item={item} />
                </Pressable>
              ))
            ) : (
              <View style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 26 }}>✨</Text>
                <Text style={{ color: C.faint, fontSize: 13, marginTop: 8 }}>No moments yet — share your first one</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
        <SettingsScreen onClose={() => setSettings(false)} />
      </Modal>

      {/* edit your space — real fields, saved to your real profile */}
      {editOpen ? (
        <Pressable onPress={() => setEditOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Edit your space</Text>

            {/* tap to change your profile photo */}
            <Pressable onPress={changeAvatar} style={{ alignSelf: 'center', marginBottom: 16 }}>
              <Image source={{ uri: editAvatar || me.avatar }} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.line }} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
                <Ionicons name={avatarBusy ? 'hourglass' : 'camera'} size={15} color="#FFF" />
              </View>
            </Pressable>
            <Text style={{ color: avatarErr ? C.coral : C.faint, fontSize: 11.5, textAlign: 'center', marginTop: -8, marginBottom: 12 }}>
              {avatarBusy ? 'Uploading…' : avatarErr ? avatarErr : 'Tap the photo to change it'}
            </Text>

            <TextInput
              placeholder="Name"
              placeholderTextColor={C.faint}
              value={editName}
              onChangeText={setEditName}
              style={{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9 }}
            />
            <TextInput
              placeholder="Bio"
              placeholderTextColor={C.faint}
              value={editBio}
              onChangeText={setEditBio}
              multiline
              style={{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9, minHeight: 70, textAlignVertical: 'top' }}
            />
            <TextInput
              placeholder="Your vibe (e.g. Exploring 🧭)"
              placeholderTextColor={C.faint}
              value={editIntent}
              onChangeText={setEditIntent}
              style={{ color: C.text, fontSize: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12 }}
            />

            {/* country — shows as a flag on your map avatar */}
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>YOUR COUNTRY 🌍</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {COUNTRIES.map((c) => {
                const on = editFlag === c.flag;
                return (
                  <Pressable key={c.name} onPress={() => { tapSelection(); setEditFlag(on ? '' : c.flag); }}>
                    <View style={{ alignItems: 'center', marginRight: 12 }}>
                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                      </View>
                      <Text style={{ color: on ? C.purple : C.faint, fontSize: 9.5, fontWeight: '700', marginTop: 3 }}>{c.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={saveEdit}>
              <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{savedEdit ? 'Saved ✓' : 'Save'}</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}

      {/* ☰ — creator & account tools, Instagram style */}
      {menu ? (
        <Pressable onPress={() => setMenu(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 18, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 10 }} />

            {/* account type switch */}
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>ACCOUNT TYPE</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {['public', 'private', 'professional'].map((k) => {
                const on = accountType === k;
                return (
                  <Pressable key={k} onPress={() => { tapSelection(); setAccountType(k); }} style={{ flex: 1, marginRight: k !== 'professional' ? 8 : 0 }}>
                    <View style={{ backgroundColor: on ? C.purple : C.glass, borderWidth: 1, borderColor: on ? C.purple : C.line, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15 }}>{k === 'public' ? '🌍' : k === 'private' ? '🔒' : '💼'}</Text>
                      <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 11, fontWeight: '800', marginTop: 3, textTransform: 'capitalize' }}>{k}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* category — shows next to your name on professional accounts */}
            {accountType === 'professional' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <Pressable key={c} onPress={() => { tapSelection(); setCategory(c); }}>
                      <View style={{ backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: 1, borderColor: on ? 'rgba(124,58,237,0.4)' : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
                        <Text style={{ color: on ? C.purple : C.dim, fontSize: 12, fontWeight: '800' }}>{c}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {accountType === 'professional' ? (
              <MenuRow icon="stats-chart-outline" label="Professional dashboard" sub="Reach, stars & what's working" onPress={() => { setMenu(false); setDash(true); }} />
            ) : null}
            <MenuRow
              icon="flag-outline"
              label={pageMade ? 'Your Page · Moments Studio' : 'Create a Page'}
              sub={pageMade ? 'Live — manage it anytime' : 'For your brand, band or business'}
              onPress={() => setPageMade(true)}
              right={pageMade ? <Ionicons name="checkmark-circle" size={20} color={C.green} /> : null}
            />
            <MenuRow icon="megaphone-outline" label="Ads Manager" sub="Boost moments · campaigns · media buying" onPress={() => { setMenu(false); setAdsOpen(true); }} />
            <MenuRow icon="star-outline" label="Close Friends" sub="Share some moments with your inner circle" />
            <MenuRow icon="create-outline" label="Edit your space" sub="Name, bio, vibe & links" onPress={() => setEditOpen(true)} />
          </Pressable>
        </Pressable>
      ) : null}

      {/* Ads Manager — boost, track, spend. Honest: no fabricated campaign
          numbers, since there's no real ad-campaign backend yet. */}
      {adsOpen ? (
        <Pressable onPress={() => setAdsOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Ads Manager 📣</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>Put your moments in front of the right crowd</Text>

            <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 22 }}>📊</Text>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>No campaigns yet</Text>
              <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 3, textAlign: 'center' }}>Boost a moment to put it in front of more people</Text>
            </View>

            <Pressable onPress={() => { tapSelection(); setAdsOpen(false); setBoostOpen(true); }}>
              <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 }}>✦ Boost — Top of Search · Promoted Pin</Text>
              </LinearGradient>
            </Pressable>
            <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
              Every ad is labeled "Sponsored" · great reviews = cheaper clicks (Feedback Factor).
            </Text>
          </Pressable>
        </Pressable>
      ) : null}

      {/* professional dashboard — honest numbers, zero clutter */}
      {dash ? (
        <Pressable onPress={() => setDash(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Dashboard 💼</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>{category} · your real numbers</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {[
                { n: String(moments), l: 'Moments' },
                { n: String(myMoments.reduce((s, r) => s + (r.vibesCount || 0), 0)), l: 'Total stars' },
                { n: String(campfires), l: 'Campfires hosted' },
              ].map((s) => (
                <View key={s.l} style={{ flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, marginRight: s.l !== 'Campfires hosted' ? 8 : 0 }}>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{s.n}</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{s.l}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {boostOpen ? <BoostSheet onClose={() => setBoostOpen(false)} /> : null}
    </View>
  );
};
