import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MOMENTS_MAP_STYLE, PALETTE } from './mapStyle';
import { MomentMarker } from './MomentMarker';
import { MomentCluster } from './MomentCluster';
import { BumpSpark } from './BumpSpark';
import { VisibilityToggle } from './VisibilityToggle';
import { useBump, midpoint } from './useBump';
import { clusterMoments } from './cluster';

/* ─────────────────────────────────────────────────────────────────────
   MomentsMap — a reusable, drop-in "visual storytelling canvas".

   Embed it anywhere:
       <MomentsMap
          moments={moments}
          me={me}
          region={region}
          onOpenMoment={(m) => navigation.navigate('MomentViewer', { m })}
       />

   Responsibilities:
     • render the gamified base map (custom JSON style)
     • cluster co-located Moments → <MomentCluster/> ("N Moments")
     • render lone Moments as <MomentMarker/> (avatar + story ring + polaroid)
     • detect proximity pairs (useBump) → draw <BumpSpark/> + a link line
     • host the Ghost / Community visibility toggle
     • bouncy tap-scale on the active marker, then hand off via onOpenMoment
   All heavy visuals/animation live in the child components; this file is
   just orchestration so it stays easy to read and reuse.
   ───────────────────────────────────────────────────────────────────── */

export function MomentsMap({
  moments = [],
  me = null,
  region,
  clusterRadiusPx = 60,
  bumpRadiusM = 120,
  onOpenMoment,
}) {
  const [mode, setMode] = useState('community'); // 'ghost' | 'community'
  const [activeId, setActiveId] = useState(null);
  const [zoom, setZoom] = useState(region ? region.latitudeDelta : 0.05);

  // In Ghost mode you vanish from your own map preview too (honest UX).
  const visibleMoments = useMemo(
    () => (mode === 'ghost' ? moments.filter((m) => m.id !== (me && me.id)) : moments),
    [moments, mode, me],
  );

  // Group co-located Moments into clusters vs singles (screen-space aware).
  const { clusters, singles } = useMemo(
    () => clusterMoments(visibleMoments, zoom, clusterRadiusPx),
    [visibleMoments, zoom, clusterRadiusPx],
  );

  // Proximity brain → who's close enough to "bump".
  const { pairs } = useBump(
    mode === 'ghost' ? [] : visibleMoments,
    bumpRadiusM,
  );

  const openMoment = (m) => {
    setActiveId(m.id);
    // let the marker's bounce play, then hand off to the full viewer
    setTimeout(() => onOpenMoment && onOpenMoment(m), 220);
  };

  return (
    <View style={styles.fill}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.fill}
        customMapStyle={MOMENTS_MAP_STYLE}
        initialRegion={region}
        onRegionChangeComplete={(r) => setZoom(r.latitudeDelta)}
        showsPointsOfInterest={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* ── proximity "bump" links + sparks between close avatars ── */}
        {pairs.map((p) => (
          <React.Fragment key={p.id}>
            <Polyline
              coordinates={[p.a.coords, p.b.coords]}
              strokeColor={PALETTE.gold}
              strokeWidth={1.5 + p.strength * 2}
              lineDashPattern={[2, 6]}
            />
            <Marker coordinate={midpoint(p.a.coords, p.b.coords)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <BumpSpark strength={p.strength} />
            </Marker>
          </React.Fragment>
        ))}

        {/* ── clusters: "N Moments here" with a pulsing activity glow ── */}
        {clusters.map((c) => (
          <Marker
            key={c.id}
            coordinate={c.coords}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
            onPress={() => onOpenMoment && onOpenMoment(c.members)}
          >
            <MomentCluster count={c.count} avatars={c.avatars} />
          </Marker>
        ))}

        {/* ── single Moments: avatar + story ring + polaroid ── */}
        {singles.map((m) => (
          <Marker
            key={m.id}
            coordinate={m.coords}
            anchor={{ x: 0.5, y: 0.6 }}
            // tracksViewChanges must be true only while animating, else
            // Android re-rasterises every frame and kills FPS.
            tracksViewChanges={activeId === m.id}
            onPress={() => openMoment(m)}
          >
            <MomentMarker
              moment={m}
              isActive={activeId === m.id}
              hasFreshMoment={!!m.fresh}
              onPress={openMoment}
            />
          </Marker>
        ))}
      </MapView>

      {/* Snap-style Ghost / Community toggle, floating top-centre */}
      <View style={styles.toggle} pointerEvents="box-none">
        <VisibilityToggle mode={mode} onChange={setMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toggle: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
});
