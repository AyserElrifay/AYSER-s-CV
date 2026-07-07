import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../constants/theme';
import { ME, RIDES } from '../constants/mockData';
import { kmBetween } from '../utils/geo';
import { usePulse } from '../hooks/usePulse';
import { Glass } from './Glass';
import { Micro } from './Micro';
import { Chip } from './Chip';
import { SectionHeader } from './SectionHeader';
import { NeonButton } from './NeonButton';
import { GhostButton } from './GhostButton';
import { RouteMap } from './RouteMap';

/* ──────────────── THE MAGIC FLOW · JOIN THE VIBE ─────────────────────
   Tap → route plots to the moment → YalaGo ride mock → squad created. */

export const MagicFlowModal = ({ post, onClose, onComplete }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('route');
  const [ride, setRide] = useState(RIDES[0]);
  const pulse = usePulse(1200);

  useEffect(() => {
    setStep('route');
    setRide(RIDES[0]);
  }, [post]);

  if (!post) return null;

  const km = kmBetween(ME.coords, post.coords);
  const mins = Math.max(6, Math.round(km * 1.7));
  const etaLabel = mins > 90 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' min';
  const roadTrip = km > 100;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={19} color={C.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Micro color={C.purple}>Magic Flow ✨</Micro>
            <Text style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{post.place}</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* 3D route map */}
        <View style={{ height: 300, marginHorizontal: 16, borderRadius: R, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <RouteMap post={post} />
          <Chip
            label={roadTrip ? '🛰 3D ROUTE · ROAD-TRIP MODE' : '🛰 3D ROUTE LOCKED'}
            tint="rgba(255,255,255,0.94)"
            color={C.green}
            style={{ position: 'absolute', top: 12, left: 12 }}
          />
        </View>

        {/* Step sheet */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {step === 'route' ? (
            <View>
              <Glass style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Micro>Estimated arrival</Micro>
                  <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', marginTop: 4 }}>{etaLabel}</Text>
                  <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>
                    {km.toFixed(1)} km · {roadTrip ? 'worth every kilometre' : 'light traffic'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Chip label={'⚡ ' + post.vibes + ' joining'} color={C.green} tint={C.greenSoft} style={{ borderColor: 'rgba(16,185,129,0.4)' }} />
                  <Chip label={post.startsIn} style={{ marginTop: 8 }} />
                </View>
              </Glass>
              <NeonButton label="GET ME THERE →" style={{ marginTop: 16 }} onPress={() => setStep('ride')} />
              <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                Route plotted from your live pin · shared with no one until you confirm
              </Text>
            </View>
          ) : null}

          {step === 'ride' ? (
            <View>
              <SectionHeader title="Ride with YalaGo · mock" />
              {RIDES.map((r) => {
                const sel = ride.id === r.id;
                return (
                  <Pressable key={r.id} onPress={() => setRide(r)}>
                    <Glass
                      tint={sel ? C.greenSoft : C.glass}
                      border={sel ? 'rgba(16,185,129,0.55)' : C.line}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{r.name}</Text>
                        <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{r.sub}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{r.price}</Text>
                        <Text style={{ color: sel ? C.green : C.dim, fontSize: 11, marginTop: 2, fontWeight: '700' }}>{r.eta} away</Text>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
              <NeonButton
                label={'CONFIRM ' + ride.name.toUpperCase() + ' · ' + ride.price}
                style={{ marginTop: 6 }}
                onPress={() => setStep('done')}
              />
            </View>
          ) : null}

          {step === 'done' ? (
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  style={{
                    position: 'absolute', width: 92, height: 92, borderRadius: 46,
                    backgroundColor: C.green,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.35] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
                  }}
                />
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={36} color={C.ink} />
                </View>
              </View>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginTop: 14 }}>You&apos;re in 🎉</Text>
              <Text style={{ color: C.dim, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                {ride.name} is on the way · pickup in {ride.eta}
              </Text>
              <Glass tint={C.blueSoft} border="rgba(59,130,246,0.4)" style={{ padding: 14, marginTop: 20, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>🏕️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{post.squad}</Text>
                  <Text style={{ color: C.blue, fontSize: 12, marginTop: 2 }}>
                    Roam Mates squad created · chat is live in 💬
                  </Text>
                </View>
              </Glass>
              <NeonButton label="OPEN SQUAD CHAT" style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={() => onComplete(post.id)} />
              <GhostButton small label="Done" style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={() => onComplete(post.id)} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
