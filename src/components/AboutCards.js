import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { flagOf } from '../constants/countries';

/* ─── WHO THIS PERSON IS, AT A GLANCE ─────────────────────────────────
   Learned from the travel apps: a profile should say who somebody is in
   three seconds — where they have been, what they speak, what they love
   — before any numbers. Quiet: white cards, one weight of type, no
   colour except the flags. Everything here is what the person wrote
   about themselves; an empty section is simply not shown. */

const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const Chip = ({ children }) => (
  <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8, marginBottom: 8 }}>
    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{children}</Text>
  </View>
);

export const AboutCards = ({ profile }) => {
  const { t } = useLang();
  if (!profile) return null;
  const visited = Array.isArray(profile.visited_countries) ? profile.visited_countries.filter((c) => /^[A-Z]{2}$/i.test(c)) : [];
  const langs = split(profile.speaks_language);
  const hobbies = split(profile.hobbies);
  if (!visited.length && !langs.length && !hobbies.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      {visited.length ? (
        <View style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 18, marginBottom: 18 }}>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>{visited.length}</Text>
          <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 2 }}>{visited.length === 1 ? t('pm_country_one') : t('pm_countries')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {visited.slice(0, 24).map((c, i) => (
              <View key={c + i} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.glassHi, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', marginEnd: -6, marginBottom: 4 }}>
                <Text style={{ fontSize: 19 }}>{flagOf(c)}</Text>
              </View>
            ))}
            {visited.length > 24 ? <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700', marginStart: 14, alignSelf: 'center' }}>+{visited.length - 24}</Text> : null}
          </View>
        </View>
      ) : null}
      {langs.length ? (
        <>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 10 }}>{t('pm_languages')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>{langs.map((l) => <Chip key={l}>{l}</Chip>)}</View>
        </>
      ) : null}
      {hobbies.length ? (
        <>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 10 }}>{t('pm_interests')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{hobbies.map((h) => <Chip key={h}>{h}</Chip>)}</View>
        </>
      ) : null}
    </View>
  );
};
