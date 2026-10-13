import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { listOffers, bookOffer, cancelBooking, myBookings, myPlus, offerWant, photoUrl, money } from '../services/offers';
import { appLink, shareLink, shareNote } from '../utils/share';
import { payBooking } from '../services/payments';
import { remember, recall } from '../lib/offline';
import { tapLight, tapMedium, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { LinearGradient } from 'expo-linear-gradient';
import { HighlightVideo } from './GoOutRail';

const COVER = { trip: ['#0EA5E9', '#7C3AED', '🧳'], stay: ['#F59E0B', '#EF4444', '🏨'], experience: ['#10B981', '#0EA5E9', '🧗'], deal: ['#EC4899', '#F59E0B', '🎟️'], table: ['#F97316', '#EF4444', '🍽️'] };
const Cover = ({ kind, h, flag }) => { const c = COVER[kind] || COVER.trip; return (
  <LinearGradient colors={[c[0], c[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: h, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <Text style={{ fontSize: h * 0.9, position: 'absolute', right: -h * 0.12, bottom: -h * 0.25, opacity: 0.2 }}>{c[2]}</Text>
    <Text style={{ fontSize: h * 0.32 }}>{flag || c[2]}</Text>
  </LinearGradient>); };
const Soon = ({ t }) => (
  <View style={{ alignSelf: 'flex-start', borderRadius: 999, backgroundColor: C.goldSoft, paddingHorizontal: 10, paddingVertical: 4 }}>
    <Text style={{ color: '#8A6400', fontSize: 12.5, fontWeight: '900' }}>{t('bk_soon')}</Text>
  </View>);

/* ─── TRIPS & DEALS ────────────────────────────────────────────────────
   Ayser: "الناس تحجز علي طول من خلالنا … رحله دهب ب2800 … صور وتفاصيل".

   Three layers, one screen:
     · the list — only what the owner published (a draft never shows),
       each with its real photo, price, the Plus price when the partner
       gave one, and seats left as the database counts them;
     · the offer — photos, the program, what is and is not included,
       good to know, the cancellation rule in one line;
     · booking — how many, how to pay (only the ways this offer
       allows), and a total that is a preview: the database prices it.
   And "My bookings", with each booking's code and honest status. */

const KINDS = [null, 'trip', 'deal', 'stay', 'experience'];

/* where a trip is — Egypt or Europe, side by side and in the order the
   database gives them, so neither side is the "main" one */
const EUROPE = new Set(['EE', 'RO', 'IT', 'CZ', 'DE', 'FR', 'ES', 'PT', 'GR', 'AT', 'NL', 'BE', 'PL', 'HU', 'HR', 'SK', 'SI', 'LV', 'LT', 'FI', 'SE', 'DK', 'NO', 'IE', 'CH', 'BG', 'MT', 'CY', 'LU', 'IS', 'GB']);
const regionOf = (o) => (o.country === 'EG' ? 'eg' : EUROPE.has(o.country) ? 'eu' : 'other');
/* "7h", or "2 days" from a day up */
const hoursLabel = (h, t) => { const n = Number(h); return n >= 24 ? t('bk_days').replace('{n}', String(Math.round(n / 24))) : t('bk_hours').replace('{n}', String(n)); };
const flagOf = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...cc.split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)) + ' ' : '');

const when = (iso, lang) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch (e) { return ''; }
};
const pick = (o, field, lang) => (lang === 'ar' && o[field + '_ar'] && (Array.isArray(o[field + '_ar']) ? o[field + '_ar'].length : true) ? o[field + '_ar'] : o[field]);

const PlusCard = ({ plus, t, lang }) => {
  if (!plus || !plus.plus) return null;
  let until = null;
  try { if (plus.free_until) until = new Date(plus.free_until).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long' }); } catch (e) {}
  return (
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 20, padding: 16, marginBottom: 14 }}>
      <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4 }}>MOMENTS PLUS</Text>
      <Text style={{ color: '#F9F9F6', fontSize: 16.5, fontWeight: '900', marginTop: 4 }}>{t('bk_plus_title')}</Text>
      <Text style={{ color: '#C9C9D1', fontSize: 13, lineHeight: 19, marginTop: 4 }}>{t('bk_plus_sub')}</Text>
      {until ? <Text style={{ color: C.gold, fontSize: 12.5, fontWeight: '800', marginTop: 8 }}>{t('bk_plus_until').replace('{date}', until)}</Text> : null}
    </View>
  );
};

