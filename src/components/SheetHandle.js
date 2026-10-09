import React, { useRef } from 'react';
import { View, PanResponder, Animated, Platform } from 'react-native';
import { C } from '../constants/theme';
import { tapLight } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE LITTLE BAR AT THE TOP OF A SHEET ───────────────────────────
   "مهما بعمل swip ما بتنقفلس" — every sheet in this app drew a small
   grey bar at the top, which in every other app on the phone means
   "drag me down to close this". Here it meant nothing: it was four
   pixels of decoration, and swiping it did exactly nothing, which is
   worse than not drawing it at all. A control that looks like a
   control and is not teaches people the app is broken.

   So it drags now. Pull the sheet down more than a quarter of its
   height — or flick it, which is the same intention in less distance —
   and it closes. Let go above that and it springs back, which is the
   feedback that says "yes, this is draggable, you just did not go far
   enough".

   ── AND THE WHOLE SHEET MOVES, NOT THE BAR ─────────────────────────
   The first version translated only itself, so dragging detached four
   pixels of grey from the panel they belong to and left the sheet
   sitting still behind them. The gesture worked and looked broken,
   which is its own kind of wrong.

   On the web the panel is a real element and it is this one's parent,
   so the transform is written straight onto it: the sheet follows the
   finger the way it does everywhere else, and no sheet had to change a
   line to get it. If the parent cannot be reached for any reason it
   falls back to moving itself — the gesture still closes, which is the
   part that matters.

   Native only in the sense that it uses the touch system: there is no
   library here and no gesture handler dependency. */
export const SheetHandle = ({ onClose, height = 320, style, tint }) => {
  const dy = useRef(new Animated.Value(0)).current;
  const self = useRef(null);
  const panel = useRef(null);

  const isWeb = Platform.OS === 'web';

  /* The sheet element itself: this component's own node, one level up.
     Looked up on the first touch rather than on mount, because the
     sheet may still be animating in when this first renders. */
  const findPanel = () => {
    if (!isWeb) return null;
    if (panel.current) return panel.current;
    /* A ref on an Animated.View reaches the DOM node on react-native-web,
       but not on every version, so this never assumes it did. */
    const node = self.current;
    const dom = node && (node.nodeType === 1 ? node : (node._node || node.node || null));
    /* The panel is usually the parent — but a sheet that centres the bar
       in a small wrapper View made the parent that wrapper, and dragging
       moved only the bar while the sheet sat still ("مش راضية تتقفل").
       So: the first ancestor tall enough to be a sheet, not a strip. */
    let el = dom && dom.parentNode;
    for (let i = 0; el && el.nodeType === 1 && i < 4; i++) {
      if ((el.offsetHeight || 0) >= 120) break;
      el = el.parentNode;
    }
    if (el && el.nodeType === 1 && el.style) panel.current = el;
    return panel.current;
  };

  const moveTo = (px, ms) => {
    const el = findPanel();
    if (!el) return false;
    el.style.transition = ms ? 'transform ' + ms + 'ms ease-out' : 'none';
    el.style.transform = px ? 'translate3d(0,' + px + 'px,0)' : '';
    return true;
  };

  const release = () => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    /* only a downward drag; a sideways one belongs to whatever is
       underneath, and an upward one is somebody scrolling */
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 3 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { findPanel(); },
    onPanResponderMove: (_e, g) => {
      if (g.dy <= 0) return;
      if (!moveTo(g.dy, 0)) dy.setValue(g.dy);
    },
    onPanResponderRelease: (_e, g) => {
      const far = g.dy > Math.max(90, height * 0.25);
      const flick = g.vy > 0.6 && g.dy > 30;
      if (far || flick) {
        tapLight();
        /* out of the way first, then gone — closing a sheet that is
           still sitting under the finger reads as a glitch */
        if (moveTo(900, 180)) {
          setTimeout(() => { release(); if (onClose) onClose(); }, 180);
        } else {
          Animated.timing(dy, { toValue: 600, duration: 160, useNativeDriver: true })
            .start(() => { dy.setValue(0); if (onClose) onClose(); });
        }
      } else if (!moveTo(0, 180)) {
        Animated.spring(dy, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    },
    onPanResponderTerminate: () => {
      if (!moveTo(0, 180)) Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <Animated.View
      ref={self}
      style={[isWeb ? null : { transform: [{ translateY: dy }] }, style]}
      {...pan.panHandlers}
    >
      {/* the hit area is the whole strip, not the four pixels of bar —
          a target the width of a finger is the difference between a
          gesture that works and one that works sometimes */}
      <View style={{ paddingTop: 8, paddingBottom: 10, alignItems: 'center' }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: tint || C.line }} />
      </View>
    </Animated.View>
  );
};

/* ─── THE SAME SHEET, FOR THE PHONE'S BACK BUTTON ────────────────────
   A sheet written inline inside a screen — `{open ? <Pressable…` — has
   nowhere to put a hook, because it is not a component of its own.
   This is: it renders nothing and exists so that those sheets answer
   back as well. One line, next to the handle. */
export const SheetBack = ({ onClose }) => {
  useSheetBack(onClose);
  return null;
};
