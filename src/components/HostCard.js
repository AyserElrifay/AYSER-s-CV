import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { fetchHostStats } from '../services/hosts';
import { SUPABASE_READY } from '../lib/supabase';

/* ─── THE GUIDE'S PAGE: WHY YOU CAN TRUST THEM ────────────────────────
   Ayser: "خلي التور جايدز موثقين ليهم صفحة مميزة وفيها عدد الساعات اللي
   اشتغلها أو الرحلات". Shown under the pass only when the Moments team
   has checked the licence card (or, for a host, the ID) by eye. Every
   number is counted by the server from plans they really led where
   somebody really checked in (host_stats in RUN_ME.sql) — a number
   that is still 0 is simply not shown, never padded. */

const Stat = ({ n, label }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{n}</Text>
    <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>{label}</Text>
  </View>
);

export const HostBadge = ({ role, small }) => {
  const { t } = useLang();
  if (role !== 'guide' && role !== 'host') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, backgroundColor: C.purpleSoft, paddingHorizontal: small ? 7 : 10, paddingVertical: small ? 2 : 4 }}>
      <Text style={{ color: C.purple, fontSize: small ? 10.5 : 12, fontWeight: '900' }}>{(role === 'guide' ? '🪪 ' : '✓ ') + t(role === 'guide' ? 'hb_guide' : 'hb_host')}</Text>
    </View>
  );
};

export const HostCard = ({ profile }) => {
  const { t } = useLang();
  const role = profile && profile.host_role;
  const id = profile && profile.id;
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    if (SUPABASE_READY && id && role) fetchHostStats(id).then((s) => { if (alive) setStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, [id, role]);
  if (role !== 'guide' && role !== 'host') return null;

  const nums = [
    stats && stats.led > 0 ? { n: stats.led, label: t('hc_led') } : null,
    stats && stats.people > 0 ? { n: stats.people, label: t('hc_people') } : null,
    stats && stats.hours > 0 ? { n: stats.hours, label: t('hc_hours') } : null,
  ].filter(Boolean);
  const year = new Date().getFullYear();
  const years = profile.guide_since && profile.guide_since <= year ? year - profile.guide_since : null;
  const langs = (profile.guide_langs || []).join(' · ');
  const areas = (profile.guide_areas || []).join(' · ');

  return (
    <View style={{ marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
      <HostBadge role={role} />
      <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>{t(role === 'guide' ? 'hc_checked_guide' : 'hc_checked_host')}</Text>
      {nums.length ? (
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          {nums.map((s) => <Stat key={s.label} n={s.n} label={s.label} />)}
        </View>
      ) : null}
      {years != null && years > 0 ? <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', marginTop: 12 }}>{t('hc_years').replace('{n}', String(years))}</Text> : null}
      {role === 'guide' && langs ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 8 }}>🗣 {langs}</Text> : null}
      {areas ? <Text style={{ color: C.text, fontSize: 13.5, marginTop: 6 }}>📍 {areas}</Text> : null}
      {profile.guide_about ? <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginTop: 10 }}>{profile.guide_about}</Text> : null}
    </View>
  );
};
