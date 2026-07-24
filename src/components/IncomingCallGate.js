import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { subscribeIncomingCalls, joinCall } from '../services/calls';
import { CallScreen } from './CallScreen';
import { tapMedium, tapSuccess } from '../utils/feedback';
import { startRingtone } from '../utils/sfx';

/* Mounted once at the app root: listens on YOUR ring channel, so a call
   from anyone actually rings on your screen wherever you are in the app.
   Accept → a real WebRTC CallScreen opens in callee mode. */
export const IncomingCallGate = () => {
  const { user } = useAuth();
  const [ring, setRing] = useState(null);      // { callId, from, video }
  const [active, setActive] = useState(null);  // accepted call
  const ringingRef = useRef(null);

  useEffect(() => {
    if (!SUPABASE_READY || Platform.OS !== 'web' || !user) return;
    const unsub = subscribeIncomingCalls(user.id, (ev) => {
      if (ev.type === 'ring') {
        ringingRef.current = ev.callId;
        setRing({ callId: ev.callId, from: ev.from || {}, video: !!ev.video });
      } else if (ev.type === 'cancel') {
        if (ringingRef.current === ev.callId) { ringingRef.current = null; setRing(null); }
      }
    });
    return unsub;
  }, [user]);

  /* It has to actually RING: sound + a repeating buzz for as long as
     the call is up, and the tab title flashes so a backgrounded phone
     still shows something is happening. All of it stops the moment the
     call is answered, declined or cancelled. */
  useEffect(() => {
    if (!ring) return undefined;
    const stopTone = startRingtone();
    const buzz = () => {
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([420, 260, 420]); } catch (e) {}
      tapMedium();
    };
    buzz();
    const buzzIv = setInterval(buzz, 2400);

    let titleIv = null, prevTitle = null;
    try {
      if (typeof document !== 'undefined') {
        prevTitle = document.title;
        const who = (ring.from && ring.from.name) || 'Someone';
        let on = false;
        titleIv = setInterval(() => { on = !on; document.title = on ? '📞 ' + who + ' is calling…' : 'Moments'; }, 900);
      }
    } catch (e) {}

    return () => {
      stopTone();
      clearInterval(buzzIv);
      if (titleIv) clearInterval(titleIv);
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0); } catch (e) {}
      try { if (prevTitle != null && typeof document !== 'undefined') document.title = prevTitle; } catch (e) {}
    };
  }, [ring]);

  if (!ring && !active) return null;

  const decline = () => {
    if (!ring) return;
    // tell the caller we declined, then dismiss
    const ch = joinCall(ring.callId, {});
    setTimeout(() => { ch.send('decline', {}); setTimeout(ch.leave, 800); }, 400);
    setRing(null);
  };

  const accept = () => {
    tapSuccess();
    setActive(ring);
    setRing(null);
  };

  return (
    <>
      {ring ? (
        <Modal visible transparent animationType="fade" onRequestClose={decline}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,4,15,0.94)', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
            <Image source={{ uri: (ring.from && ring.from.avatar) || AV_NEUTRAL }} style={{ width: 116, height: 116, borderRadius: 58, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }} />
            <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 18 }}>{(ring.from && ring.from.name) || 'Someone'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14.5, marginTop: 6 }}>
              {ring.video ? 'Incoming video call 🎥' : 'Incoming call 📞'}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 46 }}>
              <Pressable onPress={decline} style={{ alignItems: 'center', marginHorizontal: 26 }}>
                <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>Decline</Text>
              </Pressable>
              <Pressable onPress={accept} style={{ alignItems: 'center', marginHorizontal: 26 }}>
                <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="call" size={28} color="#FFF" />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      {active ? (
        <CallScreen
          incoming
          callId={active.callId}
          video={active.video}
          peer={{ id: (active.from && active.from.id) || '', name: (active.from && active.from.name) || 'Someone', avatar: (active.from && active.from.avatar) || AV_NEUTRAL }}
          onClose={() => setActive(null)}
        />
      ) : null}
    </>
  );
};
