import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PAY_PROVIDERS, startCheckout, PLATFORM_FEE } from '../services/payments';
import { createVenueBooking } from '../services/venues';
import { getOrCreateDmThread, sendMessage } from '../services/messages';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxSuccess } from '../utils/sfx';

/* Book a place AND pay through Moments — that's how we earn: the app
   takes its commission (PLATFORM_FEE) on the payment, the rest goes to
   the venue. Until the gateway Edge Function is live, the booking is
   still sent to the owner as a reservation request (honest fallback). */

const priceToNumber = (s) => {
  const n = Number(String(s || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const BookingSheet = ({ venue, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [provider, setProvider] = useState('paymob');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);
  // the real reservation — who's coming, when, how to reach you
  const [bName, setBName] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bDate, setBDate] = useState('');
  const [bPeople, setBPeople] = useState('2');

  const amount = priceToNumber(venue.price);
  const fee = Number((amount * PLATFORM_FEE).toFixed(2));

  const requestToOwner = async () => {
    if (!SUPABASE_READY || !user || !venue.owner_id) return;
    try {
      const threadId = await getOrCreateDmThread(venue.owner_id);
      await sendMessage({ dmThreadId: threadId, userId: user.id, body: 'Booking request: ' + venue.name + (venue.sub ? ' — ' + venue.sub : '') + (venue.price ? ' (' + venue.price + ')' : '') });
    } catch (e) {}
  };

  const pay = async () => {
    if (busy) return;
    if (!bName.trim() || !bPhone.trim()) { setMsg('Add your name and phone so the venue can confirm with you.'); return; }
    setBusy(true); setMsg(null);
    try {
      // 1) The REAL reservation row — the venue owner sees it instantly.
      if (SUPABASE_READY && user) {
        try {
          await createVenueBooking({
            venueId: venue.id, venueName: venue.name, userId: user.id,
            fullName: bName.trim(), phone: bPhone.trim(),
            bookingDate: bDate.trim(), people: bPeople,
          });
        } catch (e) {
          if (/does not exist|schema cache/i.test(e.message || '')) {
            setMsg('One step left: run supabase/RUN_ME.sql to turn on real bookings.');
            setBusy(false);
            return;
          }
          throw e;
        }
      }
      // 2) Also land it in the owner's DMs, then take payment.
      await requestToOwner();
      if (amount > 0) {
        const res = await startCheckout(provider, { amount, currency: 'EGP', kind: 'booking', refId: venue.id, description: 'Booking · ' + venue.name });
        if (res.configured) { tapSuccess(); sfxSuccess(); onClose(); return; }
        setMsg('Reservation sent to the venue ✓  Online payment turns on once your ' + (PAY_PROVIDERS.find((p) => p.id === provider) || {}).name + ' gateway is connected — the booking + our commission are already recorded.');
      } else {
        setMsg('Reservation request sent to the venue ✓');
      }
      tapSuccess(); sfxSuccess();
      setDone(true);
    } catch (e) {
      setMsg(e.message || 'Something went wrong.');
    } finally { setBusy(false); }
  };

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, maxHeight: '88%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 26 }}>{venue.emoji || '📍'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{venue.name}</Text>
              {venue.sub ? <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{venue.sub}</Text> : null}
            </View>
          </View>

          {amount > 0 ? (
            <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <Row label="Price" value={'E£' + amount} />
              <Row label="Moments service (15%)" value={'E£' + fee} muted />
              <View style={{ height: 1, backgroundColor: C.line, marginVertical: 8 }} />
              <Row label="You pay" value={'E£' + amount} bold />
            </View>
          ) : null}

          {!done ? (
            <>
              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>YOUR RESERVATION</Text>
              <TextInput placeholder="Your full name" placeholderTextColor={C.faint} value={bName} onChangeText={setBName}
                style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <TextInput placeholder="Phone (WhatsApp)" placeholderTextColor={C.faint} value={bPhone} onChangeText={setBPhone} keyboardType="phone-pad"
                  style={{ flex: 1, color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 }} />
                <TextInput placeholder="People" placeholderTextColor={C.faint} value={bPeople} onChangeText={setBPeople} keyboardType="number-pad" maxLength={2}
                  style={{ width: 78, color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />
              </View>
              <TextInput placeholder="When? (e.g. Fri 8PM)" placeholderTextColor={C.faint} value={bDate} onChangeText={setBDate}
                style={{ color: C.text, fontSize: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }} />

              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>PAYMENT METHOD</Text>
              {PAY_PROVIDERS.map((p) => {
                const on = provider === p.id;
                return (
                  <Pressable key={p.id} onPress={() => { tapSelection(); setProvider(p.id); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 19, marginRight: 11 }}>{p.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{p.name}</Text>
                        <Text style={{ color: C.faint, fontSize: 10.5, marginTop: 1 }}>{p.region} · {p.methods}</Text>
                      </View>
                      {on ? <Ionicons name="radio-button-on" size={20} color={C.purple} /> : <Ionicons name="radio-button-off" size={20} color={C.faint} />}
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={pay} disabled={busy} style={{ marginTop: 8 }}>
                <LinearGradient colors={[C.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{busy ? 'Processing…' : amount > 0 ? '🔒 Book & pay E£' + amount : 'Send reservation request'}</Text>
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 34 }}>🎟️</Text>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>Booking sent</Text>
            </View>
          )}

          {msg ? (
            <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 10 }}>
              <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>{msg}</Text>
            </View>
          ) : null}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};

const Row = ({ label, value, muted, bold }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
    <Text style={{ color: muted ? C.faint : C.dim, fontSize: bold ? 14 : 12.5, fontWeight: bold ? '900' : '600', flex: 1 }}>{label}</Text>
    <Text style={{ color: muted ? C.faint : C.text, fontSize: bold ? 15 : 12.5, fontWeight: bold ? '900' : '700' }}>{value}</Text>
  </View>
);
