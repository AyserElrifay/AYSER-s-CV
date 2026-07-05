import React, { useContext } from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Glass } from '../components/Glass';
import { NeonButton } from '../components/NeonButton';
import { R } from '../constants/theme';

export const VaultScreen = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20 }}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20 }}>The Vault ☰</Text>
      <LinearGradient colors={[theme.purpleSoft, theme.bg]} style={{ borderRadius: R, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: theme.line }}>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: '900' }}>1,250 <Text style={{ fontSize: 16 }}>$MOMENT</Text></Text>
        <NeonButton small label="SPLIT BILL 💳" style={{ marginTop: 15 }} />
      </LinearGradient>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 10 }}>Settings</Text>
      <Glass style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontWeight: 'bold' }}>App Theme</Text>
        <Pressable onPress={toggleTheme} style={{ backgroundColor: theme.glassHi, padding: 10, borderRadius: 10 }}>
          <Text style={{ fontSize: 18 }}>{theme.isDark ? '☀️ Light' : '🌙 Dark'}</Text>
        </Pressable>
      </Glass>
    </ScrollView>
  );
};
