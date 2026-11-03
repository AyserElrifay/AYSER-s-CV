import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useSheetBack } from '../hooks/useSheetBack';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import {
  myHosting, hostRoster, hostCheckin, hostImHere, hostPingDone, hereNow, myWallet, requestPayout,
  pingHost, eventHostHere, rateEvent, myEventRating,
} from '../services/hub';

import { HostQr } from './StampKit';
import { hubRequested, hubTaken } from '../lib/hubLink';   // this file is only ever loaded lazily

/* ─── THE ORGANIZER HUB ───────────────────────────────────────────────
   Ayser, November 2026: the people who run a table or a trip run it from
   here — who is coming and who paid, who arrived, a check-in by hand,
   "I'm here", the pings from people who cannot find the table, and the
   wallet. Everything is decided on the server (RUN_ME.sql, THE
   ORGANIZER HUB); this only shows it. */
const W = {
  en: {
    title: 'Organizer Hub', events: 'Your events', wallet: 'Wallet', none: 'Nothing to run yet. When the team puts you on a Drop or a trip, it shows here.',
    going: 'coming', paid: 'paid', arrived: 'arrived', checked: 'checked in', stars: 'rating',
    here: "I'm here", hereDone: "You're marked here", hereWhy: 'Tells the people coming that you are at the table, and guides them to your pin (from an hour before until the end). Nobody sees it after.',
    qr: 'Show the table QR', pings: 'Pings', noPings: 'No pings.', done: 'Done', people: 'People', noPeople: 'Nobody yet.',
    lost: "can't find the table", late: 'is running late', sos: 'SOS — needs help now',
    statusPaid: 'Paid', statusReserved: 'Reserved', statusJoined: 'Joined', statusAttended: 'Attended', arrivedTag: 'Arrived',
    checkin: 'Check in', undo: 'Undo', back: 'Back', err: 'That did not go through. Try again.', notNow: 'Check-in by hand opens 2 hours before.',
    unlocked: 'Ready to pay out', waiting: 'Waiting for ratings', paidOut: 'Paid to you', balance: 'Balance',
    rule: 'You earn {r} EGP for every person who really checked in. An event unlocks once 3 or more people rated it and the average is 4.2★ or more. Moments pays out from the Studio; every payout is written below.',
    noRate: 'The team has not set the amount per person yet — your check-ins are counted and will be paid at that amount once it is set.',
    payouts: 'Payouts', scanned: '{n} checked in', locked: 'locked', open: 'unlocked', egp: 'EGP',
    next: 'NEXT UP', confirmed: '{n}/{s} confirmed', confirmedN: '{n} confirmed', beacon: 'Table beacon', beaconSub: 'Marks you here and shows the QR',
    roster: 'Live roster', rosterSub: 'Check people in', later: 'Coming up', archive: 'Past events', nothingNext: 'No event coming up. Past ones are below.',
    available: 'Available for payout', pending: 'Pending rating', ask: 'Request payout via InstaPay', askHint: 'Your InstaPay address', send: 'Send request',
    asked: 'Requested {a} EGP to {to}. The team pays from the Studio.', nothing: 'Nothing to pay out yet.', earnings: 'Earnings',
  },
  ar: {
    title: 'لوحة المنظّم', events: 'فعالياتك', wallet: 'المحفظة', none: 'لسه مفيش حاجة تنظّمها. لما الفريق يحطّك على Drop أو رحلة، هتظهر هنا.',
    going: 'جايين', paid: 'دفعوا', arrived: 'وصلوا', checked: 'سجّلوا حضور', stars: 'التقييم',
    here: 'أنا وصلت', hereDone: 'متسجّل إنك وصلت', hereWhy: 'بيعرّف اللي جايين إنك على الترابيزة، وبيرشدهم لمكانك (من ساعة قبل لحد ما تخلص). محدّش بيشوفه بعدها.',
    qr: 'اعرض QR الترابيزة', pings: 'التنبيهات', noPings: 'مفيش تنبيهات.', done: 'تمام', people: 'الناس', noPeople: 'لسه محدّش.',
    lost: 'مش لاقي الترابيزة', late: 'هيتأخر', sos: 'SOS — محتاج مساعدة دلوقتي',
    statusPaid: 'دفع', statusReserved: 'حاجز', statusJoined: 'منضم', statusAttended: 'حضر', arrivedTag: 'وصل',
    checkin: 'سجّل حضوره', undo: 'رجوع', back: 'رجوع', err: 'ماتمّتش. جرّب تاني.', notNow: 'تسجيل الحضور باليد بيفتح قبلها بساعتين.',
    unlocked: 'جاهز للصرف', waiting: 'مستني التقييمات', paidOut: 'اتصرفلك', balance: 'الرصيد',
    rule: 'بتاخد {r} جنيه عن كل شخص سجّل حضور فعلاً. الفعالية بتتفتح لما ٣ أو أكتر يقيّموها ويبقى المتوسط ٤٫٢★ أو أكتر. مومنتس بتصرف من الستوديو، وكل صرفة مكتوبة تحت.',
    noRate: 'الفريق لسه ماحدّدش المبلغ عن كل شخص — الحضور بيتعدّ وهيتصرف بالمبلغ ده أول ما يتحدّد.',
    payouts: 'الصرفات', scanned: '{n} سجّلوا حضور', locked: 'مقفول', open: 'مفتوح', egp: 'جنيه',
    next: 'الجاي', confirmed: '{n}/{s} مأكّدين', confirmedN: '{n} مأكّدين', beacon: 'إشارة الترابيزة', beaconSub: 'بتسجّل إنك وصلت وبتفتح الـ QR',
    roster: 'قايمة الحضور', rosterSub: 'سجّل حضور الناس', later: 'بعد كده', archive: 'فعاليات فاتت', nothingNext: 'مفيش فعالية جاية. اللي فاتت تحت.',
    available: 'متاح للصرف', pending: 'مستني التقييم', ask: 'اطلب الصرف على InstaPay', askHint: 'عنوان InstaPay بتاعك', send: 'ابعت الطلب',
    asked: 'طلبت {a} جنيه على {to}. الفريق بيصرف من الستوديو.', nothing: 'لسه مفيش حاجة للصرف.', earnings: 'الأرباح',
  },
};
const hw = (lang, k, v) => { let s = W[lang === 'ar' ? 'ar' : 'en'][k] || W.en[k] || k; Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); }); return s; };
const when = (at, lang) => { try { return new Date(at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }); } catch (e) { return ''; } };
const money = (n) => String(Math.round(Number(n) || 0));

