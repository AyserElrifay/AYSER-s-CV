import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useLang } from '../context/LanguageContext';

/* ── PUT IT ON YOUR HOME SCREEN ──────────────────────────────────────
   Installed, Moments opens like any other app: its own icon, full
   screen, no address bar, and it comes back where you left it.

   The two platforms need opposite things from us.

   Android and desktop Chrome fire `beforeinstallprompt`, so we can hold
   on to that event and put a real Install button on screen — one tap
   and the system dialog opens.

   iPhone fires nothing, ever. Safari will happily run the app full
   screen once it's on the home screen, but the only way to get it there
   is Share → Add to Home Screen, and nobody finds that by accident. So
   on iPhone the honest thing is to show where the button is and say it
   in one line.

   Either way this asks once. Dismiss it and it stays gone; the same
   thing lives in Settings for whenever you want it. */

const KEY = 'mm_install_hint_v1';

const seen = () => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
};
const remember = () => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, '1'); } catch (e) {}
};

/* Already running as an installed app? Then there's nothing to offer. */
export function isStandalone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    if (window.navigator && window.navigator.standalone) return true;             // iOS
    return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  } catch (e) { return false; }
}

export function isIos() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

/* Chrome hands us the install event before we're mounted, so we grab it
   at module load and keep it. Without this the button would only ever
   work if the event happened to fire late. */
let deferred = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  } catch (e) {}
}

export const InstallPrompt = ({ force = false, onClose }) => {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [canPrompt, setCanPrompt] = useState(!!deferred);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (isStandalone()) return undefined;                 // already installed
    if (!force && seen()) return undefined;

    const t = setTimeout(() => { setCanPrompt(!!deferred); setShow(true); }, force ? 0 : 20000);
    return () => clearTimeout(t);
  }, [force]);

  if (!show) return null;

  const close = () => { tapLight(); remember(); setShow(false); onClose && onClose(); };

  const install = async () => {
    if (!deferred) return;
    tapLight();
    try {
      deferred.prompt();
      const res = await deferred.userChoice;
      if (res && res.outcome === 'accepted') tapSuccess();
    } catch (e) {}
    deferred = null;
    close();
  };

  const ios = isIos();

  return (
    <View style={{
      position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 78,
      backgroundColor: C.float, borderRadius: R + 4, borderWidth: 1, borderColor: C.line,
      padding: 15, zIndex: 90,
      shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image source={{ uri: 'icon-192.png' }} style={{ width: 40, height: 40, borderRadius: 10 }} />
        <View style={{ flex: 1, marginLeft: 11 }}>
          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '900' }}>{t('install_title')}</Text>
          <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 2 }}>{t('install_hint')}</Text>
        </View>
        <Pressable onPress={close} hitSlop={12}>
          <Ionicons name="close" size={19} color={C.faint} />
        </Pressable>
      </View>

      {ios ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassHi, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Ionicons name="share-outline" size={19} color={C.purple} />
            <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginLeft: 9, flex: 1, lineHeight: 18 }}>
              Tap <Text style={{ fontWeight: '900' }}>Share</Text> at the bottom of Safari, then{' '}
              <Text style={{ fontWeight: '900' }}>Add to Home Screen</Text>.
            </Text>
          </View>
          <Pressable onPress={close} style={{ marginTop: 10, alignSelf: 'center' }}>
            <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '800' }}>Got it</Text>
          </Pressable>
        </View>
      ) : canPrompt ? (
        <Pressable onPress={install} style={{ marginTop: 12 }}>
          <View style={{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>Install</Text>
          </View>
        </Pressable>
      ) : (
        <Text style={{ color: C.faint, fontSize: 11.5, marginTop: 10, lineHeight: 17 }}>
          Open your browser's menu and choose <Text style={{ fontWeight: '900' }}>{t('install_app')}</Text> (or
          <Text style={{ fontWeight: '900' }}> {t('add_to_home')}</Text>).
        </Text>
      )}
    </View>
  );
};
