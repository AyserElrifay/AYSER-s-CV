import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { ME, MAP_PEOPLE, CAMPFIRES, BOOKINGS, DOING_OPTIONS } from '../constants/mockData';
import { MapView, Marker, MAPS_READY } from '../utils/maps';
import { kmBetween } from '../utils/geo';
import {
  Glass, Micro, Chip, NeonButton, GhostButton, FauxMap,
  PersonPin, CampfirePin, MePin, SOSButton, ProfileModal,
} from '../components';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* ─────────────────── TAB 2 · MAP — THE LIVING WORLD ────────────────── */

export const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const [profileUser, setProfileUser] = useState(null);
  const [sos, setSos] = useState(null); // null | 'ask' | 'sent'
  const [nearby, setNearby] = useState(false);   // nearby-people sheet
  const [rail, setRail] = useState('fires');     // 'fires' | 'book'
  const [booked, setBooked] = useState({});
  const [myDoing, setMyDoing] = useState(null);  // your activity badge
  const [doingOpen, setDoingOpen] = useState(false);
  const [waved, setWaved] = useState({});
  const [partnerOpen, setPartnerOpen] = useState(false); // business partner form
  const [partnerSent, setPartnerSent] = useState(false);

  const nearbyPeople = [...MAP_PEOPLE]
    .map((p) => ({ ...p, km: kmBetween(ME.coords, p.coords) }))
    .sort((a, b) => a.km - b.km);

  const overlays = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
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
          label="🟢 5 friends vibing nearby · 2 live campfires"
          tint="rgba(255,255,255,0.94)"
          color={C.dim}
          style={{ alignSelf: 'flex-start', marginTop: 10 }}
        />
      </View>

      {/* right-side actions: your activity · nearby people · SOS */}
      <View style={{ position: 'absolute', right: 14, bottom: 168, alignItems: 'center' }}>
        <Pressable onPress={() => { tapLight(); setDoingOpen(true); }} style={{ marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: myDoing ? C.purple : C.line, alignItems: 'center', justifyContent: 'center' }}>
            {myDoing ? <Text style={{ fontSize: 21 }}>{myDoing}</Text> : <Ionicons name="happy-outline" size={21} color={C.purple} />}
          </View>
        </Pressable>
        <Pressable onPress={() => { tapLight(); setNearby(true); }} style={{ marginBottom: 12 }}>
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
          ].map((o) => (
            <Pressable key={o.k} onPress={() => { tapSelection(); setRail(o.k); }}>
              <View style={{ backgroundColor: rail === o.k ? C.purple : 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: rail === o.k ? C.purple : C.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 }}>
                <Text style={{ color: rail === o.k ? '#FFF' : C.dim, fontSize: 12, fontWeight: '800' }}>{o.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {rail === 'fires' ? CAMPFIRES.map((c) => (
            <Glass key={c.id} tint="rgba(255,255,255,0.96)" style={{ width: 252, padding: 13, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>🔥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ color: C.dim, fontSize: 11, marginTop: 1 }}>
                    {c.host.name.split(' ')[0]} hosting · 🎧 {c.listeners} inside
                  </Text>
                </View>
              </View>
              <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 8, fontStyle: 'italic' }} numberOfLines={1}>
                “{c.topic}”
              </Text>
              <NeonButton small label="SLIP INTO THE CIRCLE" style={{ marginTop: 10 }} onPress={() => {}} />
            </Glass>
          )) : BOOKINGS.map((b) => (
            <Glass key={b.id} tint="rgba(255,255,255,0.96)" style={{ width: 232, padding: 13, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, marginRight: 9 }}>{b.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{b.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>{b.sub}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '900', flex: 1 }}>{b.price}</Text>
                {booked[b.id] ? (
                  <View style={{ backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 }}>
                    <Text style={{ color: C.green, fontSize: 11.5, fontWeight: '900' }}>Booked ✓</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => { tapSuccess(); sfxSuccess(); setBooked((x) => ({ ...x, [b.id]: true })); }}>
                    <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 6 }}>
                      <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>Book</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </Glass>
          ))}
          {rail === 'book' ? (
            <Pressable onPress={() => { tapLight(); setPartnerOpen(true); }}>
              <Glass tint="rgba(124,58,237,0.08)" border="rgba(124,58,237,0.35)" style={{ width: 200, padding: 13, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>🤝</Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>Own a place?</Text>
                <Text style={{ color: C.dim, fontSize: 10.5, marginTop: 3, textAlign: 'center' }}>Get on the Moments map — people book you from here</Text>
                <View style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 9 }}>
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>Partner with us</Text>
                </View>
              </Glass>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {MAPS_READY ? (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: 30.048, longitude: 31.2315, latitudeDelta: 0.042, longitudeDelta: 0.03 }}
          userInterfaceStyle="light"
        >
          <Marker coordinate={ME.coords}>
            <MePin doing={myDoing} />
          </Marker>
          {MAP_PEOPLE.map((p) => (
            <Marker key={p.id} coordinate={p.coords} onPress={() => setProfileUser(p)}>
              <PersonPin p={p} onPress={() => setProfileUser(p)} />
            </Marker>
          ))}
          {CAMPFIRES.map((c) => (
            <Marker key={c.id} coordinate={c.coords}>
              <CampfirePin c={c} />
            </Marker>
          ))}
        </MapView>
      ) : (
        <FauxMap>
          <View style={{ position: 'absolute', left: '38%', top: '50%' }}>
            <MePin doing={myDoing} />
          </View>
          {MAP_PEOPLE.map((p) => (
            <View key={p.id} style={{ position: 'absolute', left: p.fx, top: p.fy }}>
              <PersonPin p={p} onPress={() => setProfileUser(p)} />
            </View>
          ))}
          {CAMPFIRES.map((c) => (
            <View key={c.id} style={{ position: 'absolute', left: c.fx, top: c.fy }}>
              <CampfirePin c={c} />
            </View>
          ))}
        </FauxMap>
      )}

      {overlays}

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
                    Your live location will be shared with your 3 closest Roam Mates, and your squad chats get pinged instantly.
                  </Text>
                  <NeonButton color={C.coral} label="SEND SOS NOW" style={{ marginTop: 18 }} onPress={() => setSos('sent')} />
                  <GhostButton small label="Cancel" style={{ marginTop: 10 }} onPress={() => setSos(null)} />
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 34, textAlign: 'center' }}>📍</Text>
                  <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Squad pinged</Text>
                  <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                    Nour, Omar and Malak can now see your live pin. Stay where you are — help is moving.
                  </Text>
                  <GhostButton small label="Close" style={{ marginTop: 18 }} onPress={() => setSos(null)} />
                </View>
              )}
            </Glass>
          </View>
        </Modal>
      ) : null}

      {/* nearby people — who's around you right now */}
      {nearby ? (
        <Pressable onPress={() => setNearby(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16, maxHeight: '70%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Nearby people 📍</Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 10 }}>Mates & explorers around you right now</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {nearbyPeople.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Pressable onPress={() => { setNearby(false); setProfileUser(p); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View>
                      <Image source={{ uri: p.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                      <View style={{ position: 'absolute', bottom: -2, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 10 }}>{p.doing}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{p.name}</Text>
                      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{p.intent} · {p.km.toFixed(1)} km away</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => { tapLight(); sfxPop(); setWaved((w) => ({ ...w, [p.id]: true })); }}>
                    <View style={{ backgroundColor: waved[p.id] ? C.greenSoft : C.purpleSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: waved[p.id] ? C.green : C.purple, fontSize: 12, fontWeight: '900' }}>{waved[p.id] ? 'Waved ✓' : 'Wave 👋'}</Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}

      {/* pick the activity you appear with on the map */}
      {doingOpen ? (
        <Pressable onPress={() => setDoingOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>What are you up to? </Text>
            <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>This shows on your pin so the right people find you</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {DOING_OPTIONS.map((e) => {
                const on = myDoing === e;
                return (
                  <Pressable key={e} onPress={() => { tapSelection(); sfxPop(); setMyDoing(on ? null : e); setDoingOpen(false); }}>
                    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 26 }}>{e}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {myDoing ? (
              <Pressable onPress={() => { tapLight(); setMyDoing(null); setDoingOpen(false); }}>
                <Text style={{ color: C.coral, fontSize: 13, fontWeight: '800', marginTop: 6 }}>Go invisible (hide my activity)</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      ) : null}

      {/* partner program — restaurants, cafés & venues join the map */}
      {partnerOpen ? (
        <Pressable onPress={() => setPartnerOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
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
                <Pressable onPress={() => { tapSuccess(); sfxSuccess(); setPartnerSent(true); }} style={{ marginTop: 14 }}>
                  <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Apply — takes 2 minutes</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      ) : null}

      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
    </View>
  );
};