const Stat = ({ n, label }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={[{ color: C.text, fontSize: 20, fontWeight: '900' }, NUM]}>{n == null ? '—' : n}</Text>
    <Text style={{ color: C.dim, fontSize: 11.5, marginTop: 2 }}>{label}</Text>
  </View>
);

const EventView = ({ ev, lang, onBack }) => {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [qr, setQr] = useState(false);
  const load = () => hostRoster(ev.kind, ev.id).then((x) => setR(x && x.ok ? x : { ok: false }));
  useEffect(() => { load(); const h = setInterval(load, 20000); return () => clearInterval(h); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const e = (r && r.event) || ev;
  const here = async () => {
    tapMedium(); setBusy('here'); setNote(null);
    const at = await hereNow();
    const x = await hostImHere(ev.kind, ev.id, at && at.lat, at && at.lng);
    if (x && x.ok) { tapSuccess(); load(); } else setNote(x && x.reason === 'not_now' ? hw(lang, 'notNow') : hw(lang, 'err'));
    setBusy(null);
  };
  const toggle = async (p) => {
    tapLight(); setBusy(p.id); setNote(null);
    const x = await hostCheckin(ev.kind, ev.id, p.id, !p.checked);
    if (x && x.ok) load(); else setNote(x && x.reason === 'not_now' ? hw(lang, 'notNow') : hw(lang, 'err'));
    setBusy(null);
  };
  const done = async (pg) => { tapLight(); await hostPingDone(pg.id); load(); };
  const status = (s) => hw(lang, s === 'paid' ? 'statusPaid' : s === 'attended' ? 'statusAttended' : s === 'joined' ? 'statusJoined' : 'statusReserved');
  const open = ((r && r.pings) || []).filter((p) => !p.done);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 60 }}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{hw(lang, 'back')}</Text>
      </Pressable>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', marginTop: 10 }}>{e.title}</Text>
      <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 4 }}>{when(e.starts_at, lang)}</Text>
      <View style={{ flexDirection: 'row', marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, paddingVertical: 14 }}>
        <Stat n={e.going} label={hw(lang, 'going')} />
        {e.paid != null ? <Stat n={e.paid} label={hw(lang, 'paid')} /> : null}
        <Stat n={e.arrived} label={hw(lang, 'arrived')} />
        <Stat n={e.checked} label={hw(lang, 'checked')} />
        <Stat n={e.stars ? e.stars + '★' : null} label={hw(lang, 'stars')} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        <Pressable testID="hub-here" onPress={here} disabled={busy === 'here'} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
          <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: e.here ? C.glassHi : C.purple }}>
            {busy === 'here' ? <ActivityIndicator color={e.here ? C.text : '#FFF'} /> : <Ionicons name={e.here ? 'checkmark-circle' : 'location'} size={16} color={e.here ? C.text : '#FFF'} />}
            <Text style={{ color: e.here ? C.text : '#FFF', fontSize: 14, fontWeight: '800', marginStart: 6 }}>{hw(lang, e.here ? 'hereDone' : 'here')}</Text>
          </View>
        </Pressable>
        <Pressable testID="hub-qr" onPress={() => { tapLight(); setQr(true); }} accessibilityRole="button" style={{ flex: 1 }}>
          <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: C.text }}>
            <Ionicons name="qr-code-outline" size={16} color={C.text} />
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginStart: 6 }}>{hw(lang, 'qr')}</Text>
          </View>
        </Pressable>
      </View>
      <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{hw(lang, 'hereWhy')}</Text>
      {note ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{note}</Text> : null}

      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 22 }}>{hw(lang, 'pings').toUpperCase() + (open.length ? '  ·  ' + open.length : '')}</Text>
      {!r ? <ActivityIndicator color={C.purple} style={{ marginTop: 12 }} /> : !open.length ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 8 }}>{hw(lang, 'noPings')}</Text> : open.map((p) => (
        <View key={p.id} testID="hub-ping" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, borderRadius: 14, padding: 12, backgroundColor: p.reason === 'sos' ? C.coral : C.glass, borderWidth: p.reason === 'sos' ? 0 : 1, borderColor: C.line }}>
          <Ionicons name={p.reason === 'sos' ? 'alert-circle' : p.reason === 'late' ? 'time-outline' : 'help-circle-outline'} size={20} color={p.reason === 'sos' ? '#FFF' : C.text} />
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ color: p.reason === 'sos' ? '#FFF' : C.text, fontSize: 14, fontWeight: '800' }}>{(p.name || '') + ' ' + hw(lang, p.reason)}</Text>
            {p.body ? <Text style={{ color: p.reason === 'sos' ? '#FFF' : C.dim, fontSize: 13, marginTop: 2 }}>{p.body}</Text> : null}
          </View>
          <Pressable onPress={() => done(p)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: p.reason === 'sos' ? '#FFF' : C.text, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' }}>{hw(lang, 'done')}</Text>
          </Pressable>
        </View>
      ))}

      <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 22 }}>{hw(lang, 'people').toUpperCase()}</Text>
      {r && r.ok && !(r.people || []).length ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 8 }}>{hw(lang, 'noPeople')}</Text> : null}
      {((r && r.people) || []).map((p) => (
        <View key={p.id} testID="hub-person" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
          {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.glassHi }} />
            : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.glassHi, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.text, fontWeight: '800' }}>{(p.name || '?')[0]}</Text></View>}
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: p.status === 'paid' || p.status === 'attended' ? C.green : C.dim, fontSize: 12, marginTop: 2 }}>{status(p.status) + (p.arrived ? '  ·  ' + hw(lang, 'arrivedTag') : '')}</Text>
          </View>
          <Pressable onPress={() => toggle(p)} disabled={busy === p.id} accessibilityRole="button" hitSlop={6}>
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: p.checked ? C.green : 'transparent', borderWidth: p.checked ? 0 : 1, borderColor: C.text, flexDirection: 'row', alignItems: 'center' }}>
              {busy === p.id ? <ActivityIndicator size="small" color={p.checked ? '#FFF' : C.text} /> : <Ionicons name={p.checked ? 'checkmark' : 'log-in-outline'} size={14} color={p.checked ? '#FFF' : C.text} />}
              <Text style={{ color: p.checked ? '#FFF' : C.text, fontSize: 12.5, fontWeight: '800', marginStart: 5 }}>{p.checked ? hw(lang, 'checked') : hw(lang, 'checkin')}</Text>
            </View>
          </Pressable>
        </View>
      ))}
      {qr ? <HostQr kind={ev.kind} id={ev.id} onClose={() => setQr(false)} /> : null}
    </ScrollView>
  );
};

