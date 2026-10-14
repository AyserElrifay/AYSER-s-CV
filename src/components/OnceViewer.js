import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Image, Platform, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLang } from '../context/LanguageContext';
import { openOnce, burnOnce } from '../lib/storage';
import { usePrivacyShield, NO_SAVE } from '../hooks/usePrivacyShield';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── A VIEW-ONCE PHOTO OR VIDEO ──────────────────────────────────────
   Opened through the server, once (r2-presign → view_once_open); the
   address it gets lives a minute. A photo stays ten seconds, a video
   plays once. Closing it — or leaving the app — deletes the file from
   storage at once (view_once_burn), and the message says "Opened" for
   both people from then on. Screenshots are blocked in the phone apps;
   on the web the picture is covered the moment the page loses focus. */

const PHOTO_SECONDS = 10;

export const OnceViewer = ({ id, onClose }) => {
  const { t } = useLang();
  const [state, setState] = useState({ phase: 'opening' });   // opening | showing | gone
  const [left, setLeft] = useState(PHOTO_SECONDS);
  const { covered } = usePrivacyShield(true);
  const burned = useRef(false);

  const close = () => {
    if (!burned.current) { burned.current = true; burnOnce(id); }
    onClose();
  };
  useSheetBack(close);

  useEffect(() => {
    let alive = true;
    openOnce(id).then((r) => { if (alive) setState(r.ok ? { phase: 'showing', url: r.url, kind: r.kind } : { phase: 'gone' }); });
    return () => { alive = false; if (!burned.current) { burned.current = true; burnOnce(id); } };
  }, [id]);

  useEffect(() => {
    if (state.phase !== 'showing' || state.kind === 'video') return undefined;
    const tick = setInterval(() => setLeft((n) => { if (n <= 1) { clearInterval(tick); setTimeout(close, 0); return 0; } return n - 1; }), 1000);
    return () => clearInterval(tick);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={[{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, NO_SAVE]}>
        {state.phase === 'opening' ? <ActivityIndicator color="#FFF" /> : state.phase === 'gone' ? (
          <View style={{ alignItems: 'center', padding: 30 }}>
            <Text style={{ fontSize: 40 }}>👀</Text>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>{t('vo_gone')}</Text>
          </View>
        ) : state.kind === 'video' && Platform.OS === 'web' ? (
          <video src={state.url} autoPlay playsInline controls={false} controlsList="nodownload" disablePictureInPicture onEnded={close}
            onContextMenu={(e) => e.preventDefault()} style={{ width: '100%', height: '82%', objectFit: 'contain', pointerEvents: 'none' }} />
        ) : (
          <Image source={{ uri: state.url }} style={{ width: '100%', height: '82%' }} resizeMode="contain" draggable={false} />
        )}

        {covered && state.phase === 'showing' ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="eye-off-outline" size={34} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', marginTop: 8 }}>{t('vo_covered')}</Text>
          </View>
        ) : null}

        <View style={{ position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800', flex: 1 }}>{'🔥 ' + t('vo_once') + (state.phase === 'showing' && state.kind !== 'video' ? ' · ' + left + 's' : '')}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('close')}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
