import React from 'react';
import { View, Platform } from 'react-native';

/* ── The map canvas used when react-native-maps isn't available
      (web + safety fallback). On web this is a REAL map — the actual
      streets of Cairo from OpenStreetMap — with the pins layered on
      top. On native it falls back to the hand-drawn light canvas. ── */

// Zamalek / downtown Cairo — matches ME.coords and the pin layout
const BBOX = '31.199,30.025,31.262,30.072';

const RealWebMap = () => (
  <iframe
    title="Moments map"
    src={'https://www.openstreetmap.org/export/embed.html?bbox=' + BBOX + '&layer=mapnik'}
    style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      border: 'none', pointerEvents: 'none', filter: 'saturate(0.9)',
    }}
  />
);

export const FauxMap = ({ children, style }) => (
  <View style={[{ flex: 1, backgroundColor: '#E8ECF2', overflow: 'hidden' }, style]}>
    {Platform.OS === 'web' ? (
      <RealWebMap />
    ) : (
      <>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View
            key={'h' + i}
            style={{ position: 'absolute', left: 0, right: 0, top: ((i + 1) * 11) + '%', height: 1, backgroundColor: 'rgba(17,24,39,0.05)' }}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={'v' + i}
            style={{ position: 'absolute', top: 0, bottom: 0, left: ((i + 1) * 15) + '%', width: 1, backgroundColor: 'rgba(17,24,39,0.05)' }}
          />
        ))}
        <View style={{ position: 'absolute', left: '-10%', right: '-10%', top: '48%', height: 10, backgroundColor: '#D6DBE4', transform: [{ rotate: '-7deg' }] }} />
        <View style={{ position: 'absolute', top: '-10%', bottom: '-10%', left: '36%', width: 8, backgroundColor: '#D6DBE4', transform: [{ rotate: '10deg' }] }} />
        <View style={{ position: 'absolute', left: '52%', right: '-25%', top: '16%', height: 16, backgroundColor: '#C7DCF3', transform: [{ rotate: '24deg' }] }} />
        <View style={{ position: 'absolute', left: '-15%', width: '38%', top: '70%', height: 14, backgroundColor: '#C7DCF3', transform: [{ rotate: '-18deg' }] }} />
      </>
    )}
    {children}
  </View>
);
