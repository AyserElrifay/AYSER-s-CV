import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { ME, MAP_PEOPLE, CAMPFIRES } from '../constants/mockData';
import { MapView, Marker, MAPS_READY } from '../utils/maps';
import {
  Glass, Micro, Chip, NeonButton, GhostButton, FauxMap,
  PersonPin, CampfirePin, MePin, SOSButton, ProfileModal,
} from '../components';

/* ─────────────────── TAB 2 · MAP — THE LIVING WORLD ────────────────── */

export const MapScreen = () => {
  const insets = useSafeAreaInsets();
  const [profileUser, setProfileUser] = useState(null);
  const [sos, setSos] = useState(null); // null | 'ask' | 'sent'

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

      {/* SOS */}
      <View style={{ position: 'absolute', right: 14, bottom: 168 }}>
        <SOSButton onPress={() => setSos('ask')} />
      </View>

      {/* live campfires rail */}
      <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }}>
        <Micro style={{ marginLeft: 16, marginBottom: 8 }} color={C.coral}>Live Campfires 🏕️</Micro>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {CAMPFIRES.map((c) => (
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
          ))}
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
            <MePin />
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
            <MePin />
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

      {profileUser ? <ProfileModal user={profileUser} onClose={() => setProfileUser(null)} /> : null}
    </View>
  );
};