const IP_KEY = 'mm.instapay';
const Wallet = ({ lang }) => {
  const [w, setW] = useState(null);
  const [ask, setAsk] = useState(false);
  const [addr, setAddr] = useState(() => { try { return localStorage.getItem(IP_KEY) || ''; } catch (e) { return ''; } });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const load = () => myWallet().then((x) => setW(x && x.ok ? x : { ok: false }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />;
  if (!w.ok) return <Text style={{ color: C.dim, margin: 20 }}>{hw(lang, 'err')}</Text>;
  const bal = Math.max(0, (Number(w.unlocked) || 0) - (Number(w.paid) || 0));
  const earned = (w.events || []).filter((e) => Number(e.earned) > 0);
  const send = async () => {
    const a = addr.trim(); if (a.length < 3) return;
    tapMedium(); setBusy(true); setNote(null);
    try { localStorage.setItem(IP_KEY, a); } catch (e) {}
    const r = await requestPayout(a);
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setAsk(false); load(); } else setNote(r && r.reason === 'nothing' ? hw(lang, 'nothing') : hw(lang, 'err'));
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: 60 }}>
      <View style={{ borderRadius: 22, backgroundColor: C.text, padding: 20 }}>
        <Text style={{ color: C.bg, opacity: 0.7, fontSize: 12, fontWeight: '800' }}>{hw(lang, 'available')}</Text>
        <Text testID="hub-balance" style={[{ color: C.bg, fontSize: 36, fontWeight: '900', marginTop: 4 }, NUM]}>{money(bal) + ' ' + hw(lang, 'egp')}</Text>
        <Text style={[{ color: C.bg, opacity: 0.7, fontSize: 13, marginTop: 6 }, NUM]}>{hw(lang, 'pending') + '  ·  ' + money(w.waiting) + ' ' + hw(lang, 'egp')}</Text>
      </View>
      {w.request ? (
        <View testID="hub-asked" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 }}>
          <Ionicons name="checkmark-circle" size={18} color={C.green} />
          <Text style={{ flex: 1, color: C.text, fontSize: 13.5, lineHeight: 19, marginStart: 8 }}>{hw(lang, 'asked', { a: money(w.request.amount), to: w.request.instapay })}</Text>
        </View>
      ) : ask ? (
        <View style={{ marginTop: 12 }}>
          <TextInput testID="hub-instapay" value={addr} onChangeText={setAddr} placeholder={hw(lang, 'askHint')} placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false}
            style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 }} />
          <Pressable testID="hub-send-ask" onPress={send} disabled={busy || addr.trim().length < 3} accessibilityRole="button" style={{ marginTop: 8, opacity: addr.trim().length < 3 ? 0.5 : 1 }}>
            <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.text }}>
              {busy ? <ActivityIndicator color={C.bg} /> : <Text style={{ color: C.bg, fontSize: 15, fontWeight: '800' }}>{hw(lang, 'send')}</Text>}
            </View>
          </Pressable>
        </View>
      ) : (
        <Pressable testID="hub-ask" onPress={() => { tapLight(); if (bal > 0) setAsk(true); else setNote(hw(lang, 'nothing')); }} accessibilityRole="button" style={{ marginTop: 12 }}>
          <View style={{ borderRadius: 999, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.text, opacity: bal > 0 ? 1 : 0.5 }}>
            <Ionicons name="sparkles-outline" size={16} color={C.text} />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginStart: 8 }}>{hw(lang, 'ask')}</Text>
          </View>
        </Pressable>
      )}
      {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{note}</Text> : null}
      <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 12 }}>{w.rate != null ? hw(lang, 'rule', { r: money(w.rate) }) : hw(lang, 'noRate')}</Text>
      {earned.length ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 22 }}>{hw(lang, 'earnings').toUpperCase()}</Text> : null}
      {earned.map((e) => (
        <View key={e.kind + e.id} testID="hub-earning" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flex: 1, marginEnd: 10 }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{e.title}</Text>
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{when(e.starts_at, lang) + '  ·  ' + hw(lang, 'scanned', { n: e.scanned }) + (e.stars ? '  ·  ' + e.stars + '★' : '')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ color: C.text, fontSize: 15, fontWeight: '800' }, NUM]}>{money(e.earned)}</Text>
            <Text style={{ color: e.unlocked ? C.green : C.faint, fontSize: 11, fontWeight: '700' }}>{hw(lang, e.unlocked ? 'open' : 'pending')}</Text>
          </View>
        </View>
      ))}
      {(w.payouts || []).length ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 22 }}>{hw(lang, 'payouts').toUpperCase()}</Text> : null}
      {(w.payouts || []).map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Text style={{ flex: 1, color: C.dim, fontSize: 13 }}>{when(p.at, lang) + (p.note ? '  ·  ' + p.note : '')}</Text>
          <Text style={[{ color: C.text, fontSize: 14, fontWeight: '800' }, NUM]}>{money(p.amount)}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

/* Thursday, Friday or Saturday in Cairo */
const weekend = (at) => { try { const d = new Date(at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Africa/Cairo' }); return d === 'Thu' || d === 'Fri' || d === 'Sat'; } catch (e) { return false; } };
const seatsLine = (e, lang) => (e.seats ? hw(lang, 'confirmed', { n: e.going, s: e.seats }) : hw(lang, 'confirmedN', { n: e.going }));

const Row = ({ e, lang, onPress }) => (
  <Pressable testID="hub-event" onPress={() => { tapLight(); onPress(e); }} accessibilityRole="button">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flex: 1, marginEnd: 10 }}>
        <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{e.title}</Text>
        <Text style={[{ color: C.dim, fontSize: 12, marginTop: 2 }, NUM]}>{when(e.starts_at, lang) + '  ·  ' + seatsLine(e, lang) + (e.stars ? '  ·  ' + e.stars + '★' : '')}</Text>
      </View>
      {e.sos ? <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 8, paddingVertical: 3, marginEnd: 6 }}><Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>SOS</Text></View> : null}
      <Ionicons name="chevron-forward" size={16} color={C.faint} />
    </View>
  </Pressable>
);

