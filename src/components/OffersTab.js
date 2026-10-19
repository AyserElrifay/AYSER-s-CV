import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, ActivityIndicator, Animated, Easing } from 'react-native';
import { C } from '../constants/theme';
import {
  ownerOffers, offerSave, offerSetVideo, offerSetDuration, offerSetStatus, ownerBookings, ownerMarkBooking, ownerSetSetting, appSettings, photoUrl, money, ownerLeaders, ownerSaveLeader, ownerDeleteLeader } from '../services/offers';
import { uploadPlanPhoto } from '../lib/storage';
import { tapLight, tapSuccess } from '../utils/feedback';
import { appLink, shareLink } from '../utils/share';

/* ─── STUDIO · TRIPS & DEALS ───────────────────────────────────────────
   The owner's desk for what people can book: write an offer (or finish
   one of the drafts), add real photos, publish; see who booked, mark a
   transfer received or a refund sent; read what each partner is owed.
   Every action is refused by the database for anybody but the owner
   with a fresh second step (owner_ok in RUN_ME.sql). English, like the
   rest of the Studio. Lists are typed one line per item. */

const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const joinL = (a) => (Array.isArray(a) ? a.join('\n') : '');
const KINDS = ['trip', 'deal', 'stay', 'experience', 'table', 'gift'];
const MODES = ['reserve', 'at_venue', 'online'];

