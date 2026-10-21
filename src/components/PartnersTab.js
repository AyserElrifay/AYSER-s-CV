import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { C } from '../constants/theme';
import { ownerPartnerApps, ownerPartnerSet, ownerPartnerFlags } from '../services/partners';
import { COUNTRY_LIST } from '../constants/countries';
import { appLink, shareLink } from '../utils/share';

/* ─── STUDIO · PARTNERS ────────────────────────────────────────────────
   Every place and experience that applied on the partner page
   (PartnerSheet), newest first, the new ones on top. Call, WhatsApp or
   email them from here, and move each one along: new → talking →
   accepted / declined. Refused by the database for anyone but the owner. */
const STATUS = ['new', 'talking', 'accepted', 'declined'];
const COLOR = { new: '#7C3AED', talking: '#D97706', accepted: '#16A34A', declined: '#9CA3AF' };
const wa = (phone) => 'https://wa.me/' + String(phone || '').replace(/[^0-9]/g, '');

const Btn = ({ label, onPress, color }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: color || C.line, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ color: color || C.text, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

/* the kind a business said it is (see components/biz/words.js) */
// which country, with its flag (partner_applications.country)
const countryOf = (code) => { const c = COUNTRY_LIST.find((x) => x.code === code); return c ? c.flag + ' ' + c.name : code ? code : 'Country unknown'; };
const BIZ_EMOJI = { cafe: '☕', restaurant: '🍽️', shop: '🛍️', hotel: '🏨', hostel: '🛏️', home: '🏡', activity: '🧗', org: '🌱', host: '🧭' };

/* ── NEEDS A LOOK ── Ayser: watch them without getting in their way or
   making it a chore. Only the places where something looks wrong, each
   with its reason in a line; when nothing does, one quiet line says so. */
const WHY = {
  spike: (n) => n + ' check-ins today — five times the usual',
  regulars: (n) => n + ' people checked in 4+ days this week — stamps being farmed?',
  waiting: (n) => n + (n === 1 ? ' group request' : ' group requests') + ' unanswered for over a day',
  empty: () => 'Shown on Moments with no photos or no opening hours',
};
const NeedsALook = () => {
  const [rows, setRows] = useState(null);
  useEffect(() => { ownerPartnerFlags().then(setRows); }, []);
  if (rows == null) return null;
  if (!rows.length) return <Text style={{ color: '#16A34A', fontSize: 13.5, fontWeight: '800', marginBottom: 14 }}>✓ Every place looks fine.</Text>;
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>{'NEEDS A LOOK · ' + rows.length}</Text>
      {rows.map((v) => (
        <View key={v.id} style={{ borderRadius: 16, padding: 13, marginTop: 8, borderWidth: 1, borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.06)' }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{v.name}</Text>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{[v.country ? countryOf(v.country) : null, v.city].filter(Boolean).join(' · ')}</Text>
          {(v.flags || []).map((f) => <Text key={f.k} style={{ color: C.text, fontSize: 13.5, marginTop: 6 }}>{'• ' + (WHY[f.k] ? WHY[f.k](f.n) : f.k)}</Text>)}
        </View>
      ))}
    </View>
  );
};

export const PartnersTab = () => {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('open');
  const load = () => ownerPartnerApps().then((r) => setRows(r || []));
  useEffect(() => { load(); }, []);
  const move = async (x, status) => { const r = await ownerPartnerSet(x.id, status); if (r && r.ok) load(); };
  const shown = (rows || []).filter((x) => (filter === 'open' ? x.status === 'new' || x.status === 'talking' : x.status === filter));
  return (
    <View>
      <NeedsALook />
      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19 }}>
        Places and experiences that applied on the partner page. Send the page to a venue with the button below — it opens without an account.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
        <Btn label="Send the partner page" color={C.purple} onPress={() => shareLink({ url: appLink({ partner: 'place' }), title: 'Moments', text: 'Put your place on Moments' })} />
        {['open', 'accepted', 'declined'].map((k) => <Btn key={k} label={(filter === k ? '● ' : '') + k} onPress={() => setFilter(k)} />)}
      </View>
      {rows == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 20 }} />
        : !shown.length ? <Text style={{ color: C.dim, marginTop: 14 }}>Nothing here yet.</Text>
        : shown.map((x) => (
          <View key={x.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 13, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', flex: 1 }} numberOfLines={1}>{(BIZ_EMOJI[x.biz_type] || (x.kind === 'place' ? '📍' : '🧭')) + ' ' + x.brand + (x.biz_type ? ' · ' + x.biz_type : '')}</Text>
              <Text style={{ color: COLOR[x.status], fontSize: 12, fontWeight: '900' }}>{x.status.toUpperCase()}</Text>
            </View>
            <Text style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>{[countryOf(x.country), x.city, x.name, new Date(x.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}</Text>
            {x.about ? <Text selectable style={{ color: C.text, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{x.about}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {x.phone ? <Btn label={'📞 ' + x.phone} onPress={() => Linking.openURL('tel:' + x.phone).catch(() => {})} /> : null}
              {x.phone ? <Btn label="WhatsApp" color="#16A34A" onPress={() => Linking.openURL(wa(x.phone)).catch(() => {})} /> : null}
              {x.email ? <Btn label={'✉️ ' + x.email} onPress={() => Linking.openURL('mailto:' + x.email).catch(() => {})} /> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.filter((s) => s !== x.status).map((s) => <Btn key={s} label={'→ ' + s} color={COLOR[s]} onPress={() => move(x, s)} />)}
            </View>
          </View>
        ))}
    </View>
  );
};
