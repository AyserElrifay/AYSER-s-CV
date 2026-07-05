import React from 'react';
import { View } from 'react-native';

/* ── Faux map: hand-drawn dark map used on web preview (and as a
      guaranteed fallback), styled to match the Google dark theme. ── */
export const FauxMap = ({ children, style }) => (
  <View style={[{ flex: 1, backgroundColor: '#101014', overflow: 'hidden' }, style]}>
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <View
        key={'h' + i}
        style={{ position: 'absolute', left: 0, right: 0, top: ((i + 1) * 11) + '%', height: 1, backgroundColor: 'rgba(255,255,255,0.035)' }}
      />
    ))}
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <View
        key={'v' + i}
        style={{ position: 'absolute', top: 0, bottom: 0, left: ((i + 1) * 15) + '%', width: 1, backgroundColor: 'rgba(255,255,255,0.035)' }}
      />
    ))}
    <View style={{ position: 'absolute', left: '-10%', right: '-10%', top: '48%', height: 10, backgroundColor: '#1d1d22', transform: [{ rotate: '-7deg' }] }} />
    <View style={{ position: 'absolute', top: '-10%', bottom: '-10%', left: '36%', width: 8, backgroundColor: '#1d1d22', transform: [{ rotate: '10deg' }] }} />
    <View style={{ position: 'absolute', left: '52%', right: '-25%', top: '16%', height: 16, backgroundColor: '#0d1420', transform: [{ rotate: '24deg' }] }} />
    <View style={{ position: 'absolute', left: '-15%', width: '38%', top: '70%', height: 14, backgroundColor: '#0d1420', transform: [{ rotate: '-18deg' }] }} />
    {children}
  </View>
);
