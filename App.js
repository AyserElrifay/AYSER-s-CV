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

import { isRecovering, mustSetPassword } from './src/lib/recovery';
import { takeStamp } from './src/lib/stampLink';
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from './src/constants/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { myMembership, myWelcomeOffer, dismissWelcomeOffer } from './src/services/membership';
import { goToTab } from './src/lib/mapBus';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { PresenceProvider } from './src/context/PresenceContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { primeFeed } from './src/hooks/useFeed';
import { pendingInvite, clearInvite } from './src/lib/invite';
import { TripLinkGate, TripInviteGate } from './src/components/TripLinkGate';
import { PartnerLinkGate } from './src/components/PartnerLinkGate';
import { BizLinkGate } from './src/components/BizLinkGate';
import { pendingPartner } from './src/lib/partnerLink';
import { pendingTrip } from './src/lib/tripLink';
import { claimInvite } from './src/services/green';
import { TabNavigator, buildNavTheme } from './src/navigation/TabNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { IncomingCallGate } from './src/components/IncomingCallGate';
import { WhatsNew } from './src/components/WhatsNew';
import { isOwner } from './src/services/music';
import { myStudio } from './src/services/team';
import { studioRequested, stripStudioParam, studioTab } from './src/utils/studioLink';
import { initPwa } from './src/lib/pwa';
import { Boundary } from './src/components/Boundary';
import { InstallPrompt } from './src/components/InstallPrompt';
import { SafetyHold } from './src/components/SafetyHold';
import { StudioProblem } from './src/components/StudioProblem';
import { lazyOverlay } from './src/lib/lazyScreen';
/* the Studio's code is fetched only once the owner check has passed —
   nobody else's phone ever downloads it */
const StudioLock = lazyOverlay(() => import('./src/components/StudioLock').then((m) => ({ default: m.StudioLock })));
const FirstTour = lazyOverlay(() => import('./src/components/FirstTour').then((m) => ({ default: m.FirstTour })));
/* ── MEMBERS ONLY ── (RUN_ME.sql, "TWO TIERS"). Signed in without a
   membership, the gateway is the only thing on screen, the app blurred
   behind it. A member who reaches for a VIP door (messages, a lounge, a
   full profile, the last seats) gets the VIP sheet; any other "you need
   a membership" answer opens the plans. The pieces are fetched only
   when somebody needs them. */
const PricingGate = lazyOverlay(() => import('./src/components/Membership').then((m) => ({ default: m.PricingGate })));
const VipSheet = lazyOverlay(() => import('./src/components/Membership').then((m) => ({ default: m.VipSheet })));
const WelcomeOTO = lazyOverlay(() => import('./src/components/Membership').then((m) => ({ default: m.WelcomeOTO })));
const VIP_DOORS = ['vip', 'chat', 'lounge', 'profile', 'vip_seat'];
/* the VIP welcome offer is shown once on this phone, ever: after "no thanks",
   after claiming, or once its 24 hours are up */
const OTO_SEEN = 'mm.oto.seen';
const otoSeen = () => { try { return !!localStorage.getItem(OTO_SEEN); } catch (e) { return false; } };
const otoDone = () => { try { localStorage.setItem(OTO_SEEN, '1'); } catch (e) {} };
const MemberGate = () => {
  const { signOut } = useAuth();
  const [m, setM] = React.useState(null);
  const [ask, setAsk] = React.useState(null);
  const [oto, setOto] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    // back from paying (?checkout=success, or the older ?plus=thanks): the
    // webhook switches the tier on — and makes the welcome offer — within seconds
    let back = false;
    try { back = /[?&](checkout=success|plus=thanks)/.test(window.location.search); } catch (e) {}
    if (back) {
      try { const u = new URL(window.location.href); u.searchParams.delete('checkout'); u.searchParams.delete('plus'); window.history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
    }
    const load = () => myMembership().then((x) => {
      if (!alive || !x) return;
      setM(x);
      // a VIP with a live offer sees it once; asked only when it can matter
      if (x.tier === 'VIP' && !otoSeen() && (back || x.source === 'lemonsqueezy')) {
        myWelcomeOffer().then((o) => { if (alive && o && o.live && !otoSeen()) { setOto(o); if (poll) clearInterval(poll); } });
      }
    });
    load();
    let n = 0; let poll = null;
    if (back) poll = setInterval(() => { load(); if (++n > 12) clearInterval(poll); }, 5000);
    const seen = () => { try { if (document.visibilityState === 'visible') load(); } catch (e) {} };
    const on = (e) => { setAsk((e && e.detail) || 'member'); load(); };
    try { document.addEventListener('visibilitychange', seen); window.addEventListener('mm-need-plus', on); } catch (e) {}
    return () => { alive = false; if (poll) clearInterval(poll); try { document.removeEventListener('visibilitychange', seen); window.removeEventListener('mm-need-plus', on); } catch (e) {} };
  }, []);
  if (m && m.gate && m.tier === 'FREE') return <PricingGate m={m} hard onSignOut={signOut} />;
  if (oto) {
    const close = () => { otoDone(); setOto(null); dismissWelcomeOffer(); };
    // claiming opens the journey at Level 1, where the 30% is already taken off
    const claim = () => {
      otoDone(); setOto(null); goToTab('TOGETHER');
      setTimeout(() => { try { window.dispatchEvent(new CustomEvent('mm-open-journey')); } catch (e) {} }, 350);
    };
    return <WelcomeOTO offer={oto} onClaim={claim} onClose={close} />;
  }
  if (!ask) return null;
  if (VIP_DOORS.includes(ask) && (!m || m.tier !== 'VIP')) return <VipSheet m={m} onClose={() => setAsk(null)} />;
  if (!VIP_DOORS.includes(ask)) return <PricingGate m={m} onClose={() => setAsk(null)} />;
  return null;
};
/* ── A STAMP FROM THE TABLE'S QR ── (src/lib/stampLink.js). The phone's own
   camera opened …/?stamp=<code>: once signed in, claim it and celebrate. */
