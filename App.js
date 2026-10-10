/**
 * ─────────────────────────────────────────────────────────────
 *  MOMENTS — "Active Experiencing" Super-App · Prototype v1.0
 *  Philosophy: every piece of content is an invitation to move.
 *
 *  Stack: Expo · React Navigation (bottom tabs)
 *         react-native-maps · expo-linear-gradient · Ionicons
 *
 *  Architecture:
 *    src/constants   — design tokens + mock data
 *    src/hooks       — shared animation hooks
 *    src/utils       — maps loader + geo math
 *    src/components  — glass primitives, cards, modals, pins
 *    src/screens     — HOME · MAP · CHILL · CHATS · VAULT
 *    src/navigation  — bottom-tab shell
 * ─────────────────────────────────────────────────────────────
 */

import { isRecovering } from './src/lib/recovery';
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from './src/constants/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { PresenceProvider } from './src/context/PresenceContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { primeFeed } from './src/hooks/useFeed';
import { pendingInvite, clearInvite } from './src/lib/invite';
import { claimInvite } from './src/services/green';
import { TabNavigator, buildNavTheme } from './src/navigation/TabNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { IncomingCallGate } from './src/components/IncomingCallGate';
import { WhatsNew } from './src/components/WhatsNew';
import { isOwner } from './src/services/music';
import { myStudio } from './src/services/team';
import { studioRequested, stripStudioParam } from './src/utils/studioLink';
import { initPwa } from './src/lib/pwa';
import { Boundary } from './src/components/Boundary';
import { InstallPrompt } from './src/components/InstallPrompt';
import { SafetyHold } from './src/components/SafetyHold';
import { StudioProblem } from './src/components/StudioProblem';
import { lazyOverlay } from './src/lib/lazyScreen';
/* the Studio's code is fetched only once the owner check has passed —
   nobody else's phone ever downloads it */