const Field = ({ label, value, onChange, multi, ph, num }) => (
  <View style={{ marginTop: 10 }}>
    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
    <TextInput value={value == null ? '' : String(value)} onChangeText={onChange} multiline={!!multi} placeholder={ph} placeholderTextColor={C.faint}
      keyboardType={num ? 'decimal-pad' : 'default'}
      style={{ marginTop: 4, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, color: C.text, fontSize: 14, minHeight: multi ? 70 : undefined, textAlignVertical: multi ? 'top' : 'center' }} />
  </View>
);
const Btn = ({ label, onPress, solid, danger, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} style={{ marginEnd: 8, marginTop: 8 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: solid ? C.purple : 'transparent', borderWidth: 1, borderColor: solid ? C.purple : danger ? '#E11D48' : C.line, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: solid ? '#FFF' : danger ? '#E11D48' : C.text, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  </Pressable>
);

/* ─── IS THIS TRIP READY? ─────────────────────────────────────────────
   Ayser: "حط حاجة تسعدني لما أعمل new travel … في الأسعار وحاجات تانية
   مهمة عشان ما تتنسيش". Every line a traveller asks before paying,
   ticked off as it is filled in — so nothing important is forgotten,
   and the bar filling up is the small pleasure of a trip coming
   together. Required ones block nothing here (the database still
   refuses to publish without a photo and a price); they are just the
   ones a trip should never go out without. */
const CHECKS = [
  ['Title in English', (f) => f.title.trim().length > 3, true],
  ['Title in Arabic', (f) => f.title_ar.trim().length > 1, true],
  ['A real photo', (f) => lines(f.photos).length > 0, true],
  ['Price', (f) => Number(f.price) > 0, true],
  ['≈ USD price for travellers from abroad', (f) => Number(f.price_usd) > 0, false],
  ['Dates', (f) => !!String(f.starts_at).trim(), true],
  ['Seats', (f) => Number(f.seats) > 0, false],
  ['Program (2+ steps)', (f) => lines(f.itinerary).length >= 2, true],
  ['What is included', (f) => lines(f.includes).length > 0, true],
  ['What is not included', (f) => lines(f.excludes).length > 0, false],
  ['Good to know (what to bring, meeting point)', (f) => lines(f.good_to_know).length > 0, false],
  ['Free cancellation window', (f) => String(f.free_cancel_hours).trim() !== '', false],
  ['How long it takes', (f) => Number(f.duration) > 0, false],
  ['Where (city or map point)', (f) => !!f.city.trim() || (String(f.lat).trim() && String(f.lng).trim()), false],
  ['A video', (f) => !!f.video.trim(), false],
];
const warningsOf = (f) => {
  const w = [];
  const p = Number(f.price); const mp = Number(f.member_price);
  if (f.member_price && mp >= p) w.push('The Plus price is not lower than the normal price.');
  const st = f.starts_at && new Date(String(f.starts_at).replace(' ', 'T'));
  const en = f.ends_at && new Date(String(f.ends_at).replace(' ', 'T'));
  if (st && !isNaN(st) && st < new Date()) w.push('The start date is in the past.');
  if (st && en && !isNaN(st) && !isNaN(en) && en < st) w.push('It ends before it starts.');
  if (Number(f.commission_pct) > 40) w.push('A commission above 40% is unusual — check it with the partner.');
  if (f.pay_modes.length === 0) w.push('Pick at least one way to pay.');
  if (Number(f.price) > 0 && Number(f.price_usd) > 0 && f.currency === 'EGP') {
    const rate = Number(f.price) / Number(f.price_usd);
    if (rate < 20 || rate > 120) w.push('The EGP and USD prices do not look like the same amount (' + Math.round(rate) + ' EGP per $).');
  }
  return w;
};

const Readiness = ({ f }) => {
  const done = CHECKS.filter(([, ok]) => ok(f)).length;
  const missingMust = CHECKS.filter(([, ok, must]) => must && !ok(f));
  const missingNice = CHECKS.filter(([, ok, must]) => !must && !ok(f));
  const pct = done / CHECKS.length;
  const p = Number(f.price) || 0;
  const cut = Math.min(100, Math.max(0, Number(f.commission_pct) || 0)) / 100;
  const seats = Number(f.seats) || 0;
  const cur = f.currency || 'EGP';
  const warn = warningsOf(f);
  const mood = pct >= 1 ? '🎉 Everything a traveller asks is here.' : missingMust.length === 0 ? '✨ Ready to publish — the extras make it better.' : '🧳 Coming together…';
  return (
    <View style={{ borderWidth: 1, borderColor: missingMust.length ? C.line : C.green, borderRadius: 16, padding: 12, marginTop: 10, backgroundColor: C.glass }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', flex: 1 }}>{mood}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>{done + ' / ' + CHECKS.length}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ width: Math.round(pct * 100) + '%', height: 8, borderRadius: 4, backgroundColor: pct >= 1 ? C.green : C.purple }} />
      </View>
      {missingMust.length ? <Text style={{ color: '#E11D48', fontSize: 12.5, marginTop: 8 }}>{'Still needed: ' + missingMust.map(([l]) => l).join(' · ')}</Text> : null}
      {missingNice.length ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 4 }}>{'Nice to add: ' + missingNice.map(([l]) => l).join(' · ')}</Text> : null}
      {p > 0 ? (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>
            {'Per person: ' + money(p, cur) + (Number(f.price_usd) > 0 ? ' (≈ $' + Number(f.price_usd) + ')' : '') + (cut ? ' → Moments ' + money(Math.round(p * cut), cur) + ' · organiser ' + money(Math.round(p * (1 - cut)), cur) : '')}
          </Text>
          {seats ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{'Full trip (' + seats + ' seats): ' + money(p * seats, cur) + (cut ? ' · Moments ' + money(Math.round(p * seats * cut), cur) : '')}</Text> : null}
          {Number(f.member_price) > 0 && Number(f.member_price) < p ? <Text style={{ color: '#8A6400', fontSize: 12.5, marginTop: 2 }}>{'Plus members save ' + money(p - Number(f.member_price), cur) + ' each'}</Text> : null}
        </View>
      ) : null}
      {warn.map((x) => <Text key={x} style={{ color: '#D97706', fontSize: 12.5, marginTop: 4 }}>{'⚠️ ' + x}</Text>)}
    </View>
  );
};

/* published: a moment worth a little ceremony, and the link to send */
const Party = ({ offer, onClose }) => {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start(); }, [pop]);
  const [note, setNote] = useState(null);
  return (
    <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop, marginTop: 12, borderRadius: 18, padding: 16, backgroundColor: '#1A1A1A' }}>
      <Text style={{ fontSize: 34 }}>🎉🧳✨</Text>
      <Text style={{ color: '#FDE68A', fontSize: 18, fontWeight: '900', marginTop: 6 }}>{offer.title + ' is live!'}</Text>
      <Text style={{ color: '#E5E5EA', fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>People can book it now — and everyone who tapped “I want to go” is being told.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Btn label="Share the trip" solid onPress={async () => { const r = await shareLink({ url: appLink({ trip: offer.id }), title: offer.title, text: offer.title + ' — on Moments' }); setNote(r === 'copied' ? 'Link copied ✓' : null); }} />
        <Btn label="Close" onPress={onClose} />
      </View>
      {note ? <Text style={{ color: '#A7F3D0', fontSize: 12.5, marginTop: 6 }}>{note}</Text> : null}
    </Animated.View>
  );
};