const StampFlow = lazyOverlay(() => import('./src/components/LiveKit').then((m) => ({ default: m.StampFlow })));
const StampGate = () => {
  const [code, setCode] = React.useState(() => takeStamp());
  return code ? <StampFlow code={code} onClose={() => setCode(null)} /> : null;
};
const AdminPanel = lazyOverlay(() => import('./src/components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
import { Splash } from './src/components/Splash';
import { tourSeen } from './src/components/GestureTour';
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
  const firstTab = React.useRef(null);
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
    /* the lock only for an account that set one up (Face ID / a code);
       without one the server lets the password through (part 29) */
    if (a.identity && (a.enrolled !== false) && (force || !a.unlocked)) { setSt({ lock: a.identity }); return; }
    if (a.owner || a.role) { opened.current = Date.now(); setSt({ access: a }); return; }
  }, [user]);
  React.useEffect(() => {
    if (!user || !studioRequested()) return undefined;
    firstTab.current = studioTab();
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
  return <AdminPanel access={st.access} initialTab={firstTab.current} onClose={() => setSt(null)} />;
};

const Root = () => {
  const { loading, isAuthenticated, user } = useAuth();
  /* Somebody arriving from a "forgot my password" email. */
  const [recovering, setRecovering] = React.useState(isRecovering());

  /* The feed is asked for the moment we know who is here — while the
     splash is still on screen, not after it. See src/hooks/useFeed.js. */
  const uid = user ? user.id : null;
  React.useEffect(() => { if (uid && !recovering) primeFeed(); }, [uid]); // eslint-disable-line
  /* My day's reminders, if somebody switched them on (src/components/MyDay.js) —
     the piece is fetched only for them */
  React.useEffect(() => {
    let on = false;
    try { on = localStorage.getItem('mm.myday.remind') === '1'; } catch (e) {}
    if (uid && on) import('./src/components/MyDay').then((m) => m.scheduleReminders()).catch(() => {});
  }, [uid]);
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
    // not on top of a trip or partner link: one thing at a time
    if (!isAuthenticated || tourSeen() || pendingTrip() || pendingPartner()) return undefined;
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
  // a reset session opens only the new-password screen, even after the tab was closed (src/lib/recovery.js)
  if (recovering || (isAuthenticated && mustSetPassword())) return <AuthScreen recovery onDone={() => setRecovering(false)} />;
  // a trip somebody sent opens over sign-in: looking needs no account
  if (!isAuthenticated) return <><AuthScreen /><TripLinkGate /><PartnerLinkGate /><BizLinkGate demoOnly /></>;
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
      {/* a shared trip, or a trip that just opened (src/lib/tripLink.js) */}
      <TripLinkGate signedIn />
      <TripInviteGate />
      {/* the partner page, from a link or from inside (src/lib/partnerLink.js) */}
      <PartnerLinkGate />
      <BizLinkGate />
      {/* the first time inside: six story cards (src/components/FirstTour.js) */}
      {tour ? <FirstTour onClose={() => setTour(false)} /> : null}
      {/* after a strike: over everything (src/components/SafetyHold.js) */}
      <SafetyHold />
      <MemberGate />
      <StampGate />
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
