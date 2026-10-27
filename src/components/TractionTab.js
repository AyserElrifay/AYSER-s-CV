import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { tractionMetrics } from '../services/traction';
import { tapLight, tapSuccess } from '../utils/feedback';

/* ─── TRACTION & SAAS METRICS (owner only) ────────────────────────────
   Ayser, for the Startup Visa committee and investors: the numbers that
   say Moments is a product people pay for and come back to — not an
   agency. Every figure is counted by the database (RUN_ME.sql,
   traction_metrics); nothing here is estimated or typed in:
     MRR / ARR      Lemon Squeezy memberships only (gifts and founding
                    seats are shown apart, never as revenue)
     conversion     paying members ÷ everybody who signed up
     cohorts        of each month's sign-ups, who was seen again 30+ days later
     offline        passport stamps a month (QR scans and by hand)
     network        hosts, certified hosts, official tables, cities, venues
   "Export CSV" downloads the same numbers as a file for a deck. */

const money = (n, cur) => { try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur || 'EGP', maximumFractionDigits: 0 }).format(n || 0); } catch (e) { return (n || 0) + ' ' + (cur || 'EGP'); } };

const Big = ({ label, value, sub, accent }) => (
  <View style={{ width: '50%', padding: 5 }}>
    <View style={{ borderRadius: 20, padding: 16, backgroundColor: accent ? C.purple : C.glass, borderWidth: accent ? 0 : 1, borderColor: C.line, minHeight: 104 }}>
      <Text style={{ color: accent ? C.sun : C.dim, fontSize: 11.5, fontWeight: '800', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Text style={[{ color: accent ? '#FFF' : C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 6 }, NUM]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={[{ color: accent ? 'rgba(255,255,255,0.8)' : C.dim, fontSize: 12.5, marginTop: 4 }, NUM]}>{sub}</Text> : null}
    </View>
  </View>
);
const Head = ({ children }) => <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 22, marginBottom: 8 }}>{children}</Text>;

/* one row of bars: a month and its number, the longest bar is the biggest month */
const Bars = ({ rows, value, label }) => {
  const max = Math.max(1, ...rows.map(value));
  return rows.map((r) => (
    <View key={r.month} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <Text style={[{ color: C.dim, fontSize: 12.5, width: 64 }, NUM]}>{r.month}</Text>
      <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.glassHi, overflow: 'hidden', marginHorizontal: 8 }}>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: C.purple, width: Math.round((value(r) / max) * 100) + '%' }} />
      </View>
      <Text style={[{ color: C.text, fontSize: 12.5, fontWeight: '700', minWidth: 72, textAlign: 'right' }, NUM]}>{label(r)}</Text>
    </View>
  ));
};

const toCsv = (m) => {
  const L = [];
  const r = m.revenue, g = m.growth, n = m.network;
  L.push('Moments traction,' + m.at);
  L.push('metric,value');
  L.push('MRR (' + m.currency + '),' + r.mrr, 'ARR (' + m.currency + '),' + r.arr, 'Paying Basic,' + r.basic, 'Paying VIP,' + r.vip, 'Comped (not revenue),' + r.comped);
  L.push('Sign-ups,' + g.signups, 'Sign-ups last 30 days,' + g.signups_30d, 'Paying members,' + g.paid, 'Paid conversion %,' + g.conversion_pct);
  L.push('Active hosts (±30 days),' + n.active_hosts_30d, 'Certified hosts,' + n.certified_hosts, 'Official tables (30 days),' + n.official_tables_30d,
    'Cities (30 days),' + n.cities_30d, 'Countries (30 days),' + n.countries_30d, 'Partner venues,' + n.partner_venues);
  L.push('', 'cohort,joined,retained 30d+,retention %,complete');
  (m.cohorts || []).forEach((c) => L.push([c.month, c.joined, c.retained, c.pct, c.complete].join(',')));
  L.push('', 'month,QR check-ins,by hand,people,check-ins per person');
  (m.offline || []).forEach((o) => L.push([o.month, o.qr, o.by_hand, o.people, o.per_person].join(',')));
  return L.join('\n');
};

