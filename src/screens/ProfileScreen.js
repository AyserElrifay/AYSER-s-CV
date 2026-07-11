import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, R, TEXT_BGS } from '../constants/theme';
import { ME, HIGHLIGHTS, MY_MOMENTS, BADGES } from '../constants/mockData';
import { Tick, GhostButton } from '../components';
import { SettingsScreen } from './SettingsScreen';
import { tapLight, tapSelection } from '../utils/feedback';

/* ─── YOUR SPACE — the profile, Facebook / Instagram / X style ───
   Clean identity header, stats, highlights, then your moment grid.
   The gear opens Settings (where the wallet now lives). */

const GAP = 3;
const COL = 3;
const SIZE = (Dimensions.get('window').width - 32 - GAP * (COL - 1)) / COL;

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
  const [settings, setSettings] = useState(false);
  const [tab, setTab] = useState('grid');
  const [menu, setMenu] = useState(false);            // the ☰ sheet
  const [accountType, setAccountType] = useState('public'); // public | private | professional
  const [category, setCategory] = useState('Creator');
  const [dash, setDash] = useState(false);            // professional dashboard
  const [pageMade, setPageMade] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);      // ads manager
  const [boosted, setBoosted] = useState(false);

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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar — handle + gear */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{ME.handle}</Text>
            {ME.verified ? <Tick /> : null}
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
            <LinearGradient
              colors={[C.gold, C.purple, C.green]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ backgroundColor: C.bg, borderRadius: 46, padding: 3 }}>
                <Image source={{ uri: ME.avatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              </View>
            </LinearGradient>
            <View style={{ flex: 1, flexDirection: 'row', marginLeft: 6 }}>
              <Stat n={ME.moments} label="Moments" />
              <Stat n={ME.mates} label="Mates" />
              <Stat n={ME.campfires} label="Campfires" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{ME.name}</Text>
            {accountType === 'private' ? (
              <Ionicons name="lock-closed" size={13} color={C.faint} style={{ marginLeft: 6 }} />
            ) : null}
            {accountType === 'professional' ? (
              <Text style={{ color: C.faint, fontSize: 12.5, marginLeft: 8 }}>· {category}</Text>
            ) : null}
            <View style={{ backgroundColor: C.purpleSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 }}>
              <Text style={{ color: C.purple, fontSize: 11, fontWeight: '800' }}>{ME.intent}</Text>
            </View>
          </View>
          <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>{ME.bio}</Text>

          {/* badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {BADGES.map((b) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 12 }}>{b.emoji}</Text>
                <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginLeft: 5 }}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* actions */}
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <GhostButton small label="Edit your space" onPress={tapLight} style={{ flex: 1, marginRight: 8 }} />
            <GhostButton small label="Share profile" onPress={tapLight} style={{ flex: 1, marginRight: 8 }} />
            <Pressable onPress={tapLight} style={{ width: 44 }}>
              <View style={{ borderRadius: R - 4, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingVertical: 10, alignItems: 'center' }}>
                <Ionicons name="person-add-outline" size={16} color={C.text} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* highlights */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, marginTop: 20 }}>
          {HIGHLIGHTS.map((h) => (
            <Pressable key={h.id} onPress={tapSelection} style={{ alignItems: 'center', marginRight: 16 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.line, padding: 3 }}>
                <Image source={{ uri: h.cover }} style={{ width: '100%', height: '100%', borderRadius: 28 }} />
              </View>
              <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 5, fontWeight: '600' }}>{h.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={tapLight} style={{ alignItems: 'center', marginRight: 16 }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={26} color={C.faint} />
            </View>
            <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 5 }}>New</Text>
          </Pressable>
        </ScrollView>

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
            {MY_MOMENTS.filter((m) => m.text).map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Image source={{ uri: ME.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{ME.name}</Text>
                    <Text style={{ color: C.faint, fontSize: 12.5, marginLeft: 6 }}>{ME.handle}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: 15, lineHeight: 22, marginTop: 4 }}>{item.text}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color={C.gold} />
                    <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginLeft: 4, marginRight: 18 }}>{item.vibes}</Text>
                    <MaterialCommunityIcons name="script-text-outline" size={14} color={C.dim} />
                    <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>{Math.round(item.vibes / 6)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: GAP }}>
            {(tab === 'reels' ? MY_MOMENTS.filter((m) => m.kind === 'reel') : MY_MOMENTS).map((item, i) => (
              <Pressable
                key={item.id}
                onPress={tapSelection}
                style={{ marginRight: (i % COL === COL - 1) ? 0 : GAP, marginBottom: GAP, borderRadius: 4, overflow: 'hidden' }}
              >
                <GridCell item={item} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
        <SettingsScreen onClose={() => setSettings(false)} />
      </Modal>

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
            <MenuRow icon="create-outline" label="Edit your space" sub="Name, bio, vibe & links" />
          </Pressable>
        </Pressable>
      ) : null}

      {/* Ads Manager — boost, track, spend. Meta-style but honest & simple */}
      {adsOpen ? (
        <Pressable onPress={() => setAdsOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Ads Manager 📣</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>Put your moments in front of the right crowd</Text>

            {/* active campaign */}
            <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginRight: 9 }}>🌇</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>Rooftop reel · boost</Text>
                  <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>E£150 spent · 8.2K reach · Cairo 18–30</Text>
                </View>
                <View style={{ backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: C.green, fontSize: 10.5, fontWeight: '900' }}>ACTIVE</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {[{ n: '11.6K', l: 'Reach' }, { n: 'E£210', l: 'Spend' }, { n: '3.1%', l: 'Star rate' }].map((s) => (
                <View key={s.l} style={{ flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 11, marginRight: s.l !== 'Star rate' ? 8 : 0, alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{s.n}</Text>
                  <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 2 }}>{s.l}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => { tapSelection(); setBoosted(true); }}>
              <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 }}>
                  {boosted ? 'Boost submitted — under review ✓' : '✦ Boost a moment'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
              Every ad is reviewed and always labeled “Sponsored” — no sneaky ads on Moments.
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
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>{category} · last 7 days</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {[
                { n: '12.4K', l: 'Reach', d: '+18%' },
                { n: '842', l: 'Stars', d: '+31%' },
                { n: '96', l: 'New mates', d: '+9%' },
              ].map((s) => (
                <View key={s.l} style={{ flex: 1, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, marginRight: s.l !== 'New mates' ? 8 : 0 }}>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{s.n}</Text>
                  <Text style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{s.l}</Text>
                  <Text style={{ color: C.green, fontSize: 11, fontWeight: '800', marginTop: 4 }}>▲ {s.d}</Text>
                </View>
              ))}
            </View>
            <View style={{ backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 16, padding: 13 }}>
              <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800' }}>✦ Your text posts get 2.3× more stars than photos — keep writing.</Text>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
};
