import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { appSettings } from '../services/offers';
import { getProfile } from '../services/profiles';
import { tapMedium } from '../utils/feedback';

/* ─── BOOK ON WHATSAPP ────────────────────────────────────────────────
   Ayser, November 2026: while the card gateway waits, a seat can be
   booked by writing to the team on WhatsApp — the message is written for
   you: your name, the trip or Drop, its date. The number is the team's,
   set in the Studio (app setting whatsapp_booking); without one, the
   button is not shown. This is the one door out of the app, and only to
   book. */
let cached = null;
/* who answers: { name, number, backup_name, backup_number } (an old plain number still works) */
export const teamWhatsApp = async () => {
  if (cached && Date.now() - cached.at < 5 * 60e3) return cached.v;
  const st = await appSettings();
  const v = st && st.whatsapp_booking;
  const ok = (n) => typeof n === 'string' && /^[0-9]{8,15}$/.test(n);
  let out = null;
  if (ok(v)) out = { number: v };
  else if (v && typeof v === 'object' && ok(v.number)) out = { name: v.name || '', number: v.number, backup_name: v.backup_name || '', backup_number: ok(v.backup_number) ? v.backup_number : null };
  cached = { v: out, at: Date.now() };
  return out;
};
export const useTeamWhatsApp = () => {
  const [v, setV] = useState(cached ? cached.v : undefined);
  useEffect(() => { let alive = true; teamWhatsApp().then((x) => { if (alive) setV(x); }); return () => { alive = false; }; }, []);
  return v;
};

const AR_DIGITS = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const dayText = (at, lang) => {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo' });
  } catch (e) { return ''; }
};

export const waMessage = ({ lang, name, title, at }) => {
  const d = dayText(at, lang);
  if (lang === 'ar') {
    return 'أهلاً فريق مومنتس، عايز أحجز كرسي في ' + title + (d ? ' يوم ' + d : '') + '.\n'
      + 'اسمي ' + (name || '') + '.\n'
      + 'ابعتولي تفاصيل InstaPay عشان أكمّل الحجز ✦';
  }
  return 'Hello Moments Team, I want to reserve a seat for ' + title + (d ? ' on ' + d : '') + '!\n'
    + 'My name is ' + (name || '') + '.\n'
    + 'Please send me the InstaPay details to complete my booking ✦';
};

export const WhatsAppBook = ({ lang, userId, title, at, style }) => {
  const team = useTeamWhatsApp();
  const [name, setName] = useState('');
  useEffect(() => {
    let alive = true;
    if (userId) getProfile(userId).then((p) => { if (alive && p && p.name) setName(p.name); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (!team) return null;
  const go = (n) => {
    tapMedium();
    Linking.openURL('https://wa.me/' + n + '?text=' + encodeURIComponent(waMessage({ lang, name, title, at }))).catch(() => {});
  };
  return (
    <View style={style}>
      <Pressable testID="wa-book" onPress={() => go(team.number)} accessibilityRole="link">
        <View style={{ borderRadius: 999, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' }}>
          <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginStart: 8 }}>{lang === 'ar' ? 'احجز عبر واتساب' : 'Book via WhatsApp'}</Text>
        </View>
      </Pressable>
      {team.name || team.backup_number ? (
        <Text style={{ color: C.dim, fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>
          {team.name ? (lang === 'ar' ? 'هيرد عليك ' + team.name + ' من مومنتس' : team.name + ' from Moments answers') : ''}
          {team.backup_number ? (team.name ? '  ·  ' : '') : ''}
          {team.backup_number ? (
            <Text testID="wa-backup" onPress={() => go(team.backup_number)} accessibilityRole="link" style={{ color: C.text, fontWeight: '700', textDecorationLine: 'underline' }}>
              {lang === 'ar' ? 'أو كلّم ' + (team.backup_name || 'الفريق') : 'or message ' + (team.backup_name || 'the team')}
            </Text>
          ) : null}
        </Text>
      ) : null}
    </View>
  );
};

export { AR_DIGITS };
