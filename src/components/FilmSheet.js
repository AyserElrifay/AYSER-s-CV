import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { watchOptions } from '../services/films';
import { openPartner } from '../services/broker';
import { tapLight, tapMedium } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── ONE FILM, AND A REASON TO GET TOGETHER ──────────────────────────
   "Remove passive consumption": no 5-star ratings, no reviews to read
   or write. A film here is what it is, where it is legally streamed —
   in your country first, when the catalogue knows — and one bold
   button that turns it into a plan: Watch together. That opens the
   ordinary "start one" form, already filled in with the film. */

export const FilmSheet = ({ film, region, onClose, onWatchTogether }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();
  const options = watchOptions(film, region);
  const known = options.some((o) => o.here);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <View>
            {film.backdrop_url ? (
              <Image source={{ uri: film.backdrop_url }} style={{ width: '100%', height: 210 }} />
            ) : (
              <LinearGradient colors={['#2B2B2B', '#1A1A1A']} style={{ height: 210 }} />
            )}
            <LinearGradient colors={['transparent', C.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} />
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}
              style={{ position: 'absolute', top: insets.top + 8, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={22} color="#FFF" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: -46 }}>
            {film.poster_url ? (
              <Image source={{ uri: film.poster_url }} style={{ width: 96, height: 144, borderRadius: 12, backgroundColor: C.glassHi }} />
            ) : null}
            <View style={{ flex: 1, minWidth: 0, marginStart: 14, justifyContent: 'flex-end' }}>
              <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.3 }}>{film.title}</Text>
              <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 3 }}>
                {[film.year, (film.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {/* the point of a film in this app */}
          <Pressable onPress={() => { tapMedium(); onWatchTogether(film); }} accessibilityRole="button"
            style={{ marginHorizontal: 16, marginTop: 20, backgroundColor: C.purple, borderRadius: 999, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>🍿</Text>
            <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '900', marginStart: 8 }}>{t('film_watch_together')}</Text>
          </Pressable>
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 }}>{t('film_watch_together_sub')}</Text>

          {film.overview ? (
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 21, paddingHorizontal: 16, marginTop: 20 }}>
              {film.overview}
            </Text>
          ) : null}

          {/* where to watch — a link to a service that legally carries it */}
          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 16, marginTop: 22, marginBottom: 4 }}>
            {(known ? t('film_where_here') : t('film_where')).toUpperCase()}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            {options.map((o) => (
              <Pressable key={o.id} accessibilityRole="link"
                onPress={() => { tapLight(); openPartner(user, { id: 'film:' + film.id, partner: o.partner, url: o.url }); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginEnd: 8 }}>
                {o.emoji ? <Text style={{ fontSize: 14, marginEnd: 6 }}>{o.emoji}</Text> : null}
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>{o.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: C.faint, fontSize: 10.5, paddingHorizontal: 16, lineHeight: 15 }}>
            {known ? t('film_where_source') : t('film_where_search')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};
