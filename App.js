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
import { TabNavigator, buildNavTheme } from './src/navigation/TabNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { IncomingCallGate } from './src/components/IncomingCallGate';
import { WhatsNew } from './src/components/WhatsNew';
import { AdminPanel } from './src/components/AdminPanel';
import { isOwner } from './src/services/music';
import { studioRequested, stripStudioParam } from './src/utils/studioLink';
import { initPwa } from './src/lib/pwa';
import { Boundary } from './src/components/Boundary';
import { InstallPrompt } from './src/components/InstallPrompt';
import { Splash } from './src/components/Splash';
import { GestureTour, tourSeen } from './src/components/GestureTour';
import { installCrashLog, setDiagnostics } from './src/lib/crashLog';

initPwa(); // installable app + offline shell (no-op on native)
installCrashLog(); // keep what went wrong — see src/lib/crashLog.js

/* The Studio opens from a private link and nowhere else — see
   src/utils/studioLink.js. The owner check runs on top of the link, so
   the link alone opens nothing for anyone but Ayser. */
const StudioGate = () => {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (studioRequested() && isOwner(user)) { setOpen(true); stripStudioParam(); }
  }, [user]);
  return open ? <AdminPanel onClose={() => setOpen(false)} /> : null;
};

const Root = () => {
  const { loading, isAuthenticated, user } = useAuth();
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
  // never a bare rectangle — see src/components/Splash.js
  if (loading) return <Splash />;
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