const Price = ({ o, t, lang, big }) => {
  const plusPrice = o.member_price != null && Number(o.member_price) < Number(o.price);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Text style={{ color: C.text, fontSize: big ? 22 : 16, fontWeight: '900', textDecorationLine: plusPrice && o.plus ? 'line-through' : 'none', opacity: plusPrice && o.plus ? 0.5 : 1 }}>
          {money(o.price, o.currency, lang)}
        </Text>
        {o.price_usd ? <Text style={{ color: C.dim, fontSize: big ? 14 : 12.5, marginStart: 6 }}>{'≈ $' + Number(o.price_usd)}</Text> : null}
      </View>
      {plusPrice ? (
        <Text style={{ color: '#8A6400', fontSize: big ? 15 : 13, fontWeight: '900', marginTop: 2 }}>{'✦ ' + t('bk_plus_price') + ' ' + money(o.member_price, o.currency, lang)}</Text>
      ) : null}
    </View>
  );
};

const List = ({ title, items, icon, color }) => (items && items.length ? (
  <View style={{ marginTop: 18 }}>
    <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>{String(title).toUpperCase()}</Text>
    {items.map((x, i) => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
        <Ionicons name={icon} size={16} color={color} style={{ marginTop: 2 }} />
        <Text style={{ color: C.text, fontSize: 14.5, lineHeight: 21, marginStart: 9, flex: 1 }}>{x}</Text>
      </View>
    ))}
  </View>
) : null);

