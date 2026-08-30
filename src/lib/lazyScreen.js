import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { C, R } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { tapLight } from '../utils/feedback';

/* ─── ARRIVING WHEN IT IS NEEDED, NOT BEFORE ─────────────────────────
   Everything in this app used to be in one file that every person
   downloaded before anything appeared: the camera, the map, five
   games, the studio. Somebody opening their feed on a phone waited for
   all of it, and most of it they would not touch that day.

   This is the tool for saying "later". `await import()` genuinely
   works here now — see the loader in scripts/inject-html.mjs for the
   one line Expo's web export leaves out, and why the first attempt at
   this looked like it did not work.

   ── WHY A RETRY, AND WHY NOT React.lazy ──────────────────────────
   A piece that arrives over the network can fail to arrive: a tunnel,
   a lift, a lost second of signal. So there are three attempts with a
   short wait between them before giving up.

   And when it does give up, the error boundary the screen already sits
   in offers a Try again. That button has to actually try again — which
   is exactly what React.lazy cannot do. A lazy component remembers its
   rejection for ever: the boundary remounts the subtree, React sees
   the same rejected object and throws again without ever calling the
   factory. Try again would have looked like it was doing something and
   returned to the same message every single time.

   Twenty lines of state instead, and the retry is real: the boundary
   unmounts on failure, mounting again runs the effect again, and the
   effect asks for the piece again. Checked with the chunk blocked and
   then let through — the camera opens on the second press. */
const load = (factory, tries = 3) =>
  factory().catch((e) => {
    if (tries <= 1) throw e;
    return new Promise((r) => setTimeout(r, 400)).then(() => load(factory, tries - 1));
  });

/* What you look at while a piece is on its way. Deliberately almost
   nothing: the app's own background and a quiet spinner. A skeleton
   layout here would be guessing at a screen we have not loaded yet,
   and guessing wrong flashes twice. */
export const Loading = () => (
  <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={C.purple} />
  </View>
);

const Nothing = () => null;

/* ─── WHERE A FAILED SHEET SAYS SO ───────────────────────────────────
   A sheet that cannot arrive must not take the screen down with it.
   Handing the error up to the boundary does exactly that: the boundary
   nearest a sheet is the one around the whole tab, so Try again
   remounts the entire screen — which closes the sheet, throws away
   what you had open, and lands you back on the feed. Measured: the
   retry ran, the camera did not come back, because by then nothing was
   asking for it.

   So a sheet answers for itself, in place, over whatever it was
   opening on top of. Try again asks again and nothing else moves. */
const CouldNotOpen = ({ onRetry, onClose }) => {
  const { t } = useLang();
  return (
    <View style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 34,
    }}>
      <View style={{ backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 22, alignItems: 'center', alignSelf: 'stretch' }}>
        <Text style={{ fontSize: 28 }}>🫤</Text>
        <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900', marginTop: 10, textAlign: 'center' }}>
          {t('lazy_failed_t')}
        </Text>
        <Text style={{ color: C.faint, fontSize: 12.5, marginTop: 7, textAlign: 'center', lineHeight: 18 }}>
          {t('lazy_failed_b')}
        </Text>
        <Pressable onPress={() => { tapLight(); onRetry(); }} style={{ marginTop: 16 }}>
          <View style={{ backgroundColor: C.purple, borderRadius: R, paddingHorizontal: 24, paddingVertical: 11 }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '900' }}>{t('try_again')}</Text>
          </View>
        </Pressable>
        {onClose ? (
          <Pressable onPress={onClose} style={{ marginTop: 12 }}>
            <Text style={{ color: C.dim, fontSize: 13, fontWeight: '800' }}>{t('close')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const lazy = (factory, Fallback, inPlace) => {
  const Lazy = (props) => {
    const [Loaded, setLoaded] = useState(null);
    const [failed, setFailed] = useState(null);
    /* Bumped by Try again. The effect depends on it, so asking again is
       nothing more than changing this number. */
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
      let alive = true;
      load(factory).then(
        (m) => { if (alive) setLoaded(() => m.default); },
        (e) => { if (alive) setFailed(e || new Error('This part could not be loaded')); },
      );
      return () => { alive = false; };
    }, [attempt]);

    const again = () => { setFailed(null); setAttempt((n) => n + 1); };

    if (failed) {
      // a sheet answers for itself; a whole tab goes up to the boundary,
      // which already draws the full-screen version of this
      if (inPlace) return <CouldNotOpen onRetry={again} onClose={props.onClose} />;
      throw failed;
    }
    if (!Loaded) return <Fallback />;
    return <Loaded {...props} />;
  };
  Lazy.displayName = 'Lazy';
  return Lazy;
};

/* A whole tab. Shows a spinner while it comes, because the tab is the
   only thing on screen and blank would read as broken. */
export const lazyScreen = (factory) => lazy(factory, Loading, false);

/* ─── A SHEET THAT FETCHES ITSELF ────────────────────────────────────
   Same idea, and the calling screen does not change at all: it still
   writes `{open ? <CaptureModal … /> : null}` and the camera simply is
   not in the first download any more.

   Nothing is shown while it comes, deliberately. None of these is on
   screen until you ask for it, so there is no layout to hold open, and
   a spinner where a sheet is about to slide up is a flash, not
   information.

   ── AND WHY EVERY SCREEN HAS TO DO IT ────────────────────────────
   Metro puts a piece used by two different lazy screens back into the
   main bundle, because that is the only place both can reach. So one
   screen still importing the camera the old way keeps the camera in
   everybody's first download — measured: with four screens converted
   and one left, the camera's own chunk came out 0 bytes and the camera
   was still in the main file. It is all of them or none. */
export const lazyOverlay = (factory) => lazy(factory, Nothing, true);
