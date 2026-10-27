import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Modal, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from '../ui/Gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/LanguageContext';
import { myBookings, photoUrl } from '../services/offers';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── YOUR INVITATION ─────────────────────────────────────────────────
   Ayser: "اللي يشتري الرحلة يجيله invitation". The moment a trip is
   yours it arrives as an invitation, not a receipt: the trip's own
   photo, its name large, its date on one line — and two things you can
   do with it, instead of a door that asks you to sign in: put it in your
   calendar, and bring a friend. The booking code is there, small, for
   the day itself.

   Nothing here is made up: the photo, the name, the date and the place
   are the trip's own; if the trip has no photo the card is the night
   sky colours, not a stock picture. */

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
const icsText = (s) => String(s || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

/* a calendar file the phone opens in its own calendar */
const addToCalendar = (b, title) => {
  const o = b.offer || {};
  if (!o.starts_at || typeof document === 'undefined') return false;
  const start = new Date(o.starts_at);
  const end = o.ends_at ? new Date(o.ends_at) : new Date(start.getTime() + (Number(o.duration_hours) || 3) * 3600000);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moments//Trips//EN', 'BEGIN:VEVENT',
    'UID:' + b.id + '@therealmoments.com', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
    'SUMMARY:' + icsText(title), o.city ? 'LOCATION:' + icsText(o.city) : null,
    'DESCRIPTION:' + icsText('Moments · ' + b.code), 'URL:https://therealmoments.com/?trip=' + o.id,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title), 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  try {
    const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    a.download = 'moments-' + b.code + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return true;
  } catch (e) { return false; }
};

export const TripInvite = ({ bookingId, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [b, setB] = useState(undefined);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let alive = true;
    myBookings().then((list) => { if (alive) setB(list.find((x) => x.id === bookingId) || null); }).catch(() => alive && setB(null));
    return () => { alive = false; };
  }, [bookingId]);

  const o = (b && b.offer) || {};
  const title = ar && o.title_ar ? o.title_ar : o.title;
  const date = o.starts_at ? new Date(o.starts_at).toLocaleString(ar ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : null;
  const invite = async () => {
    tapLight();
    const url = 'https://therealmoments.com/?trip=' + o.id;
    const text = t('inv_share').replace('{title}', title || '');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text, url }); return; }
      if (typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(text + ' ' + url); tapSuccess(); setMsg(t('inv_copied')); }
    } catch (e) { /* closed the share sheet */ }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0C0A12' }}>
        {/* the photo again, blurred, as the room the card sits in */}
        {o.photo ? <Image source={{ uri: photoUrl(o.photo) }} blurRadius={40} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }} resizeMode="cover" /> : null}
        <LinearGradient colors={['rgba(12,10,18,0.35)', 'rgba(12,10,18,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', outlineStyle: 'none' }}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '800', marginEnd: 40 }}>{t('inv_head')}</Text>
        </View>

        {b === undefined ? <ActivityIndicator color="#FFF" style={{ marginTop: 120 }} /> : !b ? (
          <Text style={{ color: '#FFF', textAlign: 'center', marginTop: 120, fontSize: 15 }}>{t('inv_gone')}</Text>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: insets.bottom + 20 }}>
            {/* the card */}
            <View style={{ width: '100%', maxWidth: 360, aspectRatio: 0.72, borderRadius: 30, overflow: 'hidden', backgroundColor: '#2B1A5A', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } }}>
              {o.photo ? <Image source={{ uri: photoUrl(o.photo) }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
                : <LinearGradient colors={['#2B1055', '#7A3B7A', '#E5813F']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} locations={[0.42, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', left: 20, right: 20, bottom: 22, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' }}>{'🎟  ' + t('inv_going')}</Text>
                <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center', lineHeight: 38, marginTop: 6 }} numberOfLines={3}>{title}</Text>
                {date ? <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>{date}</Text> : null}
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>{[o.city, b.qty > 1 ? t('inv_people').replace('{n}', String(b.qty)) : null].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>

            {/* two things to do with it */}
            <View style={{ width: '100%', maxWidth: 360, marginTop: 22 }}>
              {o.starts_at && Platform.OS === 'web' ? (
                <Pressable onPress={() => { tapLight(); if (addToCalendar(b, title)) setMsg(null); }} accessibilityRole="button" style={{ outlineStyle: 'none' }}>
                  <View style={{ borderRadius: 999, backgroundColor: '#FFF', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar-outline" size={18} color="#111" />
                    <Text style={{ color: '#111', fontSize: 16, fontWeight: '900', marginStart: 8 }}>{t('inv_cal')}</Text>
                  </View>
                </Pressable>
              ) : null}
              <Pressable onPress={invite} accessibilityRole="button" style={{ marginTop: 10, outlineStyle: 'none' }}>
                <View style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-add-outline" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', marginStart: 8 }}>{t('inv_friend')}</Text>
                </View>
              </Pressable>
              {msg ? <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{msg}</Text> : null}
              <Text selectable style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', marginTop: 16 }}>{t('inv_code') + '  ' + b.code}</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};
