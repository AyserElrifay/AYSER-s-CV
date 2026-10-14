import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

/* ─── THE PRIVACY SHIELD ──────────────────────────────────────────────
   For the screens that are meant to stay between people — Reflection
   answers, the notes in a time capsule, a view-once photo.

   In the phone apps (iOS/Android) screenshots and screen recording are
   blocked by the system while one of these is on screen
   (expo-screen-capture). A browser cannot do that — no website can stop
   the phone's own screenshot button — so on the web the shield does the
   honest part it can: the moment the page loses focus or is hidden (the
   app switcher, a screen recorder starting, another tab), the content is
   covered, and long-press / right-click saving is turned off. Callers
   draw a cover while `covered` is true.

   `on` lets a screen ask for the shield only while it actually shows
   something private. */

let tags = 0;

export function usePrivacyShield(on = true) {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    if (!on) return undefined;
    if (Platform.OS !== 'web') {
      const tag = 'mm-shield-' + (++tags);
      ScreenCapture.preventScreenCaptureAsync(tag).catch(() => {});
      return () => { ScreenCapture.allowScreenCaptureAsync(tag).catch(() => {}); };
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const hide = () => setCovered(true);
    const check = () => setCovered(document.visibilityState === 'hidden');
    const show = () => setCovered(false);
    const noMenu = (e) => { e.preventDefault(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('contextmenu', noMenu);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('contextmenu', noMenu);
    };
  }, [on]);

  return { covered: on && covered };
}

/* the style that keeps a private block from being selected or dragged
   out on the web (it is ignored by the phone apps) */
export const NO_SAVE = Platform.OS === 'web' ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } : null;
