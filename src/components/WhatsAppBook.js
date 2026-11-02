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
const teamNumber = async () => {
  if (cached && Date.now() - cached.at < 5 * 60e3) return cached.n;
  const s = await appSettings();
  const v = s && s.whatsapp_booking;
  const n = typeof v === 'string' && /^[0-9]{8,15}$/.test(v) ? v : null;
  cached = { n, at: Date.now() };
  return n;
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
  const [n, setN] = useState(null);
  const [name, setName] = useState('');
  useEffect(() => {
    let alive = true;
    teamNumber().then((x) => { if (alive) setN(x); });
    if (userId) getProfile(userId).then((p) => { if (alive && p && p.name) setName(p.name); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (!n) return null;
  const open = () => {
    tapMedium();
    const url = 'https://wa.me/' + n + '?text=' + encodeURIComponent(waMessage({ lang, name, title, at }));
    Linking.openURL(url).catch(() => {});
  };
  return (
    <Pressable testID="wa-book" onPress={open} accessibilityRole="link" style={style}>
      <View style={{ borderRadius: 999, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' }}>
        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginStart: 8 }}>{lang === 'ar' ? 'احجز عبر واتساب' : 'Book via WhatsApp'}</Text>
      </View>
    </Pressable>
  );
};

export { AR_DIGITS };
