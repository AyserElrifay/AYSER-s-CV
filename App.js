import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeContext } from './src/context/ThemeContext';
import { DARK_COLORS, LIGHT_COLORS } from './src/constants/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { TabNavigator } from './src/navigation/TabNavigator';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const theme = isDark ? DARK_COLORS : LIGHT_COLORS;
  const toggleTheme = () => setIsDark(!isDark);

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <StatusBar style={isDark ? "light" : "dark"} />
          {!isAuthenticated ? (
            <AuthScreen onLogin={() => setIsAuthenticated(true)} />
          ) : (
            <NavigationContainer theme={isDark ? NavDarkTheme : DefaultTheme}>
              <TabNavigator />
            </NavigationContainer>
          )}
        </View>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
