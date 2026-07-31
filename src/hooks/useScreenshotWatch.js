import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/* ── SPOTTING A SCREENSHOT, HONESTLY ─────────────────────────────────
   No browser tells a web page that a screenshot was taken. There is no
   event for it on iOS or Android and there isn't going to be one. So
   this watches for the traces a screenshot leaves instead:

     · The page loses focus while still being visible. On an iPhone,
       taking a screenshot hands the screen to the system for a moment —
       the tab stays visible but stops being focused. Switching apps
       looks different: the page goes hidden.
     · The PrintScreen key, and ⌘⇧3 / ⌘⇧4 / ⌘⇧5 on a Mac.

   That catches most of them and will miss some. It never produces a
   false "they screenshotted you" from an ordinary tap, which is the
   part that matters — being wrongly accused is worse than not being
   told.

   Nothing is recorded anywhere until `onShot` decides to; this hook
   only reports what it saw. */
export function useScreenshotWatch(onShot, active = true) {
  const last = useRef(0);

  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    // one notice per two seconds, however many signals arrive
    const fire = (why) => {
      const now = Date.now();
      if (now - last.current < 2000) return;
      last.current = now;
      try { onShot(why); } catch (e) {}
    };

    const onBlur = () => {
      // hidden means they left the app — that isn't a screenshot
      if (typeof document !== 'undefined' && document.hidden) return;
      // a screenshot steals focus for an instant and hands it straight
      // back; a real app switch doesn't come back this fast
      setTimeout(() => {
        if (typeof document === 'undefined') return;
        if (!document.hidden && document.hasFocus()) fire('focus');
      }, 350);
    };

    const onKey = (e) => {
      if (e.key === 'PrintScreen') { fire('key'); return; }
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].indexOf(e.key) >= 0) fire('key');
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keyup', onKey);
    };
  }, [onShot, active]);
}
