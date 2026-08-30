import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/profiles';
import { setIntent } from '../services/algorithm';
import { resetPasswordByEmail, sendPhoneOtp, verifyPhoneOtp, updatePassword } from '../services/auth';
import { COUNTRY_LIST } from '../constants/countries';
import { GhostButton } from '../components/GhostButton';
import { Glass } from '../components/Glass';
import { Micro } from '../components/Micro';
import { NeonButton } from '../components/NeonButton';
import { Wordmark } from '../components/Wordmark';
import { setupNotice } from '../lib/plumbing';
import { useLang } from '../context/LanguageContext';
import { LANGS } from '../constants/i18n';

/* ─────────────── PASSWORDLESS-STYLE ONBOARDING · AUTH GATE ───────────
   Step 0 — sign in / create account (email+password via Supabase).
   Step 1 — pick your Vibe (writes profile intent, then enters the app).
   Demo mode (no .env): the button proceeds locally, nothing is saved.  */

/* The VALUE is English and never changes — it is written to the
   profile, seeds the reach algorithm, and shows on the live map for
   everybody in every language. Only the LABEL is translated. Getting
   this the other way round would give every language its own set of
   intents that nothing else in the app recognises. */
const VIBES = [
  { value: '🎒 Explorer', emoji: '🎒', key: 'vibe_explorer' },
  { value: '☕ Coffee',   emoji: '☕', key: 'vibe_coffee' },
  { value: '🧗‍♂️ Hiking',  emoji: '🧗‍♂️', key: 'vibe_hiking' },
  { value: '🎬 Creator',  emoji: '🎬', key: 'vibe_creator' },
  { value: '🎮 Gamer',    emoji: '🎮', key: 'vibe_gamer' },
];

/* Read at draw time, not at import time — see the note on headerBtn in
   HomeScreen. Built once, this froze the light theme's colours and gave
   dark mode a white box with white text in it. */
const inputStyle = () => ({
  backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, borderRadius: R - 6,
  color: C.text, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, marginBottom: 12,
});

/* Auth errors, translated into clean, professional guidance for the
   person signing in. Deliberately says NOTHING about the backend,
   provider names, dashboards or server internals — end users should
   never see our stack, both because it looks unprofessional and
   because leaking infrastructure details is free reconnaissance for
   an attacker. Owner-only fixes live in the docs, not on this screen. */
const authErrorKey = (e) => {
  const m = ((e && e.message) || '').toLowerCase();
  if (m.includes('already registered')) return 'auth_err_exists';
  if (m.includes('not confirmed')) return 'auth_err_unconfirmed';
  if (m.includes('invalid login credentials')) return 'auth_err_bad_login';
  if (m.includes('signups not allowed')) return 'auth_err_signups_off';
  if (m.includes('rate limit') || m.includes('too many')) return 'auth_err_rate';
  if (m.includes('password should be')) return 'auth_err_short_pw';
  if (m.includes('invalid email') || m.includes('validate email')) return 'auth_err_bad_email';
  if (m.includes('failed to fetch') || m.includes('network')) return 'auth_err_offline';
  return 'auth_err_generic';
};

