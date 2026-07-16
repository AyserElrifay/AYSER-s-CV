/* Lightweight screen-space clustering for the Moments Map.
   Groups Moments whose markers would visually overlap at the current
   zoom into one cluster; everything else stays a single avatar marker.
   Pure + dependency-free so it's trivial to test and reuse. */

// crude metres-per-degree → pixels estimate from the region's latitudeDelta
// (good enough for grouping; swap for a projection lib if you need precision)
function pxDistance(a, b, latDelta, screenH = 700) {
  const degPerPx = latDelta / screenH;
  const dLat = (a.latitude - b.latitude) / degPerPx;
  const dLng = ((a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180)) / degPerPx;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function clusterMoments(moments, latDelta, radiusPx = 60) {
  const used = new Array(moments.length).fill(false);
  const clusters = [];
  const singles = [];

  for (let i = 0; i < moments.length; i++) {
    if (used[i]) continue;
    const group = [moments[i]];
    used[i] = true;
    for (let j = i + 1; j < moments.length; j++) {
      if (used[j]) continue;
      if (!moments[i].coords || !moments[j].coords) continue;
      if (pxDistance(moments[i].coords, moments[j].coords, latDelta) <= radiusPx) {
        group.push(moments[j]);
        used[j] = true;
      }
    }
    if (group.length === 1) {
      singles.push(moments[i]);
    } else {
      clusters.push({
        id: 'cluster_' + group.map((g) => g.id).join('_'),
        count: group.length,
        coords: centroid(group),
        avatars: group.map((g) => g.avatar),
        members: group,
      });
    }
  }
  return { clusters, singles };
}

function centroid(group) {
  const n = group.length;
  return {
    latitude: group.reduce((s, g) => s + g.coords.latitude, 0) / n,
    longitude: group.reduce((s, g) => s + g.coords.longitude, 0) / n,
  };
}