const Events = ({ list, lang, onOpen }) => {
  const [beacon, setBeacon] = useState(null);
  const [past, setPast] = useState(false);
  if (list == null) return <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />;
  if (!list.length) return <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, margin: 20 }}>{hw(lang, 'none')}</Text>;
  const now = Date.now();
  const coming = list.filter((e) => new Date(e.ends_at).getTime() > now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const done = list.filter((e) => new Date(e.ends_at).getTime() <= now).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  const next = coming.find((e) => weekend(e.starts_at)) || coming[0] || null;
  const rest = coming.filter((e) => e !== next);
  const light = async (e) => { tapMedium(); const at = await hereNow(); hostImHere(e.kind, e.id, at && at.lat, at && at.lng); setBeacon(e); };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {next ? (
        <View testID="hub-next" style={{ borderRadius: 24, backgroundColor: C.text, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: C.bg, opacity: 0.6, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.4 }}>{hw(lang, 'next')}</Text>
            {next.sos ? <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>SOS</Text></View>
              : next.pings ? <View style={{ borderRadius: 999, backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: C.text, fontSize: 11, fontWeight: '900' }}>{next.pings + ' ' + hw(lang, 'pings')}</Text></View> : null}
          </View>
          <Text style={{ color: C.bg, fontSize: 22, fontWeight: '800', marginTop: 8 }} numberOfLines={2}>{next.title}</Text>
          <Text style={{ color: C.bg, opacity: 0.7, fontSize: 13.5, marginTop: 4 }}>{when(next.starts_at, lang)}</Text>
          <Text testID="hub-seats" style={[{ color: C.bg, fontSize: 28, fontWeight: '900', marginTop: 12 }, NUM]}>{seatsLine(next, lang)}</Text>
          <Pressable testID="hub-beacon" onPress={() => light(next)} accessibilityRole="button" style={{ marginTop: 16 }}>
            <View style={{ borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg }}>
              <Ionicons name="flag" size={20} color={C.text} />
              <View style={{ flex: 1, marginStart: 12 }}>
                <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }}>{hw(lang, 'beacon')}</Text>
                <Text style={{ color: C.dim, fontSize: 12, marginTop: 1 }}>{hw(lang, 'beaconSub')}</Text>
              </View>
              <Ionicons name="qr-code-outline" size={20} color={C.text} />
            </View>
          </Pressable>
          <Pressable testID="hub-roster" onPress={() => { tapLight(); onOpen(next); }} accessibilityRole="button" style={{ marginTop: 8 }}>
            <View style={{ borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
              <Ionicons name="list" size={20} color={C.bg} />
              <View style={{ flex: 1, marginStart: 12 }}>
                <Text style={{ color: C.bg, fontSize: 15.5, fontWeight: '800' }}>{hw(lang, 'roster')}</Text>
                <Text style={{ color: C.bg, opacity: 0.65, fontSize: 12, marginTop: 1 }}>{hw(lang, 'rosterSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.bg} />
            </View>
          </Pressable>
        </View>
      ) : <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{hw(lang, 'nothingNext')}</Text>}
      {rest.length ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.2, marginTop: 24 }}>{hw(lang, 'later').toUpperCase()}</Text> : null}
      {rest.map((e) => <Row key={e.kind + e.id} e={e} lang={lang} onPress={onOpen} />)}
      {done.length ? (
        <Pressable testID="hub-archive" onPress={() => { tapLight(); setPast(!past); }} accessibilityRole="button" accessibilityState={{ expanded: past }} style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ flex: 1, color: C.dim, fontSize: 14, fontWeight: '700' }}>{hw(lang, 'archive') + '  ·  ' + done.length}</Text>
            <Ionicons name={past ? 'chevron-up' : 'chevron-down'} size={18} color={C.dim} />
          </View>
        </Pressable>
      ) : null}
      {past ? done.map((e) => <Row key={e.kind + e.id} e={e} lang={lang} onPress={onOpen} />) : null}
      {beacon ? <HostQr kind={beacon.kind} id={beacon.id} onClose={() => setBeacon(null)} /> : null}
    </ScrollView>
  );
};