const Offer = ({ o, t, lang, onBack, onBooked, user, onNeedSignIn }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const photos = (o.photos || []).map(photoUrl).filter(Boolean);
  const modes = (o.pay_modes || []).filter((m) => m !== 'online' || o.online_ready);
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState(modes[0] || null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const [want, setWant] = useState({ on: !!o.i_want, n: Number(o.wants) || 0 });
  const [note2, setNote2] = useState(null);
  const unit = o.plus && o.member_price != null ? Number(o.member_price) : Number(o.price);
  const max = o.seats_left == null ? 20 : Math.min(20, o.seats_left);
  const full = o.seats_left === 0;

  /* a link that opens this very trip — and counts as your invite for
     whoever makes an account through it */
  const share = async () => {
    tapLight();
    const res = await shareLink({ url: appLink({ trip: o.id, invite: user ? user.id : null }), title: pick(o, 'title', lang),
      text: t('bk_share_text').replace('{title}', pick(o, 'title', lang)) });
    const n = shareNote(res); if (n) { setNote2(n === 'Link copied \u2713' ? t('bk_copied') : n); setTimeout(() => setNote2(null), 2500); }
  };
  const toggleWant = async () => {
    if (busy) return;
    if (!user) { setErr(t('bk_err_signed_out')); return; }
    tapSelection(); setBusy(true); setErr(null);
    const r = await offerWant(o.id, !want.on);
    setBusy(false);
    if (r && r.ok) { if (r.i_want) tapSuccess(); setWant({ on: !!r.i_want, n: Number(r.wants) || 0 }); onBooked && onBooked(); }
    else setErr(t(r && r.reason === 'signed_out' ? 'bk_err_signed_out' : 'bk_err'));
  };

  const book = async () => {
    if (busy || !mode || full) return;
    if (!user) { setErr(t('bk_err_signed_out')); return; }
    tapMedium(); setBusy(true); setErr(null);
    const r = await bookOffer(o.id, qty, mode, note);
    if (!r || !r.ok) {
      const why = r && r.reason;
      setErr(t(['full', 'already', 'started', 'online_off', 'signed_out'].indexOf(why) >= 0 ? 'bk_err_' + why : 'bk_err'));
      setBusy(false); return;
    }
    tapSuccess();
    setDone(r);
    if (r.status === 'pending') {
      const p = await payBooking(r.id);
      if (!p.ok) setErr(t('bk_err_pay'));
    }
    setBusy(false);
    onBooked && onBooked();
  };

  if (done) {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 40, alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={64} color={C.green} />
        <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', marginTop: 12 }}>{t('bk_done_title')}</Text>
        <Text style={{ color: C.dim, fontSize: 14, marginTop: 18 }}>{t('bk_done_code')}</Text>
        <Text selectable style={{ color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginTop: 4 }}>{done.code}</Text>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 10 }}>{money(done.total, done.currency, lang)}</Text>
        <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14, maxWidth: 340 }}>
          {t(done.status === 'pending' ? 'bk_done_paying' : mode === 'at_venue' ? 'bk_done_at_venue' : 'bk_done_reserve')}
        </Text>
        {err ? <Text style={{ color: '#E11D48', fontSize: 13.5, textAlign: 'center', marginTop: 10 }}>{err}</Text> : null}
        <Pressable onPress={() => { tapLight(); onBack('mine'); }} accessibilityRole="button" style={{ marginTop: 26 }}>
          <View style={{ borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28, backgroundColor: C.text }}>
            <Text style={{ color: C.bg, fontSize: 15, fontWeight: '900' }}>{t('bk_tab_mine')}</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 190 }}>
        <View>
          {o.video ? (
            /* the organiser's own video of the place, silent, playing while on screen */
            <View style={{ width, height: 340, backgroundColor: '#000' }}><HighlightVideo uri={photoUrl(o.video)} poster={photos[0]} /></View>
          ) : photos.length ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {photos.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width, height: 300, backgroundColor: C.glassHi }} />)}
            </ScrollView>
          ) : <Cover kind={o.kind} h={260} flag={flagOf(o.country).trim()} />}
          <Pressable onPress={() => { tapLight(); onBack(); }} accessibilityRole="button" accessibilityLabel={t('close')}
            style={{ position: 'absolute', top: insets.top + 10, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Pressable>
          <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('bk_share')}
            style={{ position: 'absolute', top: insets.top + 10, right: 14, height: 40, borderRadius: 20, paddingHorizontal: 14, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="share-outline" size={19} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800', marginStart: 6 }}>{t('bk_share')}</Text>
          </Pressable>
          {note2 ? <View style={{ position: 'absolute', top: insets.top + 58, right: 14, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 260 }}><Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700' }}>{note2}</Text></View> : null}
          {photos.length > 1 && !o.video ? (
            <View style={{ position: 'absolute', bottom: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{'1 / ' + photos.length}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ padding: 18 }}>
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }}>{flagOf(o.country) + (t('bk_kind_' + o.kind) + (o.city ? ' · ' + o.city : '')).toUpperCase()}</Text>
          <Text style={{ color: C.text, fontSize: 25, fontWeight: '900', letterSpacing: -0.3, marginTop: 4 }}>{pick(o, 'title', lang)}</Text>
          {o.partner || o.operator ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 3 }}>{t('bk_by').replace('{name}', o.partner || o.operator)}</Text> : null}
          {o.duration_hours ? <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700', marginTop: 6 }}>{'⏱ ' + hoursLabel(o.duration_hours, t)}</Text> : null}
          {o.starts_at ? (
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginTop: 8 }}>
              {'📅 ' + when(o.starts_at, lang) + (o.ends_at ? ' → ' + when(o.ends_at, lang) : '')}
            </Text>
          ) : null}
          <View style={{ marginTop: 12 }}>{o.status === 'soon' ? <Soon t={t} /> : <Price o={o} t={t} lang={lang} big />}</View>
          {o.seats_left != null ? (
            <Text style={{ color: full ? '#E11D48' : C.dim, fontSize: 13, fontWeight: '800', marginTop: 6 }}>{full ? t('bk_full') : t('bk_seats_left').replace('{n}', String(o.seats_left))}</Text>
          ) : null}
          {pick(o, 'summary', lang) ? <Text style={{ color: C.text, fontSize: 15, lineHeight: 22, marginTop: 14 }}>{pick(o, 'summary', lang)}</Text> : null}
          <List title={t('bk_program')} items={pick(o, 'itinerary', lang)} icon="ellipse" color={C.purple} />
          <List title={t('bk_includes')} items={pick(o, 'includes', lang)} icon="checkmark-circle" color={C.green} />
          <List title={t('bk_excludes')} items={pick(o, 'excludes', lang)} icon="close-circle" color="#E11D48" />
          <List title={t('bk_good')} items={pick(o, 'good_to_know', lang)} icon="information-circle" color={C.dim} />
          {o.status === 'soon' ? null : <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 18 }}>
            {o.free_cancel_hours != null ? t('bk_cancel_free').replace('{h}', String(o.free_cancel_hours)) : t('bk_cancel_ask')}
          </Text>}
          {modes.length > 1 && o.status !== 'soon' ? (
            <View style={{ marginTop: 18 }}>
              {modes.map((m) => (
                <Pressable key={m} onPress={() => { tapSelection(); setMode(m); }} accessibilityRole="radio" accessibilityState={{ selected: mode === m }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <Ionicons name={mode === m ? 'radio-button-on' : 'radio-button-off'} size={20} color={mode === m ? C.purple : C.dim} />
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', marginStart: 10 }}>{t('bk_pay_' + m)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {o.status === 'soon' ? null : <TextInput value={note} onChangeText={setNote} maxLength={300} placeholder={t('bk_note_ph')} placeholderTextColor={C.faint}
            style={{ marginTop: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, color: C.text, fontSize: 14 }} />}
        </View>
      </ScrollView>

      {/* the booking bar — not for something coming soon */}
      {o.status === 'soon' ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.floatSolid, borderTopWidth: 1, borderTopColor: C.line, padding: 14, paddingBottom: insets.bottom + 14 }}>
          <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19 }}>
            {want.n ? t(want.n === 1 ? 'bk_wants_1' : 'bk_wants_n').replace('{n}', String(want.n)) + ' · ' : ''}{t('bk_want_sub')}
          </Text>
          {err ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#E11D48', fontSize: 13, flex: 1 }}>{err}</Text>
              {!user && onNeedSignIn ? <Pressable onPress={() => { tapLight(); onNeedSignIn(); }} accessibilityRole="button"><Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('bk_sign_in')}</Text></Pressable> : null}
            </View>
          ) : null}
          <Pressable onPress={toggleWant} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: want.on }} style={{ marginTop: 10 }}>
            <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: want.on ? 'transparent' : C.purple, borderWidth: 1.5, borderColor: C.purple }}>
              {busy ? <ActivityIndicator color={want.on ? C.purple : '#FFF'} /> : <Text style={{ color: want.on ? C.purple : '#FFF', fontSize: 16, fontWeight: '900' }}>{want.on ? '✓ ' + t('bk_wanted') : t('bk_want')}</Text>}
            </View>
          </Pressable>
        </View>
      ) : <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.floatSolid, borderTopWidth: 1, borderTopColor: C.line, padding: 14, paddingBottom: insets.bottom + 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.dim, fontSize: 13.5, fontWeight: '700' }}>{t('bk_people')}</Text>
          <Pressable onPress={() => { tapSelection(); setQty((q) => Math.max(1, q - 1)); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="−" style={{ marginStart: 12 }}>
            <Ionicons name="remove-circle-outline" size={28} color={qty > 1 ? C.text : C.faint} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', width: 34, textAlign: 'center' }}>{qty}</Text>
          <Pressable onPress={() => { tapSelection(); setQty((q) => Math.min(max, q + 1)); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="+">
            <Ionicons name="add-circle-outline" size={28} color={qty < max ? C.text : C.faint} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.dim, fontSize: 12 }}>{t('bk_total')}</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{money(unit * qty, o.currency, lang)}</Text>
          </View>
        </View>
        {err ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#E11D48', fontSize: 13, flex: 1 }}>{err}</Text>
            {!user && onNeedSignIn ? <Pressable onPress={() => { tapLight(); onNeedSignIn(); }} accessibilityRole="button"><Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('bk_sign_in')}</Text></Pressable> : null}
          </View>
        ) : null}
        <Pressable onPress={book} disabled={busy || !mode || full} accessibilityRole="button" style={{ marginTop: 10 }}>
          <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: busy || !mode || full ? C.glassHi : C.purple }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>{full ? t('bk_full') : t('bk_book')}</Text>}
          </View>
        </Pressable>
      </View>}
    </View>
  );
};

