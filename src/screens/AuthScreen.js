import React, { useState, useContext } from 'react';
import { View, Text, Animated, Pressable } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { Glass } from '../components/Glass';
import { NeonButton } from '../components/NeonButton';

export const AuthScreen = ({ onLogin }) => {
  const { theme } = useContext(ThemeContext);
  const [step, setStep] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: 20 }}>
      {step === 0 ? (
        <Animated.View style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 36, fontWeight: '900', letterSpacing: 6, marginBottom: 10 }}>MOMENTS</Text>
          <Text style={{ color: theme.dim, fontSize: 14, marginBottom: 50 }}>Don't scroll it. Live it.</Text>
          <Glass style={{ padding: 20, width: '100%', marginBottom: 30 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20 }}>Join the Vibe Tribe</Text>
            <NeonButton label="Continue with Apple " color={theme.text} onPress={() => setStep(1)} style={{ marginBottom: 15 }} />
            <NeonButton label="Continue with Google" color={theme.blue} onPress={() => setStep(1)} style={{ marginBottom: 15 }} />
            <Text style={{ color: theme.faint, textAlign: 'center', fontSize: 12, marginTop: 10 }}>Powered by Supabase Auth ⚡</Text>
          </Glass>
        </Animated.View>
      ) : (
        <Animated.View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>🏕️</Text>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 10 }}>What's your Vibe?</Text>
          <Text style={{ color: theme.dim, fontSize: 14, textAlign: 'center', marginBottom: 30 }}>Pick your Avatar intent for the Live Map.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
            {['🎒 Explorer', '☕ Coffee', '🧗‍♂️ Hiking', '🎬 Creator', '🎮 Gamer'].map(v => (
              <Pressable key={v} onPress={onLogin} style={{ backgroundColor: theme.glass, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: theme.line }}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
};
