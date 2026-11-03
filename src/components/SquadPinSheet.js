import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import {
  SQUAD_KINDS, SQUAD_UNLOCK, createSquadPin, joinSquadPin, cancelSquadPin, squadLine, squadWhen, hitsFlagship,
} from '../services/squadPins';

/* ─── SQUAD PINS ─────────────────────────────────────────────────────
   Ayser, November 2026: after three real Moments tables you have met
   enough people to fill a padel court. Three faces of one sheet:
     teaser — not unlocked yet: how many tables so far, out of three
     create — what, how many more, when, where (the middle of the map)
     pin    — somebody's pin: what is still needed, join or leave
   It never shows how few have joined; only how many are still needed. */

const W = (lang, en, ar) => (lang === 'ar' ? ar : en);
const N = (lang, n) => (lang === 'ar' ? Number(n).toLocaleString('ar-EG') : String(n));

/* the next 48 hours, on the hour, 7 am to 11 pm — Thursday and Friday
   nights are left out because the weekly tables are on */
const slots = (kind) => {
  const out = [];
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const end = Date.now() + 47 * 3600000;
  while (d.getTime() < end) {
    const h = d.getHours();
    if (h >= 7 && h <= 23 && !hitsFlagship(d, SQUAD_KINDS[kind].mins)) out.push(new Date(d));
    d.setHours(d.getHours() + 1);
  }
  return out;
};

const Chip = ({ on, onPress, children, testID }) => (
  <Pressable testID={testID} onPress={() => { tapSelection(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }}
    style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : 'transparent', paddingHorizontal: 13, paddingVertical: 8, marginEnd: 8, marginBottom: 8 }}>
    {children(on)}
  </Pressable>
);
const Primary = ({ label, onPress, testID, ghost, busy }) => (
  <Pressable testID={testID} onPress={onPress} accessibilityRole="button" disabled={busy}
    style={{ marginTop: 12, borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: ghost ? 'transparent' : C.text, borderWidth: ghost ? 1 : 0, borderColor: C.line, opacity: busy ? 0.6 : 1 }}>
    {busy && !ghost ? <ActivityIndicator color={C.bg} /> : <Text style={{ color: ghost ? C.text : C.bg, fontSize: 15, fontWeight: '800' }}>{label}</Text>}
  </Pressable>
);

