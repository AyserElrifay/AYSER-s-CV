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
import { PlayerProvider } from './src/context/PlayerContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { TabNavigator, NavTheme } from './src/navigation/TabNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { IncomingCallGate } from './src/components/IncomingCallGate';
import { initPwa } from './src/lib/pwa';

initPwa(); // installable app + offline shell (no-op on native)

const Root = () => {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!isAuthenticated) return <AuthScreen />;
  // the mini-player floats above the navigator, so music keeps playing as
  // you move between tabs
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={NavTheme}>
        <TabNavigator />
      </NavigationContainer>
      <MiniPlayer />
      <IncomingCallGate />
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <PlayerProvider>
            <StatusBar style="dark" />
            <Root />
          </PlayerProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
