import React from 'react';
import { View, Text, Pressable, ScrollView, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { flightSearches, staySearches, carSearches, defaultDates } from '../services/flights';
import { tapLight } from '../utils/feedback';

/* ─── GETTING THERE, AND STAYING ─────────────────────────────────────
   Tap a city and this is how you actually reach it: the real searches
   on the real sites, with the route and the dates already filled in.

   ── THE THING THIS SHEET REFUSES TO DO ───────────────────────────
   Show a price.

   Every instinct says to put "from €89" on these rows — it would look
   so much better. It would also be a lie, because we do not have a
   live fare feed and the only way to produce that number would be to
   guess it or to let a language model write one. A traveller who books
   around a number we invented is a traveller we have actively harmed,
   and this is a product people plan real journeys with.

   So the rows say what each site is GOOD AT, which we do know and
   which is genuinely useful, and the price appears one tap later on a
   page that is accountable for it.

   ── AND WHY THREE, NOT ONE ───────────────────────────────────────
   No site is cheapest twice running. Showing one and calling it "the
   cheapest" is a claim we cannot support; showing three and saying
   what each is best at is a claim we can. The traveller who checks and
   finds we were straight with them is the one who comes back.        */

const openUrl = (url) => {
  tapLight();
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
    }
  } catch (e) { /* a link that will not open is not worth a crash */ }
};

const Group = ({ title, hint, rows }) => {
  if (!rows || !rows.length) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 }}>
        {title}
      </Text>
      {hint ? <Text style={{ color: C.faint, fontSize: 11.5, marginBottom: 8 }}>{hint}</Text> : null}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => openUrl(r.url)}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
            borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 8,
          }}>
            <Text style={{ fontSize: 20, marginRight: 11 }}>{r.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{r.name}</Text>
              <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{r.note}</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={C.faint} />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

export const TravelSheet = ({ city, fromCity, onClose }) => {
  const insets = useSafeAreaInsets();
  const dates = defaultDates();
  const flights = flightSearches({ fromCity, toCity: city });
  const stays = staySearches({ city });
  const cars = carSearches({ city });

  return (
    <Pressable
      onPress={onClose}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, maxHeight: '86%',
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>Getting to {city}</Text>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 16 }}>
            Live searches, already filled in for {dates.out} → {dates.back}. Change the dates on the site.
          </Text>

          <Group
            title="FLIGHTS"
            hint={fromCity ? 'From ' + fromCity : 'Add where you are flying from on the site'}
            rows={flights}
          />
          <Group title="SOMEWHERE TO SLEEP" rows={stays} />
          <Group title="A CAR" rows={cars} />

          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: C.dim, fontSize: 11.5, lineHeight: 17 }}>
              We do not show prices here on purpose — we have no live fare feed, and a made-up
              price is worse than none. Every link opens the real search, so what you see is what
              you can actually book.
            </Text>
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
