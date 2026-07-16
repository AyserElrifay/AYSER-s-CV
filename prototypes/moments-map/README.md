# Moments Map — prototype (Snap Map × Bump)

A reusable React Native "visual storytelling canvas": user Moments tied to
locations, with avatar-centric markers, activity clustering, proximity
"Bump" sparks, and a Ghost/Community visibility toggle.

> Native prototype. The shipped app renders maps on **web** via Leaflet
> (`react-native-maps` has no web renderer), so this folder is standalone
> and is **not** imported by the app — run it in a native Expo build.

## Install the one missing dep

```bash
npx expo install react-native-reanimated
# react-native-maps is already in this project (1.18.0)
```

Add the Reanimated Babel plugin (last in the list) to `babel.config.js`:

```js
plugins: ['react-native-reanimated/plugin'],
```

Google provider needs a Maps API key in `app.json` (`ios`/`android` config).

## Run it

Register `DemoScreen` as a screen (or set it as your root while testing):

```js
import DemoScreen from './prototypes/moments-map/DemoScreen';
// <DemoScreen />
```

Two sample people are placed ~35 m apart so the **Bump** spark fires
immediately, and three are stacked to show the **"3 Moments"** cluster.

## Files

| File | Responsibility |
| --- | --- |
| `MomentsMap.js` | Reusable container: base map, orchestrates markers/clusters/bumps + the toggle |
| `MomentMarker.js` | Avatar + gradient story-ring + polaroid thumbnail, bouncy tap-scale |
| `MomentCluster.js` | "N Moments here" bundle with a pulsing activity glow (heat) |
| `useBump.js` | Proximity brain — haversine pairs within `bumpRadiusM` |
| `BumpSpark.js` | The ⚡ spark/link animation drawn at a pair's midpoint |
| `cluster.js` | Screen-space clustering (zoom-aware) |
| `VisibilityToggle.js` | Ghost 👻 / Community 🌍 sliding toggle |
| `mapStyle.js` | Minimalist playful custom map JSON + palette |
| `DemoScreen.js` | Ready-to-run demo with sample Moments |

## Embed in your own screen

```jsx
<MomentsMap
  moments={moments}         // [{ id, name, avatar, coords:{latitude,longitude}, doing, thumb, fresh }]
  me={{ id: myId }}
  region={region}
  bumpRadiusM={120}
  onOpenMoment={(m) => navigation.navigate('MomentViewer', { m })}
/>
```

### Performance note
`tracksViewChanges` is kept `true` only while a marker animates (and off
otherwise) — critical on Android, where leaving it on re-rasterises every
marker each frame and tanks FPS.