export const OrganizerHub = ({ onClose, start }) => {
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('events');
  const [list, setList] = useState(null);
  const [ev, setEv] = useState(start || null);
  useSheetBack(ev ? () => setEv(null) : onClose);
  useEffect(() => { myHosting().then((x) => setList(x && x.ok ? x.events || [] : [])); }, [ev]);
  return (
    <Modal visible animationType="slide" onRequestClose={() => (ev ? setEv(null) : onClose())}>
      <View testID="organizer-hub" style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 6, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close"><Ionicons name="chevron-down" size={26} color={C.text} /></Pressable>
          <Text style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: '800', marginStart: 10 }}>{hw(lang, 'title')}</Text>
        </View>
        {ev ? <EventView ev={ev} lang={lang} onBack={() => setEv(null)} /> : (
          <>
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, borderRadius: 999, padding: 4, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }} accessibilityRole="tablist">
              {[['events', hw(lang, 'events')], ['wallet', hw(lang, 'wallet')]].map(([k, label]) => (
                <Pressable key={k} testID={'hub-tab-' + k} onPress={() => { tapLight(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.text : 'transparent' }}>
                    <Text style={{ color: tab === k ? C.bg : C.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {tab === 'wallet' ? <Wallet lang={lang} /> : <Events list={list} lang={lang} onOpen={setEv} />}
          </>
        )}
      </View>
    </Modal>
  );
};

/* ─── FOR THE PEOPLE COMING ── is the organizer there; ping them; SOS */
const P = {
  en: { hereYes: 'Your host is at the table', hereNo: 'Your host has not checked in yet', lost: "I'm here — can't find the table", late: "I'm running late", sos: 'SOS', sent: 'Sent to your host.', sosSent: 'Sent to your host and the Moments team.', slow: 'Just sent — give them a minute.', sosAsk: 'Send an SOS to your host and the Moments team?', yes: 'Send SOS', no: 'Cancel' },
  ar: { hereYes: 'المنظّم على الترابيزة', hereNo: 'المنظّم لسه ماوصلش', lost: 'وصلت ومش لاقي الترابيزة', late: 'هتأخر شوية', sos: 'SOS', sent: 'اتبعت للمنظّم.', sosSent: 'اتبعت للمنظّم ولفريق مومنتس.', slow: 'لسه باعت — استنى دقيقة.', sosAsk: 'تبعت SOS للمنظّم ولفريق مومنتس؟', yes: 'ابعت SOS', no: 'إلغاء' },
};
const pw2 = (lang, k) => P[lang === 'ar' ? 'ar' : 'en'][k];
export const PingHostBar = ({ kind, id, lang, ink = C.bg, onLost }) => {
  const [here, setHere] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => { const f = () => eventHostHere(kind, id).then((x) => x && setHere(x)); f(); const h = setInterval(f, 30000); return () => clearInterval(h); }, [kind, id]);
  const send = async (reason) => {
    tapMedium(); setAsk(false);
    const r = await pingHost(kind, id, reason);
    setMsg(r && r.ok ? pw2(lang, reason === 'sos' ? 'sosSent' : 'sent') : r && r.reason === 'slow_down' ? pw2(lang, 'slow') : hw(lang, 'err'));
    if (r && r.ok) { tapSuccess(); if (reason === 'lost' && onLost) onLost(); }
  };
  return (
    <View testID="ping-host" style={{ marginTop: 12 }}>
      {here ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: here.here ? C.green : C.faint }} />
          <Text style={{ color: ink, fontSize: 12.5, fontWeight: '700', marginStart: 6, opacity: 0.9 }}>{pw2(lang, here.here ? 'hereYes' : 'hereNo')}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {['lost', 'late'].map((k) => (
          <Pressable key={k} testID={'ping-' + k} onPress={() => send(k)} accessibilityRole="button" style={{ marginEnd: 8, marginBottom: 6 }}>
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: ink, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: ink, fontSize: 12.5, fontWeight: '800' }}>{pw2(lang, k)}</Text>
            </View>
          </Pressable>
        ))}
        <Pressable testID="ping-sos" onPress={() => { tapLight(); setAsk(true); }} accessibilityRole="button" style={{ marginBottom: 6 }}>
          <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '900' }}>{pw2(lang, 'sos')}</Text>
          </View>
        </Pressable>
      </View>
      {ask ? (
        <View style={{ marginTop: 6, borderRadius: 14, backgroundColor: C.coral, padding: 12 }}>
          <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>{pw2(lang, 'sosAsk')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Pressable testID="ping-sos-yes" onPress={() => send('sos')} accessibilityRole="button" style={{ marginEnd: 10 }}><View style={{ borderRadius: 999, backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 7 }}><Text style={{ color: C.coral, fontWeight: '900', fontSize: 13 }}>{pw2(lang, 'yes')}</Text></View></Pressable>
            <Pressable onPress={() => setAsk(false)} accessibilityRole="button"><View style={{ paddingHorizontal: 8, paddingVertical: 7 }}><Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{pw2(lang, 'no')}</Text></View></Pressable>
          </View>
        </View>
      ) : null}
      {msg ? <Text style={{ color: ink, fontSize: 12.5, marginTop: 4 }}>{msg}</Text> : null}
    </View>
  );
};

