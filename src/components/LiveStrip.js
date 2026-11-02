import React, { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { lw, timeLeft } from '../constants/loopWords';
import { tapLight } from '../utils/feedback';

/* ─── LIVE MOMENTS ────────────────────────────────────────────────────
   Ayser, November 2026: the feed under this is permanent; this strip is
   the only thing that runs out. The day's photo-prompt answers, newest
   first, each with the hours it has left (posts.expires_at, RUN_ME.sql
   posts_lifetime). When the 48 hours end it leaves the strip and stays
   in its owner's Moments Book. Nothing here opens another app. */
const isVideo = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(u || ''));

export const LiveStrip = ({ items, lang }) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(null);
  if (!items || !items.length) return null;
  const left = open ? timeLeft(lang, open.expiresAt) : null;
  return (
    <View style={{ marginTop: 18 }} testID="live-strip">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral, marginEnd: 7 }} />
        <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '900', letterSpacing: lang === 'ar' ? 0 : 1.3 }}>{lw(lang, 'tab_live')}</Text>
      </View>
      <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>{lw(lang, 'live_sub')}</Text>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {items.map((m) => {
          const t = timeLeft(lang, m.expiresAt);
          const pic = isVideo(m.media) ? (m.thumb || null) : m.media;
          return (
            <Pressable key={m.id} onPress={() => { tapLight(); setOpen(m); }} accessibilityRole="button" accessibilityLabel={(m.user && m.user.name) || ''}
              style={{ width: 96, height: 128, borderRadius: 16, overflow: 'hidden', marginEnd: 8, backgroundColor: '#17131F' }}>
              {pic ? <Image source={{ uri: pic }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : null}
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 7, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <Text numberOfLines={1} style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>{(m.user && m.user.name) || ''}</Text>
              </View>
              {t ? (
                <View style={{ position: 'absolute', top: 6, left: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <Text style={{ color: '#FFF', fontSize: 10.5, fontWeight: '800' }}>{t}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {open && open.media ? (
            isVideo(open.media)
              ? React.createElement('video', { src: open.media, controls: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'contain' } })
              : <Image source={{ uri: open.media }} style={{ flex: 1 }} resizeMode="contain" />
          ) : null}
          <View style={{ position: 'absolute', top: insets.top + 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Image source={{ uri: open && open.user ? open.user.avatar : undefined }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333' }} />
            <View style={{ flex: 1, marginStart: 9 }}>
              <Text numberOfLines={1} style={{ color: '#FFF', fontSize: 14, fontWeight: '900' }}>{open && open.user ? open.user.name : ''}</Text>
              {left ? <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{left}</Text> : null}
            </View>
            <Pressable onPress={() => setOpen(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={lw(lang, 'live_close')}>
              <Ionicons name="close" size={26} color="#FFF" />
            </Pressable>
          </View>
          {open && open.caption ? (
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 24, borderRadius: 14, padding: 12, backgroundColor: 'rgba(0,0,0,0.55)' }}>
              <Text style={{ color: '#FFF', fontSize: 14.5, lineHeight: 21 }}>{open.caption}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};