const StudioLock = lazyOverlay(() => import('./src/components/StudioLock').then((m) => ({ default: m.StudioLock })));
const AdminPanel = lazyOverlay(() => import('./src/components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
import { Splash } from './src/components/Splash';
import { GestureTour, tourSeen } from './src/components/GestureTour';
import { installCrashLog, setDiagnostics } from './src/lib/crashLog';
import { warmMap } from './src/lib/leaflet';

initPwa(); // installable app + offline shell (no-op on native)
installCrashLog(); // keep what went wrong — see src/lib/crashLog.js

/* The map's library comes off a CDN and used to start downloading only
   when the Map tab was tapped, which is why the tab opened onto an empty
   rectangle. Fetched while the app is idle instead — see warmMap in
   src/components/LeafletMap.js. Never during the first paint: the feed
   in front of you comes first. */
if (typeof window !== 'undefined') {
  const warm = () => warmMap();
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 2500);
}

/* The Studio opens from a private link and nowhere else — see
   src/utils/studioLink.js. The owner check runs on top of the link, so
   the link alone opens nothing for anyone but Ayser. */
const StudioGate = () => {
  const { user } = useAuth();
  /* null | { lock: identity } | { access } — always what the SERVER said */
  const [st, setSt] = React.useState(null);
  const opened = React.useRef(0);
  const look = React.useCallback(async (force) => {
    /* asked up to three times: a token being refreshed, a dropped
       request, must not read as "no" */
    let a = null;
    for (let i = 0; i < 3 && !a; i++) {
      a = await myStudio();
      if (!a && i < 2) await new Promise((r) => setTimeout(r, 1200));
    }
    if (!a || (!a.identity && !a.owner && !a.role)) {
      /* the owner's own email gets told why; anybody else gets nothing */
      setSt(isOwner(user) ? { problem: a ? 'not_recognised' : 'no_answer' } : null);
      return;
    }
    /* part 25 run: the server says whether this session passed its second
       step recently; without it the Studio does not open at all */
    if (a.identity && (force || !a.unlocked)) { setSt({ lock: a.identity }); return; }
    if (a.owner || a.role) { opened.current = Date.now(); setSt({ access: a }); return; }
  }, [user]);
  React.useEffect(() => {
    if (!user || !studioRequested()) return undefined;
    stripStudioParam();
    look(true);   // the lock every time the Studio is opened
    return undefined;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Locks itself again: after 2 minutes in the background, and after 25
     minutes open (the server stops at 30 anyway). */
  React.useEffect(() => {
    if (!st || !st.access || typeof document === 'undefined') return undefined;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 2 * 60 * 1000) look(true);
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => { if (Date.now() - opened.current > 25 * 60 * 1000) look(true); }, 30 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [st, look]);
  if (!st) return null;
  if (st.problem) return <StudioProblem why={st.problem} email={user && user.email} onRetry={() => { setSt(null); look(true); }} onClose={() => setSt(null)} />;
  if (st.lock) return <StudioLock identity={st.lock} onUnlocked={() => look(false)} onClose={() => setSt(null)} />;
  return <AdminPanel access={st.access} onClose={() => setSt(null)} />;
};

const Root = () => {
  const { loading, isAuthenticated, user } = useAuth();
  /* Somebody arriving from a "forgot my password" email. */
  const [recovering, setRecovering] = React.useState(isRecovering());

  /* The feed is asked for the moment we know who is here — while the
     splash is still on screen, not after it. See src/hooks/useFeed.js. */
  const uid = user ? user.id : null;
  React.useEffect(() => { if (uid && !recovering) primeFeed(); }, [uid]); // eslint-disable-line
  /* came in through somebody's invite link: tell the server once */
  React.useEffect(() => {
    if (!uid || recovering) return;
    const from = pendingInvite();
    if (from) claimInvite(from).finally(clearInvite);
  }, [uid]); // eslint-disable-line

  const { gen, isDark } = useTheme();

  /* The detail behind a failure is for the person who can fix it, and
     nobody else. Everyone still sees the same plain message. */
  React.useEffect(() => { setDiagnostics(isOwner(user)); }, [user]);

  /* The gestures worth teaching, once, the first time somebody is
     actually inside the app. A short delay so it lands after the first
     screen has drawn — arriving on top of a half-painted feed makes it
     feel like an ad rather than a hand. */
  const [tour, setTour] = React.useState(false);
  React.useEffect(() => {
    if (!isAuthenticated || tourSeen()) return undefined;
    const t = setTimeout(() => setTour(true), 1400);
    return () => clearTimeout(t);
  }, [isAuthenticated]);
  /* Never a bare rectangle, and never a launch animation cut in half —
     the splash owns its own exit and tells us when it's actually done.
     See src/components/Splash.js. */
  const [splashDone, setSplashDone] = React.useState(false);
  if (loading || !splashDone) {
    return <Splash ready={!loading} onDone={() => setSplashDone(true)} />;
  }
  if (recovering) return <AuthScreen recovery onDone={() => setRecovering(false)} />;
  if (!isAuthenticated) return <AuthScreen />;
  // the mini-player floats above the navigator, so music keeps playing as
  // you move between tabs. `key={gen}` forces a full remount when dark
  // mode toggles, so every already-mounted screen re-reads the new colors.
  return (
    <View key={gen} style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={buildNavTheme()}>
        <TabNavigator />
      </NavigationContainer>
      <MiniPlayer />
      <IncomingCallGate />
      <WhatsNew />
      <StudioGate />
      <InstallPrompt />
      {tour ? <GestureTour onClose={() => setTour(false)} /> : null}
      {/* after a strike: over everything (src/components/SafetyHold.js) */}
      <SafetyHold />
    </View>
  );
};

export default function App() {
  return (
    <Boundary>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <PresenceProvider>
                <PlayerProvider>
                  <Root />
                </PlayerProvider>
              </PresenceProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </Boundary>
  );
}