/* after the evening: how was it — only people who really checked in */
const R = { en: { q: 'How was the evening?', thanks: 'Thank you — your host sees the average, never who.', note: 'Anything to tell the team? (optional)' }, ar: { q: 'السهرة كانت عاملة إزاي؟', thanks: 'شكراً — المنظّم بيشوف المتوسط بس، مش مين.', note: 'عايز تقول حاجة للفريق؟ (اختياري)' } };
export const RateEvent = ({ kind, id, lang }) => {
  const [st, setSt] = useState(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => { myEventRating(kind, id).then((x) => { if (x) { setSt(x); if (x.stars) { setStars(x.stars); setSent(true); } } }); }, [kind, id]);
  if (!st || !st.can) return null;
  const L = R[lang === 'ar' ? 'ar' : 'en'];
  const save = async (n) => { tapLight(); setStars(n); const r = await rateEvent(kind, id, n, note.trim()); if (r && r.ok) { tapSuccess(); setSent(true); } };
  return (
    <View testID="rate-event" style={{ marginTop: 20, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16 }}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>{L.q}</Text>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} testID={'rate-' + n} onPress={() => save(n)} accessibilityRole="button" accessibilityLabel={n + '★'} hitSlop={4} style={{ marginEnd: 8 }}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={30} color={n <= stars ? C.gold : C.faint} />
          </Pressable>
        ))}
      </View>
      {stars ? <TextInput value={note} onChangeText={setNote} onBlur={() => stars && rateEvent(kind, id, stars, note.trim())} placeholder={L.note} placeholderTextColor={C.faint} maxLength={300}
        style={{ marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, color: C.text, fontSize: 14, outlineStyle: 'none' }} /> : null}
      {sent ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 8 }}>{L.thanks}</Text> : null}
    </View>
  );
};

