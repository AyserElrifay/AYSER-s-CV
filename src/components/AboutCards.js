import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { flagOf } from '../constants/countries';
import { levelOf } from '../lib/xp';

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

/* the score: big, first, and earned — only by turning up (lib/xp.js) */
const XpCard = ({ xp, events, own, t }) => {
  const lv = levelOf(xp);
  return (
    <View style={{ backgroundColor: C.text, borderRadius: 22, padding: 18, marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={{ color: C.bg, fontSize: 40, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{lv.xp.toLocaleString()}</Text>
        <Text style={{ color: C.bg, opacity: 0.7, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginStart: 8, marginBottom: 8 }}>XP</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: C.bg, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>{'🌿 ' + t('xp_lvl_' + lv.key)}</Text>
      </View>
      <Text style={{ color: C.bg, opacity: 0.75, fontSize: 13.5, marginTop: 2 }}>
        {events > 0 ? t('xp_from').replace('{n}', String(events)) : own ? t('xp_how') : t('xp_label')}
      </Text>
      {lv.next ? (
        <>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.35)', marginTop: 14, overflow: 'hidden' }}>
            <View style={{ width: Math.round(lv.progress * 100) + '%', height: 6, borderRadius: 3, backgroundColor: '#34D399' }} />
          </View>
          <Text style={{ color: C.bg, opacity: 0.6, fontSize: 12, marginTop: 6 }}>{t('xp_to_next').replace('{n}', String(lv.toNext)).replace('{level}', t('xp_lvl_' + lv.next))}</Text>
        </>
      ) : null}
    </View>
  );
};

export const AboutCards = ({ profile, own }) => {
  const { t } = useLang();
  if (!profile) return null;
  const xp = Number(profile.community_xp) || 0;
  const events = Number(profile.community_events) || 0;
  const showXp = xp > 0 || own;
  const visited = Array.isArray(profile.visited_countries) ? profile.visited_countries.filter((c) => /^[A-Z]{2}$/i.test(c)) : [];
  const langs = split(profile.speaks_language);
  const hobbies = split(profile.hobbies);
  if (!showXp && !visited.length && !langs.length && !hobbies.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      {showXp ? <XpCard xp={xp} events={events} own={own} t={t} /> : null}
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
