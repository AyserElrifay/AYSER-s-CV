import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { myPlus } from '../services/offers';
import { ICONS, currentIcon, setAppIcon, installed } from '../lib/appIcon';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';
import { lazyOverlay } from '../lib/lazyScreen';

/* ─── MAKE MOMENTS YOURS (MOMENTS PLUS) ───────────────────────────────
   Opened by holding the Moments logo on Home. Two things only: the app
   icon (src/lib/appIcon.js) and which small widgets sit at the top of
   Home (HomeWidgets in src/components/MyDay.js). Both are Moments+;
   whether somebody has it is the server's answer (my_plus), not ours. */
const PlusSheet = lazyOverlay(() => import('./PlusSheet').then((m) => ({ default: m.PlusSheet })));
const WIDGETS = [
  { id: 'now', emoji: '🗓️' },
  { id: 'prayer', emoji: '🕌' },
  { id: 'plan', emoji: '🤝' },
  { id: 'note', emoji: '📝' },
];
const readWidgets = () => { try { const v = JSON.parse(localStorage.getItem('mm.widgets') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveWidgets = (v) => {
  try { localStorage.setItem('mm.widgets', JSON.stringify(v)); } catch (e) {}
  try { window.dispatchEvent(new Event('mm-widgets')); } catch (e) {}
};

export const Personalise = ({ onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user } = useAuth();
  const [plus, setPlus] = useState(user ? null : false);      // null = asking
  const [icon, setIcon] = useState(currentIcon);
  const [wid, setWid] = useState(readWidgets);
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    myPlus().then((r) => { if (alive) setPlus(!!(r && r.plus)); }).catch(() => { if (alive) setPlus(false); });
    return () => { alive = false; };
  }, [user]);

  const pickIcon = (id) => { if (!plus) return; tapSelection(); setIcon(id); setAppIcon(id); setCopied(false); };
  const flip = (id) => {
    if (!plus) return;
    tapLight();
    const n = wid.indexOf(id) >= 0 ? wid.filter((x) => x !== id) : WIDGETS.map((w) => w.id).filter((x) => x === id || wid.indexOf(x) >= 0);
    if (n.length > wid.length) tapSuccess();
    setWid(n); saveWidgets(n);
  };
  const locked = plus === false;
  const [plusSheet, setPlusSheet] = useState(false);
  /* on an iPhone a home-screen app keeps its own storage, apart from
     the browser — so the pick travels in the link (?icon=, read first
     thing by the page, scripts/inject-html.mjs) */
  const home = installed();
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    tapLight();
    try { await navigator.clipboard.writeText('https://therealmoments.com/?icon=' + icon); setCopied(true); } catch (e) {}
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 20, maxHeight: '90%' }}>
        <View style={{ alignItems: 'center', marginTop: -6, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.gold, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center' }}>MOMENTS PLUS</Text>
        <Text style={{ color: C.text, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 2 }}>{t('pz_title')}</Text>
        {plus == null ? <ActivityIndicator color={C.dim} style={{ marginTop: 8 }} /> : null}
        {locked ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>{t('pz_plus_only')}</Text>
            <Pressable onPress={() => { tapLight(); setPlusSheet(true); }} accessibilityRole="button" style={{ marginTop: 10 }}>
              <View style={{ borderRadius: 999, backgroundColor: C.gold, paddingHorizontal: 20, paddingVertical: 11 }}>
                <Text style={{ color: '#1A1A1A', fontSize: 14.5, fontWeight: '900' }}>{'✦ ' + t('px_get')}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ marginTop: 12, opacity: plus ? 1 : 0.45 }} pointerEvents={plus ? 'auto' : 'none'}>
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>{t('pz_icon').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {ICONS.map((ic) => {
              const on = icon === ic.id;
              return (
                <Pressable key={ic.id} onPress={() => pickIcon(ic.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t('ic_' + ic.id)} style={{ width: '31.5%', marginBottom: 10 }}>
                  <View style={{ borderRadius: 20, borderWidth: on ? 2 : 1, borderColor: on ? C.purple : C.line, backgroundColor: C.glass, paddingVertical: 14, alignItems: 'center' }}>
                    <Image source={{ uri: ic.file }} style={{ width: 62, height: 62, borderRadius: 14 }} />
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 8 }}>{t('ic_' + ic.id)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18 }}>{t(home ? 'pz_icon_readd' : 'pz_icon_add')}</Text>
          {home ? (
            <Pressable onPress={copyLink} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.purple, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Ionicons name={copied ? 'checkmark' : 'link'} size={15} color={C.purple} />
                <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900', marginStart: 6 }}>{t(copied ? 'pz_copied' : 'pz_copy')}</Text>
              </View>
            </Pressable>
          ) : null}

          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>{t('pz_widgets').toUpperCase()}</Text>
          {WIDGETS.map((w) => {
            const on = wid.indexOf(w.id) >= 0;
            return (
              <Pressable key={w.id} onPress={() => flip(w.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: on ? C.purple : C.line, backgroundColor: on ? C.purpleSoft : C.glass, padding: 12 }}>
                  <Text style={{ fontSize: 20, marginEnd: 12 }}>{w.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('wg_' + w.id + '_name')}</Text>
                    <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{t('wg_' + w.id + '_sub')}</Text>
                  </View>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? C.purple : C.faint} />
                </View>
              </Pressable>
            );
          })}
          <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{t('pz_widgets_sub')}</Text>
        </ScrollView>
      </View>
      {plusSheet ? <PlusSheet why="icons" onClose={() => setPlusSheet(false)} /> : null}
    </Modal>
  );
};