export const TractionTab = () => {
  const [m, setM] = useState(null);
  const load = () => { setM(null); tractionMetrics().then((x) => setM(x || { ok: false })); };
  useEffect(() => { load(); }, []);
  if (!m) return <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />;
  if (!m.ok) return <Text style={{ color: C.dim, fontSize: 14, marginTop: 30, textAlign: 'center' }}>{m.reason === 'not_owner' ? 'Only the owner sees the numbers.' : 'Could not load the numbers. Run the backend setup, then try again.'}</Text>;
  const r = m.revenue, g = m.growth, n = m.network;
  const exportCsv = () => {
    tapSuccess();
    if (Platform.OS !== 'web') return;
    try {
      const blob = new Blob([toCsv(m)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'moments-traction-' + String(m.at).slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 }}>Traction</Text>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{'Live from the database · ' + new Date(m.at).toLocaleString()}</Text>
        </View>
        <Pressable onPress={() => { tapLight(); load(); }} accessibilityRole="button" accessibilityLabel="Refresh" hitSlop={8} style={{ marginEnd: 10 }}>
          <Ionicons name="refresh" size={20} color={C.dim} />
        </Pressable>
        <Pressable onPress={exportCsv} accessibilityRole="button">
          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
            <Ionicons name="download-outline" size={15} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700', marginStart: 6 }}>Export CSV</Text>
          </View>
        </Pressable>
      </View>

      <Head>Revenue</Head>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
        <Big accent label="MRR" value={money(r.mrr, m.currency)} sub={'ARR ' + money(r.arr, m.currency)} />
        <Big label="Paid conversion" value={g.conversion_pct + '%'} sub={g.paid + ' paying of ' + g.signups} />
        <Big label="Basic" value={String(r.basic)} sub={money(r.basic_price, m.currency) + ' / month'} />
        <Big label="VIP" value={String(r.vip)} sub={money(r.vip_price, m.currency) + ' / ' + (r.vip_period === 'year' ? 'year' : 'month')} />
      </View>
      {r.comped ? <Text style={[{ color: C.dim, fontSize: 12.5, marginTop: 6 }, NUM]}>{r.comped + ' comped members (gifts, founding seats) — not counted as revenue.'}</Text> : null}

      <Head>Growth</Head>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
        <Big label="Sign-ups" value={String(g.signups)} sub={'+' + g.signups_30d + ' in 30 days'} />
        <Big label="Cities · 30 days" value={String(n.cities_30d)} sub={n.countries_30d + ' countries'} />
        <Big label="Active hosts" value={String(n.active_hosts_30d)} sub={n.certified_hosts + ' certified'} />
        <Big label="Official tables" value={String(n.official_tables_30d)} sub={n.partner_venues + ' partner venues'} />
      </View>

      <Head>30-day retention, by sign-up month</Head>
      {(m.cohorts || []).length ? (
        <Bars rows={m.cohorts} value={(c) => c.pct} label={(c) => c.pct + '%' + (c.complete ? '' : ' ·')} />
      ) : <Text style={{ color: C.dim, fontSize: 13 }}>No sign-ups in the last six months.</Text>}
      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 6 }}>Seen again 30+ days after joining. “·” = the month is still young.</Text>

      <Head>Offline check-ins a month</Head>
      {(m.offline || []).length ? (
        <Bars rows={m.offline} value={(o) => o.qr + o.by_hand} label={(o) => (o.qr + o.by_hand) + ' · ' + o.per_person + '/p'} />
      ) : <Text style={{ color: C.dim, fontSize: 13 }}>No stamps yet — they start with the first table QR.</Text>}
      <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 6 }}>Passport stamps (QR scans + by hand) and check-ins per person.</Text>
    </View>
  );
};