export const AuthScreen = () => {
  const { isDemo, signIn, signUp, enterDemo, user, beginOnboarding, finishOnboarding } = useAuth();
  const { t, lang, setLang } = useLang();
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
    if (!email.trim()) { setError(t('auth_err_email_first')); return; }
    setBusy(true);
    try {
      await resetPasswordByEmail(email.trim());
      setNotice(t('auth_ok_reset_sent'));
    } catch (e) {
      setError(t('auth_err_reset_send'));
    } finally { setBusy(false); }
  };

  const sendOtp = async () => {
    setError(null); setNotice(null);
    if (!phone.trim()) { setError(t('auth_err_phone_first')); return; }
    setBusy(true);
    try {
      await sendPhoneOtp(phone.trim());
      setOtpSent(true);
      setNotice(t('auth_ok_sms_sent'));
    } catch (e) {
      setError(setupNotice('Could not send the SMS code. (SMS provider must be enabled in Supabase.)', t('auth_err_sms')));
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setError(null); setNotice(null);
    if (!otp.trim()) { setError(t('auth_err_code_first')); return; }
    setBusy(true);
    try {
      await verifyPhoneOtp(phone.trim(), otp.trim());
      setOtpVerified(true);
      setNotice(t('auth_ok_verified'));
    } catch (e) {
      setError(t('auth_err_code_wrong'));
    } finally { setBusy(false); }
  };

  const saveNewPassword = async () => {
    setError(null); setNotice(null);
    if (newPass.length < 6) { setError(t('auth_err_pass_short')); return; }
    setBusy(true);
    try {
      await updatePassword(newPass);
      setNotice(t('auth_ok_pass_updated'));
      // Session is already live from the OTP verify — releasing the gate lands in the app.
      setTimeout(() => finishOnboarding(), 700);
    } catch (e) {
      setError(t('auth_err_pass_update'));
    } finally { setBusy(false); }
  };

  const submit = async () => {
    setError(null); setNotice(null);
    if (isDemo) { setStep(1); return; }
    if (!email.trim() || !password) { setError(t('auth_err_need_both')); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        beginOnboarding(); // hold this screen mounted even once the session goes live
        const { user: newUser, session } = await signUp(email.trim(), password, name.trim() || 'Explorer');
        if (!session) {
          // Email confirmation is ON server-side — try signing straight
          // in anyway (covers "user exists but retried signup"), else
          // explain the confirmation email clearly.
          try {
            await signIn(email.trim(), password);
            setPendingUserId(newUser ? newUser.id : null);
            setStep(1);
            return;
          } catch (e2) {
            finishOnboarding();
            setMode('signin');
            setNotice(t('auth_ok_created'));
            return;
          }
        }
        setPendingUserId(newUser ? newUser.id : null);
        setStep(1);
      } else {
        await signIn(email.trim(), password); // session change unmounts this screen
      }
    } catch (e) {
      finishOnboarding();
      setError(t(authErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  // ── "Where on the planet are you?" — sets your flag on the map ──
  const [countrySearch, setCountrySearch] = useState('');
  const countries = COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(countrySearch.trim().toLowerCase()));

  const pickCountry = async (c) => {
    if (!isDemo) {
      const id = pendingUserId || (user ? user.id : null);
      if (id) {
        try { await updateProfile(id, { country: c.name, country_flag: c.flag }); } catch (e) { /* non-blocking */ }
      }
    }
    setStep(2); // → pick your vibe
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
        {/* ── THE LANGUAGE, BEFORE ANYTHING ELSE ──────────────────
            The phone's own language is used on a first visit, so most
            people never need this. But a guess is a guess: somebody on
            a borrowed phone, or living in a country whose language
            they do not read, should not have to sign up in a language
            they are only half following to reach the setting that
            fixes it. Six taps' worth of chips, at the top, always. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, marginBottom: 14 }}
          contentContainerStyle={{ paddingHorizontal: 2 }}
        >
          {LANGS.map((l) => {
            const on = l.code === lang;
            return (
              <Pressable key={l.code} onPress={() => setLang(l.code)} style={{ marginEnd: 7 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: on ? C.purple : C.glass,
                  borderWidth: 1, borderColor: on ? C.purple : C.line,
                  borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7,
                }}>
                  <Text style={{ fontSize: 13 }}>{l.flag}</Text>
                  <Text style={{ color: on ? '#FFF' : C.dim, fontSize: 12.5, fontWeight: '800', marginStart: 6 }}>
                    {l.native}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {step === 0 && mode === 'reset' ? (
          <View style={{ alignItems: 'center' }}>
            <Wordmark height={92} style={{ marginBottom: 4 }} />
            <Text style={{ color: C.dim, fontSize: 14, marginBottom: 30 }}>{t('auth_reset_title')}</Text>
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
                      {v === 'email' ? '✉️  ' + t('email_label') : '📱  ' + t('auth_via_phone')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {resetVia === 'email' ? (
                <>
                  <TextInput
                    placeholder={t('auth_account_email')} placeholderTextColor={C.faint} value={email} onChangeText={setEmail}
                    autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={inputStyle()}
                  />
                  {error ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
                  {notice ? <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text> : null}
                  <NeonButton label={busy ? t('auth_sending') : t('auth_send_reset') + ' ⚡'} onPress={busy ? undefined : sendEmailReset} style={{ marginBottom: 12 }} />
                </>
              ) : (
                <>
                  <TextInput
                    placeholder={t('auth_phone_ph')} placeholderTextColor={C.faint} value={phone} onChangeText={setPhone}
                    autoCapitalize="none" keyboardType="phone-pad" editable={!otpVerified} style={inputStyle()}
                  />
                  {otpSent && !otpVerified ? (
                    <TextInput
                      placeholder={t('auth_code_ph')} placeholderTextColor={C.faint} value={otp} onChangeText={setOtp}
                      keyboardType="number-pad" maxLength={6} style={inputStyle()}
                    />
                  ) : null}
                  {otpVerified ? (
                    <TextInput
                      placeholder={t('auth_new_password')} placeholderTextColor={C.faint} value={newPass} onChangeText={setNewPass}
                      secureTextEntry style={inputStyle()}
                    />
                  ) : null}
                  {error ? <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
                  {notice ? <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text> : null}
                  {!otpSent ? (
                    <NeonButton label={busy ? t('auth_sending') : t('auth_send_sms') + ' 📱'} onPress={busy ? undefined : sendOtp} style={{ marginBottom: 12 }} />
                  ) : !otpVerified ? (
                    <NeonButton label={busy ? t('auth_checking') : t('auth_verify_code') + ' ⚡'} onPress={busy ? undefined : verifyOtp} style={{ marginBottom: 12 }} />
                  ) : (
                    <NeonButton label={busy ? t('auth_saving') : t('auth_set_password') + ' ⚡'} onPress={busy ? undefined : saveNewPassword} style={{ marginBottom: 12 }} />
                  )}
                </>
              )}

              <GhostButton small label={t('auth_back_signin')} onPress={() => { setMode('signin'); setError(null); setNotice(null); }} />
            </Glass>
          </View>
        ) : step === 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Wordmark height={100} style={{ marginBottom: 2 }} />
            <Text style={{ color: C.dim, fontSize: 14, marginBottom: 40 }}>{t('auth_tagline')}</Text>
            <Glass style={{ padding: 20, alignSelf: 'stretch', marginBottom: 30 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 18 }}>
                {mode === 'signup' ? t('auth_create_title') : t('auth_signin_title')}
              </Text>

              {mode === 'signup' ? (
                <TextInput
                  placeholder={t('your_name')} placeholderTextColor={C.faint} value={name} onChangeText={setName}
                  autoCapitalize="words" style={inputStyle()}
                />
              ) : null}
              <TextInput
                placeholder={t('email_label')} placeholderTextColor={C.faint} value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={inputStyle()}
              />
              <TextInput
                placeholder={t('password_label')} placeholderTextColor={C.faint} value={password} onChangeText={setPassword}
                secureTextEntry style={inputStyle()}
              />

              {error ? (
                <Text style={{ color: C.coral, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</Text>
              ) : null}
              {notice ? (
                <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{notice}</Text>
              ) : null}

              <NeonButton
                label={busy ? t('auth_one_moment') : (mode === 'signup' ? t('auth_create_btn') : t('auth_signin_btn')) + ' ⚡'}
                onPress={busy ? undefined : submit}
                style={{ marginBottom: 12 }}
              />
              <GhostButton
                small
                label={mode === 'signup' ? t('auth_have_account') : t('auth_create_link')}
                onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
              />
              {mode === 'signin' && !isDemo ? (
                <Pressable onPress={openReset} style={{ marginTop: 10 }}>
                  <Text style={{ color: C.purple, fontSize: 12, textAlign: 'center', fontWeight: '700' }}>{t('auth_forgot')}</Text>
                </Pressable>
              ) : null}

              <Text style={{ color: C.faint, textAlign: 'center', fontSize: 12, marginTop: 16 }}>
                {isDemo ? '⚡ ' + t('auth_demo') : '🔒 ' + t('auth_private')}
              </Text>
            </Glass>
          </View>
        ) : step === 1 ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 56, marginBottom: 14 }}>🌍</Text>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 8 }}>{t('auth_where')}</Text>
            <Text style={{ color: C.dim, fontSize: 13.5, textAlign: 'center', marginBottom: 20, lineHeight: 19 }}>
              {t('auth_flag_hint')}
            </Text>
            <TextInput
              placeholder={t('auth_search_country')}
              placeholderTextColor={C.faint}
              value={countrySearch}
              onChangeText={setCountrySearch}
              style={[inputStyle(), { alignSelf: 'stretch' }]}
            />
            <View style={{ alignSelf: 'stretch', maxHeight: 340 }}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  {countries.slice(0, 24).map((c) => (
                    <Pressable
                      key={c.code}
                      onPress={() => pickCountry(c)}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: C.glass, borderWidth: 1, borderColor: C.line,
                        borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
                      }}
                    >
                      <Text style={{ fontSize: 18, marginRight: 7 }}>{c.flag}</Text>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <Pressable onPress={() => setStep(2)} style={{ marginTop: 18 }}>
              <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '700' }}>{t('auth_skip')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>🏕️</Text>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 10 }}>{t('auth_vibe_title')}</Text>
            <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
              {t('auth_vibe_sub')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
              {VIBES.map((v) => (
                <Pressable
                  key={v.value}
                  onPress={() => pickVibe(v.value)}
                  style={{ backgroundColor: C.glass, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: C.line }}
                >
                  <Text style={{ color: C.text, fontWeight: 'bold' }}>{v.emoji} {t(v.key)}</Text>
                </Pressable>
              ))}
            </View>
            <Micro>{t('auth_vibe_hint')}</Micro>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
