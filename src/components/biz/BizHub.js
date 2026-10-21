import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/theme';
import { AV_NEUTRAL } from '../../constants/mockData';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { myPlace, savePlace, newCounterCode, placeStats, requestsIn, answerRequest, liveToken } from '../../services/biz';
import { Qr, printTableCard } from './Qr';
import { placeLink } from '../../lib/bizLink';
import { uploadPlanPhoto } from '../../lib/storage';
import { Selling } from '../VenueSheet';
import { lazyOverlay } from '../../lib/lazyScreen';
const GreenSheet = lazyOverlay(() => import('../green/GreenSheet').then((m) => ({ default: m.GreenSheet })));
import { bw, fill, TYPES, typeOf, tname, INCLUDES } from './words';
import { tapLight, tapSelection, tapSuccess } from '../../utils/feedback';
import { useSheetBack } from '../../hooks/useSheetBack';
import { COUNTRY_LIST } from '../../constants/countries';
import { openPartner } from '../../lib/partnerLink';

/* ─── YOUR BUSINESS ON MOMENTS (accepted partners) ────────────────────
   One screen for every kind of partner, with what that kind needs:
     Today     the real check-ins, the counter code, what the fee would
               come to (and that nothing is charged yet)
     Page      what people see — photos, words, hours, prices, and the
               fields only your kind has (beds a night, groups up to…)
     Requests  stays, tables and group visits to accept or decline
     Orders    for shops that sell through Moments
   Replaces VenueSheet; its order list lives on in the Orders tab. */

const pickFile = () => new Promise((resolve) => {
  if (typeof document === 'undefined') return resolve(null);
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
  document.body.appendChild(input); input.click();
  return undefined;
});

const Label = ({ children }) => <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 6 }}>{String(children).toUpperCase()}</Text>;
const Input = ({ value, onChange, ph, multi, kb, max }) => (
  <TextInput value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor={C.faint} multiline={!!multi} keyboardType={kb || 'default'} maxLength={max || 120}
    style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: C.glass, minHeight: multi ? 90 : undefined, textAlignVertical: multi ? 'top' : 'center', outlineStyle: 'none' }} />
);
const Stat = ({ n, label }) => (
  <View style={{ width: '33.33%', padding: 4 }}>
    <View style={{ borderRadius: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, paddingVertical: 12, alignItems: 'center' }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900' }}>{n == null ? '—' : String(n)}</Text>
      <Text style={{ color: C.dim, fontSize: 11.5, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{label}</Text>
    </View>
  </View>
);
const Btn = ({ label, onPress, ghost, busy, small }) => (
  <Pressable onPress={onPress} disabled={busy} accessibilityRole="button">
    <View style={{ borderRadius: 999, paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 16 : 0, alignItems: 'center', backgroundColor: ghost ? C.glassHi : C.purple, opacity: busy ? 0.6 : 1 }}>
      {busy ? <ActivityIndicator color={ghost ? C.text : '#FFF'} /> : <Text style={{ color: ghost ? C.text : '#FFF', fontSize: small ? 13.5 : 15.5, fontWeight: '900' }}>{label}</Text>}
    </View>
  </Pressable>
);

/* ─── SCAN TO CHECK IN ── the counter's QR, a new one every minute
   (biz_live_token): the customer scans and is checked in. A photo of it
   is useless a minute later. And a card to print for the tables, which
   opens the place and asks for the staff's code. */
const CounterQr = ({ v, B }) => {
  const [tk, setTk] = useState(null);
  useEffect(() => {
    let alive = true; let t = null;
    const get = () => liveToken().then((r) => {
      if (!alive) return;
      if (r && r.ok) { setTk(r.token); t = setTimeout(get, Math.max(5, Number(r.seconds) || 30) * 1000 + 500); }
      else t = setTimeout(get, 15000);
    });
    get();
    return () => { alive = false; if (t) clearTimeout(t); };
  }, []);
  return (
    <View style={{ borderRadius: 22, padding: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 12, alignItems: 'center' }}>
      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{B('qr_title').toUpperCase()}</Text>
      <View style={{ marginTop: 12, padding: 10, borderRadius: 18, backgroundColor: '#FFF' }}>
        {tk ? <Qr value={placeLink(v.id, tk)} size={200} /> : <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.purple} /></View>}
      </View>
      <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 18 }}>{B('qr_s')}</Text>
      <View style={{ marginTop: 12 }}>
        <Btn small ghost label={B('qr_print')} onPress={() => { tapLight(); printTableCard({ name: v.name, link: placeLink(v.id), line: B('qr_card'), sub: B('qr_card_s') }); }} />
      </View>
    </View>
  );
};

