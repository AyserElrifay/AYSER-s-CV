import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/profiles';
import { setIntent } from '../services/algorithm';
import { resetPasswordByEmail, sendPhoneOtp, verifyPhoneOtp, updatePassword } from '../services/auth';
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

  // Forgot-password flow: 'email' link, or 'phone' OTP → new password.
  const [resetVia, setResetVia] = useState('email'); // 'email' | 'phone'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPass, setNewPass] = useState('');

  const openReset = () => {
    setError(null); setNotice(null); setMode('reset');
    setResetVia('email'); setOtpSent(false); setOtpVerified(false);
    setOtp(''); setNewPass('');
  };

  const sendEmailReset = async () => {
    setError(null); setNotice(null);
    if (!email.trim()) { setError('Enter your account email first.'); return; }
    setBusy(true);
    try {
      await resetPasswordByEmail(email.trim());
      setNotice('Reset link sent! Check your email, then open it to set a new password.');
    } catch (e) {
      setError(e.message || 'Could not send the reset email.');
    } finally { setBusy(false); }
  };

  const sendOtp = async () => {
    setError(null); setNotice(null);
    if (!phone.trim()) { setError('Enter your phone number (with country code).'); return; }
    setBusy(true);
    try {
      await sendPhoneOtp(phone.trim());
      setOtpSent(true);
      setNotice('Code sent by SMS. Enter the 6-digit code below.');
    } catch (e) {
      setError(e.message || 'Could not send the SMS code. (SMS provider must be enabled in Supabase.)');
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setError(null); setNotice(null);
    if (!otp.trim()) { setError('Enter the code from the SMS.'); return; }
    setBusy(true);
    try {
      await verifyPhoneOtp(phone.trim(), otp.trim());
      setOtpVerified(true);
      setNotice('Verified! Now set your new password below.');
    } catch (e) {
      setError(e.message || 'That code did not match. Try again.');
    } finally { setBusy(false); }
  };

  const saveNewPassword = async () => {
    setError(null); setNotice(null);
    if (newPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await updatePassword(newPass);
      setNotice('Password updated! You are signed in.');
      // Session is already live from the OTP verify — releasing the gate lands in the app.
      setTimeout(() => finishOnboarding(), 700);
    } catch (e) {
      setError(e.message || 'Could not update the password.');
    } finally { setBusy(false); }
  };

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
        {step === 0 && mode === 'reset' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 36, fontWeight: '900', letterSpacing: 6, marginBottom: 10 }}>MOMENTS</Text>
            <Text style={{ color: C.dim, fontSize: 14, marginBottom: 30 }}>Reset your password</Text>
            <Glass style={{ padding: 20, alignSelf: 'stretch', marginBottom: 30 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {['email', 'phone'].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => { setResetVia(v); setError(null); setNotice(null); }}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: R - 6, alignItems: 'center',
                      backgroundColor: resetVia === v ? C.purple : C.glass,
                      borderWidth: 1, borderColor: resetVia === v ? C.purple : C.line,
                    }}
                  >
                    <Text style={{ color: resetVia === v ? '#fff' : C.dim, fontWeight: '800', fontSize: 13 }}>
                      {v === 'email' ? '✉️  Email' : '📱  Phone'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {resetVia === 'email' ? (
                <>
                  <TextInput
                    placeholder="Account email" placeholderTextColor={C.faint} value={email} onChangeText={setEmail}
                    autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={inputStyle}
                  />
                  {error ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
                  {notice ? <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text> : null}
                  <NeonButton label={busy ? 'SENDING…' : 'SEND RESET LINK ⚡'} onPress={busy ? undefined : sendEmailReset} style={{ marginBottom: 12 }} />
                </>
              ) : (
                <>
                  <TextInput
                    placeholder="Phone e.g. +201234567890" placeholderTextColor={C.faint} value={phone} onChangeText={setPhone}
                    autoCapitalize="none" keyboardType="phone-pad" editable={!otpVerified} style={inputStyle}
                  />
                  {otpSent && !otpVerified ? (
                    <TextInput
                      placeholder="6-digit code" placeholderTextColor={C.faint} value={otp} onChangeText={setOtp}
                      keyboardType="number-pad" maxLength={6} style={inputStyle}
                    />
                  ) : null}
                  {otpVerified ? (
                    <TextInput
                      placeholder="New password" placeholderTextColor={C.faint} value={newPass} onChangeText={setNewPass}
                      secureTextEntry style={inputStyle}
                    />
                  ) : null}
                  {error ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
                  {notice ? <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text> : null}
                  {!otpSent ? (
                    <NeonButton label={busy ? 'SENDING…' : 'SEND SMS CODE 📱'} onPress={busy ? undefined : sendOtp} style={{ marginBottom: 12 }} />
                  ) : !otpVerified ? (
                    <NeonButton label={busy ? 'CHECKING…' : 'VERIFY CODE ⚡'} onPress={busy ? undefined : verifyOtp} style={{ marginBottom: 12 }} />
                  ) : (
                    <NeonButton label={busy ? 'SAVING…' : 'SET NEW PASSWORD ⚡'} onPress={busy ? undefined : saveNewPassword} style={{ marginBottom: 12 }} />
                  )}
                </>
              )}

              <GhostButton small label="← Back to sign in" onPress={() => { setMode('signin'); setError(null); setNotice(null); }} />
            </Glass>
          </View>
        ) : step === 0 ? (
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
              {mode === 'signin' && !isDemo ? (
                <Pressable onPress={openReset} style={{ marginTop: 10 }}>
                  <Text style={{ color: C.purple, fontSize: 12, textAlign: 'center', fontWeight: '700' }}>Forgot password?</Text>
                </Pressable>
              ) : null}

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
