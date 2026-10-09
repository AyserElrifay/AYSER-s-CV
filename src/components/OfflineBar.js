import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { isOffline, onConnectivity, onOutbox, pending } from '../lib/offline';
import { flushOutbox } from '../services/green';

/* One thin line at the top, only while it is true: you are offline,
   this is what you saw last, and what you tapped will go when you are
   back. When it has gone, it says so once and leaves. */
export const OfflineBar = () => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [off, setOff] = useState(isOffline());
  const [waiting, setWaiting] = useState(pending().length);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    let timer = null;
    const send = () => flushOutbox().then((r) => {
      if (r && r.sent > 0) { setSent(r.sent); clearTimeout(timer); timer = setTimeout(() => setSent(0), 2600); }
    }).catch(() => {});
    send();                                    // anything left from last time
    const a = onConnectivity((online) => { setOff(!online); if (online) send(); });
    const b = onOutbox(setWaiting);
    return () => { a(); b(); clearTimeout(timer); };
  }, []);

  if (!off && !sent) return null;
  const line = off
    ? t('off_bar') + (waiting > 0 ? ' · ' + t('off_waiting').replace('{n}', String(waiting)) : '')
    : t('off_sent').replace('{n}', String(sent));
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, zIndex: 50, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 520 }}>
        <Ionicons name={off ? 'cloud-offline-outline' : 'checkmark'} size={14} color={C.bg} />
        <Text style={{ color: C.bg, fontSize: 12.5, fontWeight: '700', marginStart: 7, flexShrink: 1 }} numberOfLines={2}>{line}</Text>
      </View>
    </View>
  );
};
