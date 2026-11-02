import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from '../ui/Gradient';
import { useLang } from '../context/LanguageContext';
import { Page } from '../components/Page';
import { ScreenHeader } from '../components/ScreenHeader';
import { lazyOverlay } from '../lib/lazyScreen';
const GameHub = lazyOverlay(() => import('../components/lamma/GameHub').then((m) => ({ default: m.GameHub })));
import { tapLight } from '../utils/feedback';
import { sfxPop } from '../utils/sfx';
import { useNavigation } from '@react-navigation/native';

/* ─── LAMMA, AND NOTHING ELSE ─────────────────────────────────────────
   Ayser, October 2026: the Chill Zone's solo arcade games (Rooftop Rush,
   Stack, The Climb, The Crossing, Rock Paper Scissors, Catch Your Mate),
   the books button and "Films for you" are gone. Moments is for being at
   a table with people, so what is left here is لمّة — the table games
   you play together on your phones, one room code for the whole table.
   The same door is on Together and on Space (LammaCard). */
export const ChillScreen = () => {
  const nav = useNavigation();
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  return (
    <>
      <Page>
        <ScreenHeader kicker={t('chill_kicker')} title={t('lamma_title')} onBack={() => { tapLight(); nav.navigate('TOGETHER'); }} backLabel={t('back')} />
        <Pressable onPress={() => { tapLight(); sfxPop(); setOpen(true); }} accessibilityRole="button" style={{ marginTop: -2, marginBottom: 10 }}>
          <LinearGradient colors={['#2B1055', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#FFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.3 }}>{t('lamma_title')}</Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, marginTop: 2 }}>{t('lamma_tagline')}</Text>
            </View>
            <View style={{ backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: '#5B21B6', fontSize: 13, fontWeight: '900' }}>{t('lamma_start')}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Page>
      {open ? <GameHub onClose={() => { setOpen(false); nav.navigate('TOGETHER'); }} /> : null}
    </>
  );
};
