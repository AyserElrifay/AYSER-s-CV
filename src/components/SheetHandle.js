import React, { useRef } from 'react';
import { View, PanResponder, Animated, Platform } from 'react-native';
import { C } from '../constants/theme';
import { tapLight } from '../utils/feedback';

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

   Native only in the sense that it uses the touch system: there is no
   library here and no gesture handler dependency. */
export const SheetHandle = ({ onClose, height = 320, style, tint }) => {
  const dy = useRef(new Animated.Value(0)).current;
  const start = useRef(0);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    /* only a downward drag; a sideways one belongs to whatever is
       underneath, and an upward one is somebody scrolling */
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 3 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { start.current = Date.now(); },
    onPanResponderMove: (_e, g) => { if (g.dy > 0) dy.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      const far = g.dy > Math.max(90, height * 0.25);
      const flick = g.vy > 0.6 && g.dy > 30;
      if (far || flick) {
        tapLight();
        Animated.timing(dy, { toValue: 600, duration: 160, useNativeDriver: true })
          .start(() => { dy.setValue(0); if (onClose) onClose(); });
      } else {
        Animated.spring(dy, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      }
    },
    onPanResponderTerminate: () => { Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start(); },
  })).current;

  return (
    <Animated.View style={[{ transform: [{ translateY: dy }] }, style]} {...pan.panHandlers}>
      {/* the hit area is the whole strip, not the four pixels of bar —
          a target the width of a finger is the difference between a
          gesture that works and one that works sometimes */}
      <View style={{ paddingTop: 8, paddingBottom: 10, alignItems: 'center' }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: tint || C.line }} />
      </View>
    </Animated.View>
  );
};