export const SquadPinSheet = ({ mode, checkins = 0, pin, center, onClose, onChanged, onRoute }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const nav = useNavigation();
  const [kind, setKind] = useState('padel');
  const [need, setNeed] = useState(2);
  const [at, setAt] = useState(null);
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const times = useMemo(() => slots(kind), [kind]);
  const when = at && times.some((x) => x.getTime() === at.getTime()) ? at : times[0] || null;
  const max = SQUAD_KINDS[kind].max;

  const why = (r) => ({
    locked: W(lang, 'Squad Pins open after 3 Moments tables.', 'السكواد بن بيفتح بعد ٣ ترابيزات مع Moments.'),
    flagship: W(lang, 'Thursday and Friday nights belong to the weekly tables — pick another time.', 'ليلة الخميس والجمعة للترابيزات الأسبوعية — اختار وقت تاني.'),
    one_live: W(lang, 'You already have a live pin. One at a time.', 'عندك بن شغال بالفعل. واحد بس في المرة.'),
    time: W(lang, 'Pick a time in the next two days.', 'اختار وقت في اليومين الجايين.'),
    full: W(lang, 'That squad just filled up.', 'الفرقة لسه كملت.'),
    gone: W(lang, 'That pin has ended.', 'البن ده خلص.'),
    started: W(lang, 'That match has already started.', 'الماتش بدأ خلاص.'),
    signed_out: W(lang, 'Sign in first.', 'سجّل دخول الأول.'),
  }[r] || W(lang, 'That did not go through — try again.', 'محصلش — جرّب تاني.'));

  const drop = async () => {
    if (busy || !when) return;
    if (!center || center.wide) { setErr(W(lang, 'Zoom the map in to the court or café first — the pin goes in the middle.', 'قرّب الخريطة على الملعب أو الكافيه الأول — البن بيتحط في النص.')); return; }
    setBusy(true); setErr(null);
    try {
      const r = await createSquadPin({ kind, need, lat: center.lat, lng: center.lng, place: place.trim(), startsAt: when.toISOString() });
      if (r.ok) { tapSuccess(); onChanged && onChanged(); onClose(); }
      else setErr(why(r.reason));
    } catch (e) { setErr(why()); }
    setBusy(false);
  };

  const act = async (fn) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fn();
      if (r.ok) { tapSuccess(); onChanged && onChanged(); onClose(); }
      else setErr(why(r.reason));
    } catch (e) { setErr(why()); }
    setBusy(false);
  };

  let body = null;
  if (mode === 'teaser') {
    const n = Math.max(0, Math.min(SQUAD_UNLOCK, checkins));
    body = (
      <View testID="squad-teaser">
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed-outline" size={22} color={C.text} />
        </View>
        <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', marginTop: 14 }}>{W(lang, 'Squad Pins', 'سكواد بن')}</Text>
        <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 6 }}>
          {W(lang,
            'Attend 3 Moments Tables to unlock Squad Pins — drop a padel match, a 5v5 or a study table on the map and fill it with people you have met.',
            'احضر ٣ ترابيزات مع Moments وافتح السكواد بن — حط ماتش بادل أو خماسي أو ترابيزة مذاكرة على الخريطة وكمّلها بناس اتعرفت عليهم.')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, marginEnd: i < 2 ? 6 : 0, backgroundColor: i < n ? C.text : C.line }} />
          ))}
        </View>
        <Text testID="squad-count" style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 8 }}>
          {W(lang, `Current: ${n}/${SQUAD_UNLOCK} check-ins`, `لحد دلوقتي: ${N(lang, n)}/${N(lang, SQUAD_UNLOCK)} تشيك إن`)}
        </Text>
        <Primary busy={busy} label={W(lang, 'Find a table this week', 'دوّر على ترابيزة الأسبوع ده')} onPress={() => { tapLight(); onClose(); try { nav.navigate('TOGETHER'); } catch (e) {} }} />
      </View>
    );
  } else if (mode === 'create') {
    body = (
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
        <Text style={{ color: C.text, fontSize: 21, fontWeight: '900' }}>{W(lang, 'Drop a Squad Pin', 'حط سكواد بن')}</Text>
        <Text style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{W(lang, 'It disappears by itself when the match is over.', 'بيختفي لوحده أول ما الماتش يخلص.')}</Text>

        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{W(lang, 'WHAT', 'إيه')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Object.keys(SQUAD_KINDS).map((k) => (
            <Chip key={k} testID={'squad-kind-' + k} on={kind === k} onPress={() => { setKind(k); setNeed((v) => Math.min(v, SQUAD_KINDS[k].max)); }}>
              {(on) => (<>
                <Ionicons name={SQUAD_KINDS[k].icon} size={15} color={on ? C.bg : C.text} />
                <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '800', marginStart: 6 }}>{SQUAD_KINDS[k][lang === 'ar' ? 'ar' : 'en']}</Text>
              </>)}
            </Chip>
          ))}
        </View>

        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 10, marginBottom: 8 }}>{W(lang, 'HOW MANY MORE', 'محتاج كام كمان')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable testID="squad-less" onPress={() => { tapSelection(); setNeed((v) => Math.max(1, v - 1)); }} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="remove" size={18} color={C.text} />
          </Pressable>
          <Text testID="squad-need" style={{ color: C.text, fontSize: 22, fontWeight: '900', minWidth: 48, textAlign: 'center' }}>{N(lang, need)}</Text>
          <Pressable testID="squad-more" onPress={() => { tapSelection(); setNeed((v) => Math.min(max, v + 1)); }} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={18} color={C.text} />
          </Pressable>
          <Text style={{ color: C.dim, fontSize: 12.5, marginStart: 12 }}>{W(lang, `up to ${max}`, `لحد ${N(lang, max)}`)}</Text>
        </View>

        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{W(lang, 'WHEN', 'إمتى')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {times.map((x) => (
            <Chip key={x.getTime()} on={when && when.getTime() === x.getTime()} onPress={() => setAt(x)}>
              {(on) => <Text style={{ color: on ? C.bg : C.text, fontSize: 13, fontWeight: '700' }}>{squadWhen(x.toISOString(), lang)}</Text>}
            </Chip>
          ))}
        </ScrollView>
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{W(lang, 'Thursday and Friday nights are for the weekly tables.', 'ليلة الخميس والجمعة للترابيزات الأسبوعية.')}</Text>

        <Text style={{ color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 }}>{W(lang, 'WHERE', 'فين')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="locate-outline" size={16} color={C.dim} />
          <Text style={{ color: C.dim, fontSize: 12.5, marginStart: 6, flex: 1 }}>{W(lang, 'The pin goes in the middle of the map — move the map first to choose the spot.', 'البن هيتحط في نص الخريطة — حرّك الخريطة الأول لو عايز مكان تاني.')}</Text>
        </View>
        <TextInput
          testID="squad-place" value={place} onChangeText={setPlace} maxLength={60}
          placeholder={W(lang, 'Court or café name (optional)', 'اسم الملعب أو الكافيه (اختياري)')} placeholderTextColor={C.faint}
          style={{ marginTop: 10, color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}
        />
        {err ? <Text style={{ color: C.coral, fontSize: 12.5, marginTop: 10 }}>{err}</Text> : null}
        <Primary busy={busy} testID="squad-drop" label={when ? W(lang, 'Drop the pin', 'حط البن') + ' · ' + squadWhen(when.toISOString(), lang) : W(lang, 'No free time in the next two days', 'مفيش وقت فاضي في اليومين الجايين')} onPress={drop} />
      </ScrollView>
    );
  } else if (pin) {
    const k = SQUAD_KINDS[pin.kind] || SQUAD_KINDS.padel;
    body = (
      <View testID="squad-pin">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={k.icon} size={21} color={C.bg} />
          </View>
          <View style={{ marginStart: 12, flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 19, fontWeight: '900' }}>{k[lang === 'ar' ? 'ar' : 'en']}</Text>
            {pin.place_name ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{pin.place_name}</Text> : null}
          </View>
        </View>
        <Text testID="squad-line" style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 16 }}>{squadLine(pin, lang)}</Text>
        {pin.host_name ? <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 4 }}>{W(lang, 'Dropped by ', 'حطّه ') + pin.host_name + W(lang, ' · after 3 Moments tables', ' · بعد ٣ ترابيزات مع Moments')}</Text> : null}
        {pin.in ? <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 8 }}>{W(lang, 'You are in. Meet at the pin on time.', 'إنت معاهم. اتقابلوا عند البن في المعاد.')}</Text> : null}
        {err ? <Text style={{ color: C.coral, fontSize: 12.5, marginTop: 10 }}>{err}</Text> : null}
        {pin.mine ? (
          <Primary busy={busy} testID="squad-cancel" ghost label={W(lang, 'Take the pin down', 'شيل البن')} onPress={() => act(() => cancelSquadPin(pin.id))} />
        ) : pin.in ? (
          <Primary busy={busy} testID="squad-leave" ghost label={W(lang, 'I can’t make it', 'مش هقدر آجي')} onPress={() => act(() => joinSquadPin(pin.id, false))} />
        ) : Number(pin.left) > 0 ? (
          <Primary busy={busy} testID="squad-join" label={W(lang, 'I’m in', 'أنا جاي')} onPress={() => act(() => joinSquadPin(pin.id, true))} />
        ) : null}
        <Primary busy={busy} ghost label={W(lang, 'Moments route', 'الطريق على Moments')} onPress={() => { tapLight(); onRoute && onRoute(pin); onClose(); }} />
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
          <SheetHandle onClose={onClose} />
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