const Today = ({ v, lang, onPlan, onCode }) => {
  const B = (k) => bw(lang, k);
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const ty = typeOf(v.biz_type);
  useEffect(() => { placeStats().then((r) => r && r.ok && setS(r)); }, []);
  return (
    <>
      {ty.counter ? (
        <View style={{ borderRadius: 22, padding: 18, backgroundColor: C.purpleSoft, marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: C.purple, fontSize: 11.5, fontWeight: '900', letterSpacing: 1 }}>{B('code').toUpperCase()}</Text>
          <Text selectable style={{ color: C.text, fontSize: 48, fontWeight: '900', letterSpacing: 10, marginTop: 4 }}>{v.staff_code || '····'}</Text>
          <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>{B('code_s')}</Text>
          <View style={{ marginTop: 12 }}>
            <Btn small ghost busy={busy} label={B('code_new')} onPress={async () => { tapLight(); setBusy(true); const r = await newCounterCode(); setBusy(false); if (r && r.ok) onCode(r.code); }} />
          </View>
        </View>
      ) : null}
      {ty.counter ? <CounterQr v={v} B={B} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 12 }}>
        <Stat n={s && s.today} label={B('st_today')} /><Stat n={s && s.week} label={B('st_week')} /><Stat n={s && s.month} label={B('st_month')} />
        <Stat n={s && s.people} label={B('st_people')} /><Stat n={s && s.back} label={B('st_back')} /><Stat n={s && s.rewards} label={B('st_rewards')} />
      </View>
      {s && ty.counter ? (
        <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>
          {fill(B('bill'), { left: s.free_left, fee: Number(s.fee), sum: Number(s.month_bill).toLocaleString() })}
        </Text>
      ) : null}
      <Label>{B('recent')}</Label>
      {s && s.recent && s.recent.length ? s.recent.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Image source={{ uri: x.avatar || AV_NEUTRAL }} style={{ width: 30, height: 30, borderRadius: 15, marginEnd: 10 }} />
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800', flex: 1 }}>{x.name || '—'}</Text>
          <Text style={{ color: C.faint, fontSize: 12 }}>{'×' + x.visits + ' · ' + new Date(x.at).toLocaleDateString()}</Text>
        </View>
      )) : <Text style={{ color: C.dim, fontSize: 13.5 }}>{s ? B('recent_none') : '…'}</Text>}
      <View style={{ borderRadius: 20, padding: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, marginTop: 20 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{'📍 ' + B('plan_here')}</Text>
        <Text style={{ color: C.dim, fontSize: 13, marginTop: 4, marginBottom: 12, lineHeight: 18 }}>{B('plan_here_s')}</Text>
        <Btn label={B('plan_here')} onPress={() => { tapLight(); onPlan(); }} />
      </View>
    </>
  );
};

