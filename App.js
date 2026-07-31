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

initPwa(); // installable app + offline shell (no-op on native)

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
  const { loading, isAuthenticated } = useAuth();
  const { gen, isDark } = useTheme();
  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
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