/* who leads this trip — name, role, one line of what qualifies them;
   shown on the trip only after "credentials checked" is ticked */
const ROLES = [['teacher', 'Teacher'], ['psychologist', 'Psychologist'], ['coach', 'Coach'], ['trainer', 'Trainer'], ['founder', 'Founder'], ['guide', 'Guide'], ['other', 'Host']];
const blankLeader = () => ({ id: '', name: '', role: 'psychologist', credential: '', credential_ar: '', photo: '', verified: false });
const LeadersEditor = ({ offerId }) => {
  const [list, setList] = useState(null);
  const [f, setF] = useState(blankLeader());
  const [msg, setMsg] = useState(null);
  const load = () => ownerLeaders(offerId).then(setList);
  useEffect(() => { if (offerId) load(); }, [offerId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!offerId) return <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 8 }}>Save the trip first, then add who leads it.</Text>;
  const save = async () => {
    if (f.name.trim().length < 2) { setMsg('Add a name.'); return; }
    const r = await ownerSaveLeader({ ...f, offer_id: offerId });
    if (r && r.ok) { setF(blankLeader()); setMsg('Saved'); load(); } else setMsg('Could not save (' + ((r && r.reason) || 'error') + ')');
  };
  return (
    <View style={{ marginTop: 8 }}>
      {(list || []).map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Text style={{ flex: 1, color: C.text, fontSize: 13.5 }}>{l.name + ' · ' + l.role + (l.verified ? ' · ✓ checked' : ' · not shown yet')}</Text>
          <Btn label="Edit" onPress={() => setF({ ...blankLeader(), ...l, credential: l.credential || '', credential_ar: l.credential_ar || '', photo: l.photo || '' })} />
          <Btn label="Remove" danger onPress={async () => { await ownerDeleteLeader(l.id); load(); }} />
        </View>
      ))}
      <Field label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} ph="Dr. Abdelrahman …" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ROLES.map(([k, label]) => <Btn key={k} label={(f.role === k ? '✓ ' : '') + label} solid={f.role === k} onPress={() => setF({ ...f, role: k })} />)}
      </View>
      <Field label="What qualifies them (English)" value={f.credential} onChange={(v) => setF({ ...f, credential: v })} ph="Clinical psychologist, 8 years" />
      <Field label="What qualifies them (Arabic)" value={f.credential_ar} onChange={(v) => setF({ ...f, credential_ar: v })} />
      <Field label="Photo (https:// or media/…)" value={f.photo} onChange={(v) => setF({ ...f, photo: v })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Btn label={(f.verified ? '✓ ' : '') + 'I checked their credentials'} solid={f.verified} onPress={() => setF({ ...f, verified: !f.verified })} />
        <Btn label={f.id ? 'Save leader' : 'Add leader'} solid onPress={save} />
      </View>
      {msg ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 4 }}>{msg}</Text> : null}
    </View>
  );
};

