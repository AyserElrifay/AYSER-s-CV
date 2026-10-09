import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { pushState, enablePush, disablePush, markAsked } from '../lib/push';
import { tapLight, tapSuccess } from '../utils/feedback';

/* One row that says what is true about notifications on this phone and
   offers the one thing that can be done about it. `ask` is the version
   shown once after joining a plan: a question, with "Not now". */
export const PushRow = ({ ask, onDone, compact }) => {
  const { t, lang } = useLang();
  const [state, setState] = useState(null);     // pushState() | 'busy' | 'not_ready'
  useEffect(() => { let alive = true; pushState().then((s) => { if (alive) setState(s); }); return () => { alive = false; }; }, []);

  if (state === null || state === 'no') return null;
  if (ask && state === 'on') return null;

  const turnOn = async () => {
    tapLight(); setState('busy');
    const r = await enablePush(lang);
    if (r.ok) { tapSuccess(); setState('on'); if (onDone) setTimeout(onDone, 1200); }
    else setState(r.reason === 'denied' ? 'denied' : r.reason === 'ios_install' ? 'ios_install' : 'not_ready');
  };
  const turnOff = async () => { tapLight(); setState('busy'); await disablePush(); setState('off'); };

  const line = state === 'on' ? t('pr_on')
    : state === 'denied' ? t('pr_denied')
    : state === 'ios_install' ? t('pr_ios')
    : state === 'not_ready' ? t('pr_not_ready')
    : ask ? t('pr_ask') : t('pr_title');
  const canOn = state === 'off';

  /* inside the notifications list: one quiet line, and only while there
     is something to do about it */
  if (compact) {
    if (state === 'on') return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
        <Ionicons name="phone-portrait-outline" size={16} color={C.dim} />
        <Text style={{ flex: 1, minWidth: 0, color: C.dim, fontSize: 13, marginHorizontal: 8 }} numberOfLines={2}>{line}</Text>
        {state === 'busy' ? <ActivityIndicator color={C.text} /> : canOn ? (
          <Pressable onPress={turnOn} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', textDecorationLine: 'underline' }}>{t('pr_turn_on')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 }}>
      <Ionicons name={state === 'on' ? 'notifications' : 'notifications-outline'} size={20} color={C.text} />
      <Text style={{ flex: 1, minWidth: 0, color: state === 'off' || state === 'on' ? C.text : C.dim, fontSize: 13.5, fontWeight: state === 'off' ? '700' : '600', marginHorizontal: 10, lineHeight: 19 }}>{line}</Text>
      {state === 'busy' ? <ActivityIndicator color={C.purple} /> : canOn ? (
        <>
          {ask ? (
            <Pressable onPress={() => { tapLight(); markAsked(); onDone && onDone(); }} hitSlop={8} accessibilityRole="button" style={{ marginEnd: 12 }}>
              <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700' }}>{t('pr_not_now')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={turnOn} accessibilityRole="button" style={{ backgroundColor: C.purple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>{t('pr_turn_on')}</Text>
          </Pressable>
        </>
      ) : state === 'on' && !ask ? (
        <Pressable onPress={turnOff} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: C.dim, fontSize: 13, fontWeight: '700' }}>{t('pr_turn_off')}</Text>
        </Pressable>
      ) : ask ? (
        <Pressable onPress={() => { tapLight(); markAsked(); onDone && onDone(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={18} color={C.faint} />
        </Pressable>
      ) : null}
    </View>
  );
};
