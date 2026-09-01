import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
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

const Group = ({ title, hint, rows, t }) => {
  if (!rows || !rows.length) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      {title ? (
        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 }}>
          {title}
        </Text>
      ) : null}
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
              <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }}>{r.noteKey ? t(r.noteKey) : r.note}</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={C.faint} />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

/* ── HOSTEL, HOTEL, OR SHOW ME BOTH ──────────────────────────────────
   Three plain buttons, not a fashionable segmented control: this sheet
   is read by a nineteen-year-old on a phone and by somebody's mother,
   and the second one should not have to work out what a sliding pill
   means. Whichever is on is filled in; the other two are outlined. */
const Choice = ({ options, value, onChange }) => (
  <View style={{ flexDirection: 'row', marginTop: 2, marginBottom: 4 }}>
    {options.map((o) => {
      const on = o.k === value;
      return (
        <Pressable
          key={o.k}
          onPress={() => { tapLight(); onChange(o.k); }}
          style={{
            paddingVertical: 7, paddingHorizontal: 13, borderRadius: 11, marginEnd: 8,
            backgroundColor: on ? C.text : 'transparent',
            borderWidth: 1, borderColor: on ? C.text : C.line,
          }}>
          <Text style={{ color: on ? C.bg : C.dim, fontSize: 12.5, fontWeight: '800' }}>{o.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const TravelSheet = ({ city, fromCity, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [stayKind, setStayKind] = useState('any');
  const dates = defaultDates();
  const flights = flightSearches({ fromCity, toCity: city });
  const stays = staySearches({ city, kind: stayKind });
  const cars = carSearches({ city });
  const stayHint = stayKind === 'hostels' ? t('stay_hostels_hint')
    : stayKind === 'hotels' ? t('stay_hotels_hint') : null;

  return (
    <Pressable
      onPress={onClose}
      /* zIndex, because this sheet had none: the map's own floating
         controls sit on a layer with zIndex 10, and a layer with a
         number always wins against one without, whatever the order in
         the tree. The locate button and the tools button were being
         drawn on top of these rows — right over the hostel/hotel
         choice. Every other sheet on this screen is 30 or above. */
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 33 }}>
      <Pressable
        onPress={() => {}}
        style={{
          backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 10, paddingBottom: insets.bottom + 22, paddingHorizontal: 16, maxHeight: '86%',
        }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 }} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>
            {t('travel_getting_there').replace('{place}', city)}
          </Text>
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 3, marginBottom: 16 }}>
            {t('travel_dates_filled').replace('{out}', dates.out).replace('{back}', dates.back)}
          </Text>

          <Group
            title={t('travel_flights')}
            hint={fromCity ? t('travel_from_city').replace('{city}', fromCity) : t('travel_add_origin')}
            rows={flights}
            t={t}
          />
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 }}>
            {t('travel_stay')}
          </Text>
          <Choice
            value={stayKind}
            onChange={setStayKind}
            options={[
              { k: 'any', label: t('stay_any') },
              { k: 'hostels', label: t('stay_hostels') },
              { k: 'hotels', label: t('stay_hotels') },
            ]}
          />
          <Group title="" hint={stayHint} rows={stays} t={t} />
          <Group title={t('travel_car')} rows={cars} t={t} />

          <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: C.dim, fontSize: 11.5, lineHeight: 17 }}>{t('travel_no_prices')}</Text>
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
};
