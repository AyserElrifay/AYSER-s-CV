import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { SUPABASE_READY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AD_PRODUCTS, quoteBoost, createBoost } from '../services/ads';
import { PAY_PROVIDERS, startCheckout } from '../services/payments';
import { fetchLiveVenues } from '../services/venues';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { sfxPop, sfxSuccess } from '../utils/sfx';

/* Buy a Paid Boost. Pick a product → the Feedback Factor prices your
   clicks by your rating → set a budget → pick a gateway → pay.
   Everything shows as "Sponsored" once live; low-rated places are
   blocked until they improve. */

export const BoostSheet = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [product, setProduct] = useState('top_search');
  const [budget, setBudget] = useState('500');
  const [provider, setProvider] = useState('paymob');
  const [myVenue, setMyVenue] = useState(null);
  const [step, setStep] = useState(1); // 1 product+budget · 2 pay
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!SUPABASE_READY || !user) return;
    // Use your own venue's rating for the Feedback Factor (if you own one)
    fetchLiveVenues().then((vs) => {
      const mine = (vs || []).find((v) => v.owner_id === user.id);
      if (mine) setMyVenue(mine);
    }).catch(() => {});
  }, [user]);

  const rating = myVenue ? Number(myVenue.rating) : 0;
  const ratingCount = myVenue ? myVenue.rating_count : 0;
  const quote = quoteBoost(product, rating, ratingCount);
  const clicks = quote.cpc ? Math.floor(Number(budget || 0) / quote.cpc) : 0;

  const pay = async () => {
    if (quote.blocked || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      let boostId = null;
      if (SUPABASE_READY && user) {
        const boost = await createBoost({
          venueId: myVenue ? myVenue.id : null, ownerId: user.id,
          product, budget: Number(budget), currency: 'EGP', cpc: quote.cpc, provider,
        });
        boostId = boost.id;
      }
      const res = await startCheckout(provider, { amount: Number(budget), currency: 'EGP', kind: 'boost', refId: boostId, description: 'Moments Boost' });
      if (res.configured) { tapSuccess(); sfxSuccess(); onClose(); }
      else {
        setMsg('Payment recorded as pending. Connect your ' + (PAY_PROVIDERS.find((p) => p.id === provider) || {}).name + ' keys (server-side) to complete the charge.');
      }
    } catch (e) {
      setMsg(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const prod = AD_PRODUCTS.find((p) => p.id === product);

  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, maxHeight: '88%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>Boost 📣</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>Rank first — always shown as “Sponsored”</Text>

              {AD_PRODUCTS.map((p) => {
                const on = product === p.id;
                return (
                  <Pressable key={p.id} onPress={() => { tapSelection(); setProduct(p.id); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, borderRadius: 16, padding: 13, marginBottom: 9 }}>
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{p.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{p.name}</Text>
                        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{p.desc}</Text>
                      </View>
                      {on ? <Ionicons name="checkmark-circle" size={20} color={C.purple} /> : null}
                    </View>
                  </Pressable>
                );
              })}

              {/* Feedback Factor */}
              <View style={{ backgroundColor: quote.blocked ? C.coralSoft : C.greenSoft, borderWidth: 1, borderColor: quote.blocked ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)', borderRadius: 14, padding: 13, marginTop: 4, marginBottom: 14 }}>
                <Text style={{ color: quote.blocked ? C.coral : C.green, fontSize: 12, fontWeight: '900', marginBottom: 3 }}>
                  ⭐ Feedback Factor {myVenue ? '· ' + rating.toFixed(1) + ' (' + ratingCount + ' reviews)' : ''}
                </Text>
                <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>{quote.label}</Text>
                {!quote.blocked ? (
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>
                    E£{quote.cpc} per click{quote.cpc !== quote.baseCpc ? '  (base E£' + quote.baseCpc + ')' : ''}
                  </Text>
                ) : null}
              </View>

              {!quote.blocked ? (
                <>
                  <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>BUDGET (E£)</Text>
                  <TextInput
                    value={budget}
                    onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={{ color: C.text, fontSize: 18, fontWeight: '900', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                  />
                  <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>
                    ≈ {clicks} clicks on “{prod.name}”
                  </Text>
                  <Pressable onPress={() => { tapLight(); sfxPop(); setStep(2); }} style={{ marginTop: 16 }}>
                    <LinearGradient colors={[C.purple, '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>Continue to payment →</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Collect a few good reviews, then come back 🌱</Text>
              )}
            </>
          ) : (
            <>
              <Pressable onPress={() => setStep(1)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="chevron-back" size={20} color={C.dim} />
                <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700' }}>Back</Text>
              </Pressable>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>Pay E£{budget}</Text>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 2, marginBottom: 14 }}>{prod.name} · E£{quote.cpc}/click</Text>

              <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>PAYMENT METHOD</Text>
              {PAY_PROVIDERS.map((p) => {
                const on = provider === p.id;
                return (
                  <Pressable key={p.id} onPress={() => { tapSelection(); setProvider(p.id); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.purpleSoft : C.glass, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, borderRadius: 14, padding: 13, marginBottom: 9 }}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{p.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{p.name}</Text>
                        <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{p.region} · {p.methods}</Text>
                      </View>
                      {on ? <Ionicons name="radio-button-on" size={20} color={C.purple} /> : <Ionicons name="radio-button-off" size={20} color={C.faint} />}
                    </View>
                  </Pressable>
                );
              })}

              {msg ? (
                <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 8 }}>
                  <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>{msg}</Text>
                </View>
              ) : null}

              <Pressable onPress={pay} disabled={busy} style={{ marginTop: 8 }}>
                <LinearGradient colors={[C.green, '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{busy ? 'Processing…' : '🔒 Pay E£' + budget}</Text>
                </LinearGradient>
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 10.5, textAlign: 'center', marginTop: 10 }}>
                Secured by {PAY_PROVIDERS.find((p) => p.id === provider).name} · Moments never sees your card
              </Text>
            </>
          )}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
