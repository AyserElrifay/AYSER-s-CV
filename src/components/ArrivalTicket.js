import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tapMedium, tapSuccess } from '../utils/feedback';
import { lookFor } from '../constants/tableWords';
import { FlagBadge } from './TableFlag';
import { pingHost } from '../services/hub';

/* ─── ARRIVAL MODE: THE TICKET ────────────────────────────────────────
   Ayser, November 2026: once you are within 50 m (or say "I'm here"), the
   top of the table's room becomes a boarding pass — your seat, the flag
   to look for, one tap to scan the table's QR — and the table chat, the
   walkie-talkie voice notes and "I'm at the door" are right under it. */
const W = {
  en: { mode: 'ARRIVAL MODE', seat: 'Your seat', look: 'Look for', scan: 'Scan the table QR to unlock', door: "I'm at the door — ping the host", sent: 'Your host knows you are at the door.', close: 'Back to the room' },
  ar: { mode: 'وضع الوصول', seat: 'كرسيك', look: 'دوّر على', scan: 'اعمل scan لـ QR الترابيزة', door: 'أنا على الباب — نبّه المنظّم', sent: 'المنظّم عرف إنك على الباب.', close: 'رجوع للأوضة' },
};
const tw = (lang, k) => W[lang === 'ar' ? 'ar' : 'en'][k];

export const ArrivalTicket = ({ kind, id, lang, room, seat, onScan, onClose }) => {
  const glow = useRef(new Animated.Value(0)).current;
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    a.start(); return () => a.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const border = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,194,51,0.35)', 'rgba(255,194,51,0.95)'] });
  const door = async () => { tapMedium(); const r = await pingHost(kind, id, 'lost', lang === 'ar' ? 'على الباب' : 'At the door'); if (r && r.ok) { tapSuccess(); setSent(true); } };
  return (
    <Animated.View testID="arrival-ticket" style={[{ marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 2, borderColor: border, backgroundColor: '#1E0F45', overflow: 'hidden' }, Platform.OS === 'web' ? { backgroundImage: 'radial-gradient(120% 90% at 50% 0%, rgba(124,58,237,0.55) 0%, rgba(30,15,69,1) 70%)' } : null]}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFC233', fontSize: 11.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 2, flex: 1 }}>{'✦ ' + tw(lang, 'mode')}</Text>
          {onClose ? <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tw(lang, 'close')}><Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" /></Pressable> : null}
        </View>
        <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '800', marginTop: 6 }} numberOfLines={1}>{room && room.title}</Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '700' }}>{tw(lang, 'seat')}</Text>
            <Text testID="ticket-seat" style={{ color: '#FFF', fontSize: 30, fontWeight: '900', marginTop: 2 }}>{seat || '—'}</Text>
          </View>
          {/* the perforation */}
          <View style={{ width: 1, marginHorizontal: 14, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ flex: 1.3 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: '700' }}>{tw(lang, 'look')}</Text>
            <View style={{ marginTop: 6, alignSelf: 'flex-start' }}><FlagBadge cat={room && room.category} no={room && room.table_no} lang={lang} /></View>
            <Text style={{ color: '#FFF', fontSize: 12.5, marginTop: 6 }} numberOfLines={2}>{lookFor(lang, room && room.category, room && room.table_no)}</Text>
          </View>
        </View>
        {room && room.pin ? <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 10 }} numberOfLines={2}>{room.pin}</Text> : null}
        <Pressable testID="ticket-scan" onPress={() => { tapMedium(); onScan && onScan(); }} accessibilityRole="button" style={{ marginTop: 14 }}>
          <View style={{ borderRadius: 999, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFC233' }}>
            <Ionicons name="qr-code-outline" size={18} color="#2A1660" />
            <Text style={{ color: '#2A1660', fontSize: 15.5, fontWeight: '900', marginStart: 8 }}>{tw(lang, 'scan')}</Text>
          </View>
        </Pressable>
        <Pressable testID="ticket-door" onPress={door} disabled={sent} accessibilityRole="button" style={{ marginTop: 8 }}>
          <View style={{ borderRadius: 999, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}>
            <Ionicons name={sent ? 'checkmark' : 'notifications-outline'} size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800', marginStart: 6 }}>{sent ? tw(lang, 'sent') : tw(lang, 'door')}</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
};
