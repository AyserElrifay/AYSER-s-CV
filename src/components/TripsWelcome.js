import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { fetchHighlights } from '../services/appHighlights';
import { publicMedia } from '../lib/publicMedia';
import { getPrefs } from '../services/prefs';
import { isSaving, DEFAULT_DATA_MODE } from '../lib/dataSaver';
import { tapLight, tapMedium } from '../utils/feedback';

/* ─── WELCOME TO TRIPS ────────────────────────────────────────────────
   Ayser: the real evening on video belongs with the trips — it was
   Dahab — shown the first time somebody opens Trips, with a light blur.
   It is the owner's own highlight (chosen in the Studio, live only once
   everybody in it agreed); with none, a still of Dahab. Shown once per
   phone, then never in the way again. */

const KEY = 'mm.tripsWelcome.v1';
export const seenTripsWelcome = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };

export const TripsWelcome = ({ onDone }) => {
  const { t } = useLang();
  const [clip, setClip] = useState(null);
  const moving = Platform.OS === 'web' && !isSaving((getPrefs() || {}).dataSaver || DEFAULT_DATA_MODE);
  useEffect(() => {
    if (!moving) return;
    fetchHighlights().then((hs) => { const v = (hs || []).find((h) => h.kind === 'video' && h.media_url); if (v) setClip(v); }).catch(() => {});
  }, [moving]);
  const done = () => { tapMedium(); try { localStorage.setItem(KEY, '1'); } catch (e) {} onDone(); };

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000', zIndex: 50 }}>
      {clip ? (
        <video src={clip.media_url} poster={clip.poster_url || undefined} autoPlay muted loop playsInline preload="metadata"
          style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(1.5px)', transform: 'scale(1.03)', pointerEvents: 'none' }} />
      ) : (
        <Image source={{ uri: publicMedia('welcome-dahab.jpg') }} blurRadius={2} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      <Pressable onPress={() => { tapLight(); done(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}
        style={{ position: 'absolute', top: 52, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={22} color="#FFF" />
      </Pressable>
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 46 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '900', letterSpacing: 1.4 }}>{'🧳 ' + t('tw_kicker').toUpperCase()}</Text>
        <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: -0.6, marginTop: 6 }}>{t('tw_title')}</Text>
        {['tw_1', 'tw_2', 'tw_3'].map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
            <Ionicons name="checkmark-circle" size={19} color="#FFF" style={{ marginTop: 1 }} />
            <Text style={{ color: '#FFF', fontSize: 15.5, lineHeight: 21, fontWeight: '600', marginStart: 8, flex: 1 }}>{t(k)}</Text>
          </View>
        ))}
        <Pressable onPress={done} accessibilityRole="button" style={{ marginTop: 22 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ color: '#1A1A1A', fontSize: 16, fontWeight: '900' }}>{t('tw_go')}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};