const toForm = (o) => ({
  id: o.id || '', kind: o.kind || 'trip', title: o.title || '', title_ar: o.title_ar || '', operator: o.operator || '',
  summary: o.summary || '', summary_ar: o.summary_ar || '', city: o.city || '', country: o.country || 'EG',
  lat: o.lat == null ? '' : String(o.lat), lng: o.lng == null ? '' : String(o.lng),
  photos: joinL(o.photos), video: o.video || '', duration: o.duration_hours != null ? String(o.duration_hours) : '', itinerary: joinL(o.itinerary), itinerary_ar: joinL(o.itinerary_ar),
  includes: joinL(o.includes), includes_ar: joinL(o.includes_ar), excludes: joinL(o.excludes), excludes_ar: joinL(o.excludes_ar),
  good_to_know: joinL(o.good_to_know), good_to_know_ar: joinL(o.good_to_know_ar),
  price: o.price == null ? '' : String(o.price), currency: o.currency || 'EGP', price_usd: o.price_usd == null ? '' : String(o.price_usd),
  member_price: o.member_price == null ? '' : String(o.member_price),
  starts_at: o.starts_at ? String(o.starts_at).slice(0, 16).replace('T', ' ') : '', ends_at: o.ends_at ? String(o.ends_at).slice(0, 16).replace('T', ' ') : '',
  seats: o.seats == null ? '' : String(o.seats), pay_modes: o.pay_modes || ['reserve'],
  free_cancel_hours: o.free_cancel_hours == null ? '' : String(o.free_cancel_hours),
  commission_pct: o.commission_pct == null ? '' : String(o.commission_pct),
  track: o.track || '', faith_time: !!o.faith_time, topic: o.topic || '', ages: o.ages || '',
  conditions: joinL(o.conditions), conditions_ar: joinL(o.conditions_ar),
});
const fromForm = (f) => {
  const time = (s) => { const v = String(s || '').trim(); if (!v) return ''; const d = new Date(v.replace(' ', 'T')); return isNaN(d) ? '' : d.toISOString(); };
  return {
    ...f,
    photos: lines(f.photos), itinerary: lines(f.itinerary), itinerary_ar: lines(f.itinerary_ar),
    includes: lines(f.includes), includes_ar: lines(f.includes_ar), excludes: lines(f.excludes), excludes_ar: lines(f.excludes_ar),
    good_to_know: lines(f.good_to_know), good_to_know_ar: lines(f.good_to_know_ar),
    conditions: lines(f.conditions), conditions_ar: lines(f.conditions_ar),
    starts_at: time(f.starts_at), ends_at: time(f.ends_at),
  };
};