/* the way in, on Space: shown only to people who run something */
export const HubEntry = () => {
  const { lang } = useLang();
  const [n, setN] = useState(null);
  // …/?hub=1 (src/lib/hubLink.js) opens it straight away
  const [open, setOpen] = useState(() => { const r = hubRequested(); if (r) hubTaken(); return r; });
  useEffect(() => {
    const f = () => myHosting().then((x) => setN(x && x.ok ? (x.events || []) : []));
    f();
    const go = () => setOpen(true);
    try { window.addEventListener('mm-open-hub', go); } catch (e) {}
    return () => { try { window.removeEventListener('mm-open-hub', go); } catch (e) {} };
  }, []);
  if (!n || !n.length) return open ? <OrganizerHub onClose={() => setOpen(false)} /> : null;
  const pings = n.reduce((s, e) => s + (Number(e.pings) || 0), 0);
  return (
    <>
      <Pressable testID="hub-entry" onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" style={{ marginHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: C.text, padding: 14 }}>
          <Ionicons name="clipboard-outline" size={20} color={C.bg} />
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ color: C.bg, fontSize: 15.5, fontWeight: '800' }}>{hw(lang, 'title')}</Text>
            <Text style={{ color: C.bg, opacity: 0.7, fontSize: 12.5, marginTop: 2 }}>{n.length + ' ' + (lang === 'ar' ? 'فعالية' : n.length === 1 ? 'event' : 'events')}</Text>
          </View>
          {pings ? <View style={{ borderRadius: 999, backgroundColor: C.coral, paddingHorizontal: 8, paddingVertical: 3, marginEnd: 6 }}><Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>{pings}</Text></View> : null}
          <Ionicons name="chevron-forward" size={18} color={C.bg} />
        </View>
      </Pressable>
      {open ? <OrganizerHub onClose={() => { setOpen(false); myHosting().then((x) => setN(x && x.ok ? (x.events || []) : [])); }} /> : null}
    </>
  );
};