export const TripsSheet = ({ onClose, country, openOn, focus, onNeedSignIn }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState(openOn === 'mine' ? 'mine' : 'browse');
  const [kind, setKind] = useState(null);
  const [offers, setOffers] = useState(() => recall('offers.' + (country || 'all')));
  const [mine, setMine] = useState(null);
  const [plus, setPlus] = useState(null);
  const [open, setOpen] = useState(null);
  const [region, setRegion] = useState(null);
  /* opened from a shared link or a notification: straight to that trip */
  const [focusId, setFocusId] = useState(focus || null);
  useEffect(() => {
    if (!focusId || !offers) return;
    const hit = offers.find((o) => o.id === focusId);
    if (hit) setOpen(hit);
    setFocusId(null);
  }, [focusId, offers]);

  const load = useCallback(() => {
    listOffers(null, country || null).then((r) => { setOffers(r); remember('offers.' + (country || 'all'), r); });
    if (user) { myBookings().then(setMine); myPlus().then(setPlus); } else setMine([]);
  }, [country, user]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (offers || []).filter((o) => (!kind || o.kind === kind) && (!region || regionOf(o) === region)), [offers, kind, region]);
  const regionsHere = useMemo(() => ['eg', 'eu'].filter((r) => (offers || []).some((o) => regionOf(o) === r)), [offers]);
  const kindsHere = useMemo(() => KINDS.filter((k) => !k || (offers || []).some((o) => o.kind === k)), [offers]);

  const cancel = async (b) => {
    tapLight();
    const r = await cancelBooking(b.id);
    if (r && r.ok) { tapSuccess(); myBookings().then(setMine); }
  };
  const payAgain = async (b) => { tapLight(); await payBooking(b.id); };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => (open ? setOpen(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {open ? (
          <Offer o={open} t={t} lang={lang} onBooked={load} user={user} onNeedSignIn={onNeedSignIn}
            onBack={(goTo) => { setOpen(null); if (goTo === 'mine') setTab('mine'); }} />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
            <Pressable onPress={() => { tapLight(); onClose && onClose(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')} style={{ alignSelf: 'flex-start' }}>
              <Ionicons name="chevron-down" size={26} color={C.text} />
            </Pressable>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{'🧳 ' + t('bk_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{t('bk_sub')}</Text>

            <View style={{ flexDirection: 'row', marginTop: 14, marginBottom: 14, backgroundColor: C.glass, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: C.line }}>
              {['browse', 'mine'].map((k) => (
                <Pressable key={k} onPress={() => { tapSelection(); setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: tab === k ? C.text : 'transparent' }}>
                    <Text style={{ color: tab === k ? C.bg : C.dim, fontSize: 14, fontWeight: '800' }}>{t('bk_tab_' + k)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {tab === 'browse' ? (
              <>
                <PlusCard plus={plus} t={t} lang={lang} />
                {regionsHere.length > 1 ? (
                  <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                    {[null].concat(regionsHere).map((r) => (
                      <Pressable key={r || 'all'} onPress={() => { tapSelection(); setRegion(r); }} accessibilityRole="tab" accessibilityState={{ selected: region === r }}
                        style={{ marginEnd: 8, borderRadius: 999, borderWidth: 1, borderColor: region === r ? C.text : C.line, backgroundColor: region === r ? C.text : 'transparent', paddingHorizontal: 14, paddingVertical: 7 }}>
                        <Text style={{ color: region === r ? C.bg : C.text, fontSize: 13.5, fontWeight: '800' }}>{r ? t('bk_region_' + r) : t('bk_everywhere')}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {kindsHere.length > 2 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 12 }}>
                    {kindsHere.map((k) => (
                      <Pressable key={k || 'all'} onPress={() => { tapSelection(); setKind(k); }}
                        style={{ marginEnd: 8, borderRadius: 999, borderWidth: 1, borderColor: kind === k ? C.text : C.line, backgroundColor: kind === k ? C.text : 'transparent', paddingHorizontal: 14, paddingVertical: 7 }}>
                        <Text style={{ color: kind === k ? C.bg : C.text, fontSize: 13.5, fontWeight: '800' }}>{k ? t('bk_kind_' + k) : t('bk_all')}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {offers == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />
                  : !shown.length ? (
                    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 18, padding: 20 }}>
                      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700', textAlign: 'center', lineHeight: 21 }}>{t('bk_empty')}</Text>
                    </View>
                  ) : shown.map((o) => {
                    const ph = photoUrl((o.photos || [])[0]);
                    return (
                      <Pressable key={o.id} onPress={() => { tapLight(); setOpen(o); }} accessibilityRole="button" style={{ marginBottom: 14 }}>
                        <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                          {ph ? <Image source={{ uri: ph }} style={{ width: '100%', height: 190, backgroundColor: C.glassHi }} /> : <Cover kind={o.kind} h={150} flag={flagOf(o.country).trim()} />}
                          {o.video ? <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>▶ video</Text></View> : null}
                          <View style={{ padding: 14 }}>
                            <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '800', letterSpacing: 1 }}>
                              {flagOf(o.country) + (t('bk_kind_' + o.kind) + (o.city ? ' · ' + o.city : '') + (o.starts_at ? ' · ' + when(o.starts_at, lang) : '')).toUpperCase()}
                            </Text>
                            <Text style={{ color: C.text, fontSize: 18, fontWeight: '900', marginTop: 3 }} numberOfLines={2}>{pick(o, 'title', lang)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                              <View style={{ flex: 1 }}>{o.status === 'soon' ? <Soon t={t} /> : <Price o={o} t={t} lang={lang} />}</View>
                              {o.duration_hours ? <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800', marginEnd: 10 }}>{'⏱ ' + hoursLabel(o.duration_hours, t)}</Text> : null}
                              {o.status === 'soon' && Number(o.wants) > 0 ? <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>{t(Number(o.wants) === 1 ? 'bk_wants_1' : 'bk_wants_n').replace('{n}', String(o.wants))}</Text> : null}
                              {o.seats_left != null ? <Text style={{ color: o.seats_left ? C.dim : '#E11D48', fontSize: 12.5, fontWeight: '800' }}>{o.seats_left ? t('bk_seats_left').replace('{n}', String(o.seats_left)) : t('bk_full')}</Text> : null}
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
              </>
            ) : (
              mine == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />
                : !mine.length ? <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 20 }}>{t('bk_mine_empty')}</Text>
                : mine.map((b) => (
                  <View key={b.id} style={{ backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {b.offer.photo ? <Image source={{ uri: photoUrl(b.offer.photo) }} style={{ width: 52, height: 52, borderRadius: 12, marginEnd: 12, backgroundColor: C.glassHi }} /> : null}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{lang === 'ar' && b.offer.title_ar ? b.offer.title_ar : b.offer.title}</Text>
                        <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }}>{[b.offer.starts_at ? when(b.offer.starts_at, lang) : null, '👤 ' + b.qty, money(b.total, b.currency, lang)].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                      <Text selectable style={{ color: C.text, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 }}>{b.code}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={{ color: b.status === 'paid' || b.status === 'attended' ? C.green : b.status === 'cancelled' ? C.faint : C.text, fontSize: 12.5, fontWeight: '800' }}>{t('bk_status_' + b.status)}</Text>
                    </View>
                    {b.status === 'pending' || b.status === 'reserved' || b.status === 'paid' ? (
                      <View style={{ flexDirection: 'row', marginTop: 10 }}>
                        {b.status === 'pending' ? (
                          <Pressable onPress={() => payAgain(b)} accessibilityRole="button" style={{ marginEnd: 16 }}>
                            <Text style={{ color: C.purple, fontSize: 14, fontWeight: '900' }}>{t('bk_pay_now')}</Text>
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => cancel(b)} accessibilityRole="button">
                          <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800' }}>{t('bk_cancel')}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};