const PageEditor = ({ v, lang, userId, onSaved }) => {
  const B = (k) => bw(lang, k);
  const ty = typeOf(v.biz_type);
  const d0 = v.details || {};
  const [f, setF] = useState({
    about: v.about || '', phone: v.phone || '', address: v.address || '', city: v.city || '', hours: v.hours || '',
    quiet: v.quiet || '', perk: v.perk || '', price: v.price_from != null ? String(v.price_from) : '', lat: v.lat, lng: v.lng,
  });
  const [d, setD] = useState(d0);
  const [photos, setPhotos] = useState(v.photos || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (x) => setF((o) => ({ ...o, [k]: x }));
  const setDet = (k) => (x) => setD((o) => ({ ...o, [k]: x }));
  const has = (k) => ty.fields.includes(k);
  const addPhoto = async () => {
    if (photos.length >= 12) return;
    tapLight(); const file = await pickFile(); if (!file) return;
    setBusy(true);
    try { const url = await uploadPlanPhoto(userId, file); setPhotos((p) => p.concat(url)); } catch (e) { setMsg(B('failed')); }
    setBusy(false);
  };
  const pin = () => {
    try { navigator.geolocation.getCurrentPosition((pos) => { tapSuccess(); setF((o) => ({ ...o, lat: pos.coords.latitude, lng: pos.coords.longitude })); }, () => {}); } catch (e) {}
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await savePlace({
      about: f.about, phone: f.phone, address: f.address, city: f.city, hours: f.hours, quiet: f.quiet, perk: f.perk,
      price_from: f.price.trim() ? f.price.trim() : null, lat: f.lat, lng: f.lng, photos, details: d,
    });
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setMsg(B('saved')); onSaved(); } else setMsg(B(r && r.reason === 'phone' ? 'phone' : 'failed'));
  };
  const priceKey = has('price_night') ? 'price_night' : has('price_pp') ? 'price_pp' : has('price_from') ? 'price_from' : null;
  return (
    <>
      <Label>{B('photos')}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {photos.map((u) => (
          <View key={u} style={{ marginEnd: 8 }}>
            <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: C.glassHi }} />
            <Pressable onPress={() => { tapLight(); setPhotos((p) => p.filter((x) => x !== u)); }} accessibilityRole="button" accessibilityLabel="Remove"
              style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
        {photos.length < 12 ? (
          <Pressable onPress={addPhoto} accessibilityRole="button" accessibilityLabel={B('photos')} style={{ width: 96, height: 96, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color={C.dim} /> : <Ionicons name="add" size={28} color={C.dim} />}
          </Pressable>
        ) : null}
      </ScrollView>
      <Label>{B('about')}</Label>
      <Input value={f.about} onChange={set('about')} ph={B('about_ph')} multi max={1200} />
      {priceKey ? (<><Label>{B(priceKey)}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Input value={f.price} onChange={(x) => set('price')(x.replace(/[^0-9.]/g, ''))} ph="0" kb="decimal-pad" max={9} /></View>
          <Text style={{ color: C.dim, fontSize: 15, fontWeight: '800', marginStart: 10 }}>{v.currency || 'EGP'}</Text>
        </View></>) : null}
      {has('beds') ? <><Label>{B('beds')}</Label><Input value={d.beds || ''} onChange={setDet('beds')} ph="e.g. 6 rooms · 20 beds" max={60} /></> : null}
      {has('checkin_t') ? <><Label>{B('checkin_t')}</Label><Input value={d.checkin || ''} onChange={setDet('checkin')} ph="14:00" max={20} /></> : null}
      {has('includes') ? (
        <>
          <Label>{B('includes')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {INCLUDES.map(([k, en, ar]) => {
              const on = !!(d.inc || []).includes(k);
              return (
                <Pressable key={k} onPress={() => { tapSelection(); setD((o) => ({ ...o, inc: on ? (o.inc || []).filter((x) => x !== k) : (o.inc || []).concat(k) })); }}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ marginEnd: 6, marginBottom: 6 }}>
                  <View style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass }}>
                    <Text style={{ color: on ? C.purple : C.text, fontSize: 13, fontWeight: '800' }}>{lang === 'ar' ? ar : en}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {has('group_max') ? <><Label>{B('group_max')}</Label><Input value={d.group_max || ''} onChange={(x) => setDet('group_max')(x.replace(/[^0-9]/g, ''))} ph="12" kb="number-pad" max={3} /></> : null}
      {has('duration') ? <><Label>{B('duration')}</Label><Input value={d.hours || ''} onChange={(x) => setDet('hours')(x.replace(/[^0-9.]/g, ''))} ph="2" kb="decimal-pad" max={4} /></> : null}
      {has('sells') ? <><Label>{B('sells')}</Label><Input value={d.sells || ''} onChange={setDet('sells')} max={120} /></> : null}
      {has('link') ? <><Label>{B('link')}</Label><Input value={d.link || ''} onChange={setDet('link')} ph="https://" max={200} /></> : null}
      {has('hours') ? <><Label>{B('hours')}</Label><Input value={f.hours} onChange={set('hours')} ph={B('hours_ph')} /></> : null}
      {has('table') ? (
        <View style={{ borderRadius: 20, padding: 14, backgroundColor: C.goldSoft, marginTop: 20 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '900' }}>{'🪑 ' + B('table')}</Text>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 2, marginBottom: 8 }}>{B('table_s')}</Text>
          <Input value={f.quiet} onChange={set('quiet')} ph={B('quiet_ph')} max={80} />
          <View style={{ height: 8 }} />
          <Input value={f.perk} onChange={set('perk')} ph={B('perk_ph')} max={120} />
          <Text style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>{'⭐ ' + B('stamps_s')}</Text>
        </View>
      ) : has('perk') ? <><Label>{B('perk')}</Label><Input value={f.perk} onChange={set('perk')} ph={B('perk_ph')} max={120} /></> : null}
      <Label>{B('phone')}</Label><Input value={f.phone} onChange={set('phone')} ph="+20…" kb="phone-pad" max={24} />
      <Label>{B('city')}</Label><Input value={f.city} onChange={set('city')} max={60} />
      <Label>{B('address')}</Label><Input value={f.address} onChange={set('address')} max={200} />
      <Pressable onPress={pin} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
        <Text style={{ color: f.lat != null ? C.green : C.purple, fontSize: 14, fontWeight: '900' }}>{f.lat != null ? B('pinned') : '📍 ' + B('pin')}</Text>
      </Pressable>
      <View style={{ marginTop: 22 }}><Btn label={B('save')} busy={busy} onPress={save} /></View>
      {msg ? <Text style={{ color: msg === B('saved') ? C.green : C.coral, fontSize: 13.5, textAlign: 'center', marginTop: 10 }}>{msg}</Text> : null}
    </>
  );
};

const Requests = ({ lang }) => {
  const B = (k) => bw(lang, k);
  const [list, setList] = useState(null);
  const [reply, setReply] = useState({});
  const load = () => requestsIn().then(setList);
  useEffect(() => { load(); }, []);
  const answer = async (q, st) => { tapLight(); const r = await answerRequest(q.id, st, reply[q.id]); if (r && r.ok) { tapSuccess(); load(); } };
  if (!list) return <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />;
  if (!list.length) return <Text style={{ color: C.dim, fontSize: 14, marginTop: 20 }}>{B('req_none')}</Text>;
  return list.map((q) => (
    <View key={q.id} style={{ borderRadius: 18, padding: 14, marginTop: 12, backgroundColor: C.glass, borderWidth: 1, borderColor: q.status === 'new' ? C.purple : C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image source={{ uri: q.avatar || AV_NEUTRAL }} style={{ width: 32, height: 32, borderRadius: 16, marginEnd: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{(q.name || '—') + ' · ' + B('r_' + q.kind)}</Text>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 1 }}>{q.from + (q.to ? ' → ' + q.to : '') + ' · ' + fill(B('req_people'), { n: q.people })}</Text>
        </View>
        <Text style={{ color: q.status === 'accepted' ? C.green : q.status === 'new' ? C.purple : C.faint, fontSize: 12, fontWeight: '900' }}>{B('st_' + q.status)}</Text>
      </View>
      {q.note ? <Text style={{ color: C.text, fontSize: 14, marginTop: 8, lineHeight: 20 }}>{q.note}</Text> : null}
      {q.reply ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>{'↩ ' + q.reply}</Text> : null}
      {q.status === 'new' ? (
        <>
          <View style={{ marginTop: 10 }}><Input value={reply[q.id] || ''} onChange={(x) => setReply((o) => ({ ...o, [q.id]: x }))} ph={B('reply_ph')} max={400} /></View>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <View style={{ flex: 1, marginEnd: 8 }}><Btn small label={B('accept')} onPress={() => answer(q, 'accepted')} /></View>
            <View style={{ flex: 1 }}><Btn small ghost label={B('decline')} onPress={() => answer(q, 'declined')} /></View>
          </View>
        </>
      ) : null}
    </View>
  ));
};

export const BizHub = ({ onClose, lang }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const B = (k) => bw(lang, k);
  const [v, setV] = useState(undefined);
  const [tab, setTab] = useState('today');
  const [plan, setPlan] = useState(false);
  const [listing, setListing] = useState(false);
  const load = () => myPlace().then((r) => setV(r && r.id ? r : null));
  useEffect(() => { load(); }, []);
  const ty = v ? typeOf(v.biz_type) : TYPES[0];
  const tabs = ['today', 'page'].concat(ty.ask ? ['req'] : []).concat(ty.orders ? ['orders'] : []);
  const toggleListed = async (on) => {
    setListing(true); setV((o) => ({ ...o, listed: on }));
    const r = await savePlace({ ...v, price_from: v.price_from, photos: v.photos || [], details: v.details || {}, listed: on });
    setListing(false);
    if (!(r && r.ok)) setV((o) => ({ ...o, listed: !on })); else tapSuccess();
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          {v === undefined ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : !v ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: C.dim, fontSize: 14.5, marginTop: 30, textAlign: 'center', lineHeight: 21 }}>{B('none_mine')}</Text>
              {/* not a partner yet: the way in is the partner page */}
              <Pressable onPress={() => { tapLight(); onClose(); openPartner('place'); }} accessibilityRole="button" style={{ marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: C.purple, paddingVertical: 12, paddingHorizontal: 20 }}>
                  <Ionicons name="storefront-outline" size={17} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '900', marginStart: 8 }}>{t('pt_together_line')}</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 8 }}>{(ty.e + ' ' + tname(lang, ty)).toUpperCase()}</Text>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 }} numberOfLines={2}>{v.name}</Text>
              {/* where it is: the country, with its flag, and the city */}
              {v.country || v.city ? (
                <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                  {[(COUNTRY_LIST.find((x) => x.code === v.country) || {}).flag, (COUNTRY_LIST.find((x) => x.code === v.country) || {}).name, v.city].filter(Boolean).join(' ')}
                </Text>
              ) : null}
              {/* one switch: is my page on Moments yet */}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, marginTop: 14, backgroundColor: v.listed ? C.greenSoft : C.glass, borderWidth: 1, borderColor: v.listed ? C.green : C.line }}>
                <View style={{ flex: 1, marginEnd: 10 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{B('listed')}</Text>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{B('listed_s')}</Text>
                </View>
                <Switch value={!!v.listed} onValueChange={toggleListed} disabled={listing} accessibilityLabel={B('listed')} />
              </View>
              {/* the type, if the application did not say */}
              {!v.biz_type ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 12 }}>
                  {TYPES.filter((x) => !x.host).map((x) => (
                    <Pressable key={x.k} onPress={async () => { tapSelection(); const r = await savePlace({ ...v, photos: v.photos || [], details: v.details || {}, biz_type: x.k }); if (r && r.ok) load(); }} style={{ marginEnd: 6 }} accessibilityRole="button">
                      <View style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{x.e + ' ' + tname(lang, x)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: 16, backgroundColor: C.glassHi, borderRadius: 999, padding: 4 }}>
                {tabs.map((k) => (
                  <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
                    <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.glass : 'transparent' }}>
                      <Text style={{ color: tab === k ? C.text : C.dim, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{B('hub_' + (k === 'req' ? 'req' : k))}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              {tab === 'today' ? <Today v={v} lang={lang} onPlan={() => setPlan(true)} onCode={(c) => setV((o) => ({ ...o, staff_code: c }))} /> : null}
              {tab === 'page' ? <PageEditor key={v.updated_at} v={v} lang={lang} userId={user && user.id} onSaved={load} /> : null}
              {tab === 'req' ? <Requests lang={lang} /> : null}
              {tab === 'orders' ? <Selling t={t} userId={user && user.id} /> : null}
            </>
          )}
        </ScrollView>
      </View>
      {plan && v ? <GreenSheet startNow prefill={{ kind: v.biz_type === 'org' ? 'project' : 'coffee', title: '', place: v.name + (v.address ? ' · ' + v.address : ''), lat: v.lat, lng: v.lng }} onClose={() => setPlan(false)} /> : null}
    </Modal>
  );
};
