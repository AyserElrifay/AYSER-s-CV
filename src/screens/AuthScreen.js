import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/profiles';
import { setIntent } from '../services/algorithm';
import { Glass, Micro, NeonButton, GhostButton } from '../components';

/* ─────────────── PASSWORDLESS-STYLE ONBOARDING · AUTH GATE ───────────
   Step 0 — sign in / create account (email+password via Supabase).
   Step 1 — pick your Vibe (writes profile intent, then enters the app).
   Demo mode (no .env): the button proceeds locally, nothing is saved.  */

const VIBES = ['🎒 Explorer', '☕ Coffee', '🧗‍♂️ Hiking', '🎬 Creator', '🎮 Gamer'];

const inputStyle = {
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: R - 6,
  color: C.text, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, marginBottom: 12,
};

export const AuthScreen = () => {
  const { isDemo, signIn, signUp, enterDemo, user, beginOnboarding, finishOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);

  const submit = async () => {
    setError(null); setNotice(null);
    if (isDemo) { setStep(1); return; }
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        beginOnboarding(); // hold this screen mounted even once the session goes live
        const { user: newUser, session } = await signUp(email.trim(), password, name.trim() || 'Explorer');
        if (!session) {
          // Project has email confirmation enabled — no session until confirmed.
          finishOnboarding();
          setMode('signin');
          setNotice('Account created! Check your email to confirm, then sign in.');
          return;
        }
        setPendingUserId(newUser ? newUser.id : null);
        setStep(1);
      } else {
        await signIn(email.trim(), password); // session change unmounts this screen
      }
    } catch (e) {
      finishOnboarding();
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickVibe = async (vibe) => {
    setIntent(vibe); // seed the reach algorithm with your vibe
    if (isDemo) { enterDemo(); return; }
    const id = pendingUserId || (user ? user.id : null);
    if (id) {
      try { await updateProfile(id, { intent: vibe, emoji: vibe.split(' ')[0] }); } catch (e) { /* non-blocking */ }
    }
    finishOnboarding(); // releases the gate — App now renders the tabs
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 36, fontWeight: '900', letterSpacing: 6, marginBottom: 10 }}>MOMENTS</Text>
            <Text style={{ color: C.dim, fontSize: 14, marginBottom: 40 }}>Don&apos;t scroll it. Live it.</Text>
            <Glass style={{ padding: 20, alignSelf: 'stretch', marginBottom: 30 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 18 }}>
                {mode === 'signup' ? 'Create your account' : 'Join the Vibe Tribe'}
              </Text>

              {mode === 'signup' ? (
                <TextInput
                  placeholder="Your name" placeholderTextColor={C.faint} value={name} onChangeText={setName}
                  autoCapitalize="words" style={inputStyle}
                />
              ) : null}
              <TextInput
                placeholder="Email" placeholderTextColor={C.faint} value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={inputStyle}
              />
              <TextInput
                placeholder="Password" placeholderTextColor={C.faint} value={password} onChangeText={setPassword}
                secureTextEntry style={inputStyle}
              />

              {error ? (
                <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text>
              ) : null}
              {notice ? (
                <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text>
              ) : null}

              <NeonButton
                label={busy ? 'ONE MOMENT…' : mode === 'signup' ? 'CREATE ACCOUNT ⚡' : 'SIGN IN ⚡'}
                onPress={busy ? undefined : submit}
                style={{ marginBottom: 12 }}
              />
              <GhostButton
                small
                label={mode === 'signup' ? 'I already have an account' : 'Create account'}
                onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
              />

              <Text style={{ color: C.faint, textAlign: 'center', fontSize: 12, marginTop: 16 }}>
                {isDemo ? '⚡ Demo mode — no backend configured, nothing is saved' : 'Powered by Supabase Auth ⚡'}
              </Text>
            </Glass>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>🏕️</Text>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 10 }}>What&apos;s your Vibe?</Text>
            <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
              Pick your Avatar intent for the Live Map.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
              {VIBES.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => pickVibe(v)}
                  style={{ backgroundColor: C.glass, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: C.line }}
                >
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <Micro>Your intent shows on your map pin — change it anytime</Micro>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