export const OffersTab = ({ userId }) => {
  const [list, setList] = useState(null);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bookingsOf, setBookingsOf] = useState(null);   // { offer, rows }
  const [freeUntil, setFreeUntil] = useState('');
  const [priceM, setPriceM] = useState(''); const [priceY, setPriceY] = useState(''); const [priceC, setPriceC] = useState('EGP');
  const [party, setParty] = useState(null);             // the offer just published
  const [hook, setHook] = useState('');

  const load = () => {
    ownerOffers().then((r) => setList(r == null ? false : r));
    appSettings().then((s) => {
      setSettings(s); setHook(s.bookings_sheet_hook && s.bookings_sheet_hook !== 'null' ? String(s.bookings_sheet_hook).replace(/^"|"$/g, '') : ''); const v = s.plus_free_until; setFreeUntil(v && v !== 'null' ? String(v).slice(0, 10) : '');
      const pr = s.plus_price && typeof s.plus_price === 'object' ? s.plus_price : null;
      setPriceM(pr ? String(pr.month) : ''); setPriceY(pr ? String(pr.year) : ''); setPriceC(pr ? pr.currency : 'EGP');
    });
  };
  useEffect(() => { load(); }, []);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await offerSave(fromForm(form));
    setBusy(false);
    if (r && r.ok) { await offerSetVideo(r.id, form.video); await offerSetDuration(r.id, form.duration ? Number(String(form.duration).replace(',', '.')) : null); tapSuccess(); setForm((f) => ({ ...f, id: r.id })); setMsg('Saved.'); load(); }
    else setMsg('Not saved: ' + ((r && (r.detail || r.reason)) || 'error'));
  };
  const status = async (o, s) => {
    tapLight();
    const r = await offerSetStatus(o.id, s);
    if (r && r.ok) { tapSuccess(); load(); setMsg(s === 'live' ? null : 'Updated.'); if (s === 'live') setParty(o); }
    else setMsg(r && r.reason === 'no_photo' ? 'Add at least one real photo before publishing.' : r && r.reason === 'no_price' ? 'Set a price before publishing.' : 'Could not change it.');
  };
  const upload = async () => {
    if (typeof document === 'undefined') return;
    const file = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
      input.onchange = () => { resolve((input.files && input.files[0]) || null); input.remove(); };
      document.body.appendChild(input); input.click();
    });
    if (!file) return;
    setBusy(true);
    try { const url = await uploadPlanPhoto(userId, file); setForm((f) => ({ ...f, photos: (f.photos ? f.photos + '\n' : '') + url })); }
    catch (e) { setMsg('Upload failed.'); }
    setBusy(false);
  };
  const openBookings = async (o) => { tapLight(); setBookingsOf({ offer: o, rows: null }); setBookingsOf({ offer: o, rows: await ownerBookings(o.id) }); };
  const [sureCancel, setSureCancel] = useState(null);
  const mark = async (b, s) => {
    // a cancel asks once more: it lands on a real person's trip
    if (s === 'cancelled' && sureCancel !== b.id) { tapLight(); setSureCancel(b.id); return; }
    setSureCancel(null);
    tapLight(); const r = await ownerMarkBooking(b.id, s); if (r && r.ok) { tapSuccess(); openBookings(bookingsOf.offer); load(); }
  };

  if (list === false) return <Text style={{ color: C.faint, fontSize: 13, textAlign: 'center', paddingVertical: 40 }}>Run the latest SQL (part 33) to add trips and deals.</Text>;
  if (list == null) return <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />;

  if (bookingsOf) {
    const rows = bookingsOf.rows;
    return (
      <View>
        <Btn label="‹ Back" onPress={() => setBookingsOf(null)} />
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', marginTop: 10 }}>{bookingsOf.offer.title}</Text>
        {rows == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 20 }} /> : !rows.length ? <Text style={{ color: C.dim, marginTop: 12 }}>No bookings yet.</Text> : rows.map((b) => (
          <View key={b.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 10 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{b.code + ' · ' + (b.name || '') + ' · ' + b.qty + ' ppl'}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{(b.email || '') + ' · ' + b.pay_mode + ' · ' + b.status}</Text>
            <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{'Total ' + money(b.total, b.currency) + ' — Moments ' + money(b.moments_share, b.currency) + ' · partner ' + money(b.partner_share, b.currency)}</Text>
            {b.note ? <Text style={{ color: C.text, fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>{'“' + b.note + '”'}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {b.status === 'reserved' ? <Btn label="Payment received" solid onPress={() => mark(b, 'paid')} /> : null}
              {b.status === 'paid' ? <Btn label="They came" onPress={() => mark(b, 'attended')} /> : null}
              {b.status === 'refund_requested' ? <Btn label="Refund sent" onPress={() => mark(b, 'refunded')} /> : null}
              {b.status === 'reserved' ? <Btn label={sureCancel === b.id ? 'Yes, cancel their booking' : 'Cancel'} danger onPress={() => mark(b, 'cancelled')} /> : null}
              {sureCancel === b.id ? <Btn label="Keep it" onPress={() => setSureCancel(null)} /> : null}
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (form) {
    return (
      <View>
        <Btn label="‹ All offers" onPress={() => { setForm(null); setMsg(null); }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {KINDS.map((k) => <Btn key={k} label={k} solid={form.kind === k} onPress={() => set('kind')(k)} />)}
        </View>
        <Readiness f={form} />
        <Field label="Title (English)" value={form.title} onChange={set('title')} ph="Dahab — three days by the sea" />
        <Field label="Title (Arabic)" value={form.title_ar} onChange={set('title_ar')} />
        <Field label="Run by (operator)" value={form.operator} onChange={set('operator')} ph="TravellersOutdoors" />
        <Field label="Summary (English)" value={form.summary} onChange={set('summary')} multi />
        <Field label="Summary (Arabic)" value={form.summary_ar} onChange={set('summary_ar')} multi />
        <Field label="City" value={form.city} onChange={set('city')} />
        <Field label="Country code" value={form.country} onChange={set('country')} ph="EG" />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginEnd: 8 }}><Field label="Lat" value={form.lat} onChange={set('lat')} num /></View>
          <View style={{ flex: 1 }}><Field label="Lng" value={form.lng} onChange={set('lng')} num /></View>
        </View>
        <Field label="Photos — one per line (real ones only)" value={form.photos} onChange={set('photos')} multi ph="media/welcome-dahab.jpg" />
        <Btn label={busy ? 'Uploading…' : '＋ Upload a photo'} onPress={upload} disabled={busy} />
        <Field label="Video (media/… or a link; plays silently on the trip page)" value={form.video} onChange={set('video')} ph="media/offer-marsa.mp4" />
        <Field label="How long, in hours (shown as “· 7h” on the card; 48 for two days)" value={form.duration} onChange={set('duration')} ph="7" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {lines(form.photos).map((p, i) => <Image key={i} source={{ uri: photoUrl(p) }} style={{ width: 70, height: 70, borderRadius: 8, marginEnd: 6, marginTop: 6, backgroundColor: C.glassHi }} />)}
        </View>
        <Field label="Program — one step per line (English)" value={form.itinerary} onChange={set('itinerary')} multi ph="Day 1 · Leave Cairo 11 pm" />
        <Field label="Program (Arabic)" value={form.itinerary_ar} onChange={set('itinerary_ar')} multi />
        <Field label="Included (English)" value={form.includes} onChange={set('includes')} multi />
        <Field label="Included (Arabic)" value={form.includes_ar} onChange={set('includes_ar')} multi />
        <Field label="Not included (English)" value={form.excludes} onChange={set('excludes')} multi />
        <Field label="Not included (Arabic)" value={form.excludes_ar} onChange={set('excludes_ar')} multi />
        <Field label="Good to know (English)" value={form.good_to_know} onChange={set('good_to_know')} multi />
        <Field label="Good to know (Arabic)" value={form.good_to_know_ar} onChange={set('good_to_know_ar')} multi />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginEnd: 8 }}><Field label="Price" value={form.price} onChange={set('price')} num ph="2800" /></View>
          <View style={{ width: 90, marginEnd: 8 }}><Field label="Currency" value={form.currency} onChange={set('currency')} ph="EGP" /></View>
          <View style={{ flex: 1 }}><Field label="≈ USD" value={form.price_usd} onChange={set('price_usd')} num ph="54" /></View>
        </View>
        <Field label="Plus price (agreed with the partner; empty = none)" value={form.member_price} onChange={set('member_price')} num />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginEnd: 8 }}><Field label="Starts (YYYY-MM-DD HH:MM)" value={form.starts_at} onChange={set('starts_at')} /></View>
          <View style={{ flex: 1 }}><Field label="Ends" value={form.ends_at} onChange={set('ends_at')} /></View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginEnd: 8 }}><Field label="Seats (empty = no limit)" value={form.seats} onChange={set('seats')} num /></View>
          <View style={{ flex: 1, marginEnd: 8 }}><Field label="Free cancel (hours before)" value={form.free_cancel_hours} onChange={set('free_cancel_hours')} num /></View>
          <View style={{ flex: 1 }}><Field label="Commission %" value={form.commission_pct} onChange={set('commission_pct')} num ph="15" /></View>
        </View>
        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 }}>REFLECTION TRIP</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Btn label={(form.track === 'reflection' ? '✓ ' : '') + '🌙 Reflection trip'} solid={form.track === 'reflection'} onPress={() => set('track')(form.track === 'reflection' ? '' : 'reflection')} />
          <Btn label={(form.faith_time ? '✓ ' : '') + '🕊️ Optional quiet time'} solid={form.faith_time} onPress={() => set('faith_time')(!form.faith_time)} />
          <Btn label={(form.track === 'workshop' ? '✓ ' : '') + '🎓 Workshop'} solid={form.track === 'workshop'} onPress={() => set('track')(form.track === 'workshop' ? '' : 'workshop')} />
        </View>
        {form.track === 'workshop' ? (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {['writing', 'poetry', 'dance', 'music', 'singing', 'art', 'languages', 'kids'].map((k) => <Btn key={k} label={(form.topic === k ? '✓ ' : '') + k} solid={form.topic === k} onPress={() => set('topic')(k)} />)}
            </View>
            <Field label="Ages (for children, e.g. 6–12)" value={form.ages} onChange={set('ages')} />
          </View>
        ) : null}
        <Field label="Conditions people agree to before booking (English, one per line)" value={form.conditions} onChange={set('conditions')} multi />
        <Field label="Conditions (Arabic)" value={form.conditions_ar} onChange={set('conditions_ar')} multi />
        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 }}>WHO LEADS IT</Text>
        <LeadersEditor offerId={form.id} />
        <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 }}>HOW PEOPLE PAY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MODES.map((m) => {
            const on = form.pay_modes.indexOf(m) >= 0;
            return <Btn key={m} label={(on ? '✓ ' : '') + (m === 'reserve' ? 'Reserve, pay the organiser' : m === 'at_venue' ? 'Pay at the place' : 'Online (Paymob)')} solid={on}
              onPress={() => set('pay_modes')(on ? form.pay_modes.filter((x) => x !== m) : [...form.pay_modes, m])} />;
          })}
        </View>
        {msg ? <Text style={{ color: /^Not|Could|Add|Set/.test(msg) ? '#E11D48' : C.green, fontSize: 13.5, marginTop: 10 }}>{msg}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          <Btn label={busy ? 'Saving…' : 'Save'} solid onPress={save} disabled={busy} />
        </View>
        <Readiness f={form} />
      </View>
    );
  }

  const online = settings.payments_online === true;
  return (
    <View>
      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Trips, deals and stays people book through Moments. Drafts are only seen here; nothing goes live without a real photo and a price.</Text>
      <Btn label="＋ New offer" solid onPress={() => { tapLight(); setMsg(null); setForm(toForm({})); }} />

      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginTop: 12 }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>Moments Plus</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>Free for everyone until the date below (empty = open-ended). Nobody is charged automatically when it ends.</Text>
        <Field label="Free until (YYYY-MM-DD)" value={freeUntil} onChange={setFreeUntil} ph="empty = no end date yet" />
        <Btn label="Save Plus date" onPress={async () => { const v = freeUntil.trim() ? new Date(freeUntil.trim() + 'T23:59:00').toISOString() : null; const r = await ownerSetSetting('plus_free_until', v); setMsg(r && r.ok ? 'Plus date saved.' : 'Could not save.'); load(); }} />
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 14 }}>Plus price</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>Saving a price ends the free period for everyone: from then on Plus is what people buy (invite and reward days are kept). Clear both to make it free again.</Text>
        <Field label="Per month" value={priceM} onChange={setPriceM} ph="e.g. the monthly price" />
        <Field label="Per year" value={priceY} onChange={setPriceY} ph="e.g. the yearly price" />
        <Field label="Currency (3 letters)" value={priceC} onChange={(v) => setPriceC(v.toUpperCase().slice(0, 3))} ph="EGP" />
        <Btn label="Save Plus price" onPress={async () => {
          const m = Number(priceM), y = Number(priceY);
          const v = priceM.trim() || priceY.trim() ? { month: m, year: y, currency: priceC } : null;
          if (v && (!(m > 0) || !(y > 0) || !/^[A-Z]{3}$/.test(priceC))) { setMsg('Both prices and a 3-letter currency, please.'); return; }
          const r = await ownerSetSetting('plus_price', v); setMsg(r && r.ok ? (v ? 'Plus is now a subscription.' : 'Plus is free again.') : 'Could not save.'); load();
        }} />
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 14 }}>Bookings sheet</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>Each new booking also lands in your team sheet. Paste the web-app address of the sheet (see the bookings-sheet guide).</Text>
        <Field label="Apps Script address" value={hook} onChange={setHook} ph="https://script.google.com/macros/s/…/exec" />
        <Btn label="Save sheet address" onPress={async () => {
          const v = hook.trim() ? hook.trim() : null;
          if (v && !/^https:\/\/script\.google\.com\//.test(v)) { setMsg('That has to be a script.google.com address.'); return; }
          const r = await ownerSetSetting('bookings_sheet_hook', v); setMsg(r && r.ok ? 'Saved.' : 'Could not save.'); load();
        }} />
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900', marginTop: 14 }}>{'Online payments: ' + (online ? 'ON' : 'OFF')}</Text>
        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 3 }}>Turn on only after the Paymob keys are set and a test payment went through.</Text>
        <Btn label={online ? 'Turn off' : 'Turn on'} danger={online} onPress={async () => { const r = await ownerSetSetting('payments_online', !online); setMsg(r && r.ok ? 'Saved.' : 'Could not save.'); load(); }} />
      </View>
      {msg ? <Text style={{ color: C.green, fontSize: 13.5, marginTop: 10 }}>{msg}</Text> : null}
      {party ? <Party offer={party} onClose={() => setParty(null)} /> : null}

      {list.map((o) => (
        <View key={o.id} style={{ borderWidth: 1, borderColor: o.status === 'live' ? C.green : C.line, borderRadius: 14, padding: 12, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {o.photos && o.photos[0] ? <Image source={{ uri: photoUrl(o.photos[0]) }} style={{ width: 52, height: 52, borderRadius: 8, marginEnd: 10 }} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>{o.title}</Text>
              <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{o.status.toUpperCase() + ' · ' + o.kind + ' · ' + money(o.price, o.currency) + (o.seats ? ' · ' + o.seats_taken + '/' + o.seats + ' seats' : '') + (o.wants ? ' · ' + o.wants + ' want to go' : '')}</Text>
            </View>
          </View>
          <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 6 }}>{o.bookings + ' bookings · paid ' + money(o.paid_total, o.currency) + ' — Moments ' + money(o.moments_share, o.currency) + ' · owed to partner ' + money(o.partner_share, o.currency)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Btn label="Edit" onPress={() => { tapLight(); setMsg(null); setForm(toForm(o)); }} />
            <Btn label="Bookings" onPress={() => openBookings(o)} />
            {o.status !== 'live' ? <Btn label="Publish" solid onPress={() => status(o, 'live')} /> : <Btn label="Unpublish" onPress={() => status(o, 'draft')} />}
            {o.status !== 'soon' && o.status !== 'live' ? <Btn label="Coming soon" onPress={() => status(o, 'soon')} /> : null}
            {o.status !== 'closed' ? <Btn label="Close" danger onPress={() => status(o, 'closed')} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
};
