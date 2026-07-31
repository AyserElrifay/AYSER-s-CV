import React, { useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useSwipeToCamera } from '../hooks/useSwipeToCamera';

/* Scrollable page shell with safe-area + tab-bar breathing room.

   Pass `onSwipeCamera` and a pull down from the top of the page opens
   the camera — the shot you wanted is usually gone by the time you've
   found a button. It only arms at the very top, so scrolling back up
   through a long page never trips it. */
export const Page = ({ children, onSwipeCamera }) => {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(0);
  const swipe = useSwipeToCamera({
    direction: 'down',
    enabled: !!onSwipeCamera,
    atTop: () => scrollY.current <= 2,
    onTrigger: onSwipeCamera,
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }} {...swipe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 130, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
      >
        {children}
      </ScrollView>
    </View>
  );
};
