import { useMemo, useRef } from 'react';
import { Dimensions, PanResponder, Platform } from 'react-native';
import { tapMedium } from '../utils/feedback';

/* ── A SWIPE THAT OPENS THE CAMERA ───────────────────────────────────
   The fastest camera is the one you don't have to aim for. Instagram
   opens it with a swipe from the left edge of the feed; here the chats
   list opens it with a pull down. Same idea: the shot you wanted is
   already gone by the time you've found a button.

   Two things keep this from fighting the lists it sits on:

     · it only claims the gesture once the movement is clearly in its
       direction and clearly not a scroll — three times as much travel
       one way as the other;
     · the pull-down only arms at the very top of the list, so scrolling
       back up through a conversation never trips it.

   `atTop` is a function rather than a value because it's read at the
   moment the gesture starts, not when the hook was created.

   `fromRight` mirrors the edge gesture for Arabic. The feed's near edge
   is the one your reading starts from — the left in English, the right
   in Arabic — and an Arabic reader pulling in from the right is making
   the same movement an English reader makes pulling in from the left.
   Wiring it to the physical left in both would have asked half the
   app's readers to reach across the screen for their own camera. */
export function useSwipeToCamera({ direction = 'down', onTrigger, atTop, enabled = true, fromRight = false }) {
  const fired = useRef(false);

  /* Rebuilt when the side changes. `useRef` would have frozen the
     English side at first render, so switching to Arabic mid-session
     left the gesture on the wrong edge until the app was reopened. */
  const responder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => {
        if (!enabled || Platform.OS !== 'web') return false;
        if (direction === 'down') {
          if (atTop && !atTop()) return false;
          return g.dy > 26 && g.dy > Math.abs(g.dx) * 3;
        }
        // inwards from the near edge. Where the finger STARTED, not
        // where it is now: a quick flick is already past 60px by its
        // first move event, so asking where it is now let every fast
        // swipe through — only a slow drag ever opened the camera.
        // (g.x0 is only filled in once the gesture is ours, so the start
        // is where it is minus how far it came.)
        const from = g.moveX - g.dx;
        if (fromRight) {
          const w = Dimensions.get('window').width;
          return from > w - 60 && g.dx < -26 && -g.dx > Math.abs(g.dy) * 3;
        }
        return from < 60 && g.dx > 26 && g.dx > Math.abs(g.dy) * 3;
      },
      onPanResponderGrant: () => { fired.current = false; },
      onPanResponderMove: (_e, g) => {
        if (fired.current) return;
        const travelled = direction === 'down' ? g.dy : (fromRight ? -g.dx : g.dx);
        // a nudge isn't an intent — 80px is a decision
        if (travelled > 80) {
          fired.current = true;
          tapMedium();
          onTrigger && onTrigger();
        }
      },
      onPanResponderTerminationRequest: () => true,
    }),
    [direction, fromRight, enabled],
  );

  if (!enabled || Platform.OS !== 'web') return {};
  return responder.panHandlers;
}
