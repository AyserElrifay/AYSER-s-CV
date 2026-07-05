import React, { useRef, useEffect, useContext } from 'react';
import { Pressable, View, Text, Animated, Easing } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { R } from '../constants/theme';

function usePulse(duration = 1500) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}

export const NeonButton = ({ label, onPress, color, style, icon }) => {
  const { theme } = useContext(ThemeContext);
  const c = color || theme.green;
  const p = usePulse(1700);
  return (
    <Pressable onPress={onPress} style={[{ alignSelf: 'stretch' }, style]}>
      {({ pressed }) => (
        <View>
          <Animated.View style={{ position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderRadius: R, backgroundColor: c, opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }} />
          <View style={{ borderRadius: R - 4, backgroundColor: c, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', transform: [{ scale: pressed ? 0.98 : 1 }] }}>
            {icon && <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>}
            <Text style={{ color: theme.ink, fontSize: 15, fontWeight: '900', letterSpacing: 1.6 }}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};
