import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, R } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/profiles';
import { setIntent } from '../services/algorithm';
import { resetPasswordByEmail, sendPhoneOtp, verifyPhoneOtp, updatePassword, setSessionFromTokens } from '../services/auth';
import { recoveryTokens, recoveryError, clearRecovery } from '../lib/recovery';
import { COUNTRY_LIST } from '../constants/countries';
import { GhostButton } from '../components/GhostButton';
import { Glass } from '../components/Glass';
import { Micro } from '../components/Micro';
import { NeonButton } from '../components/NeonButton';
import { Wordmark } from '../components/Wordmark';
import { Welcome } from '../components/Welcome';
import { setupNotice } from '../lib/plumbing';
import { useLang } from '../context/LanguageContext';
import { LANGS } from '../constants/i18n';
import { countKindred } from '../services/kindred';
import { kindredNumber } from '../lib/kindred';

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

export const AuthScreen = ({ recovery = false, onDone }) => {
  const { isDemo, signIn, signUp, enterDemo, user, beginOnboarding, finishOnboarding } = useAuth();
  const { t, lang, setLang, rtl } = useLang();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  /* the welcome page first, the form only once somebody asks for it */
  const [welcome, setWelcome] = useState(!recovery);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  /* the country picked a step ago, and the people like you — see
     src/services/kindred.js. 'loading' while we count, an object once
     we have, and never a number we did not count. */
  const [myFlag, setMyFlag] = useState(null);
  const [myVibe, setMyVibe] = useState(null);
  const [kin, setKin] = useState(null);

  // Forgot-password flow: 'email' link, or 'phone' OTP → new password.
  const [resetVia, setResetVia] = useState('email'); // 'email' | 'phone'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPass, setNewPass] = useState('');

  /* ── COMING BACK FROM THE EMAIL LINK ──────────────────────────
     The token in the address is exchanged for a real session before
     the field is offered, because "set a new password" against no
     session fails at the last step, after the person has typed it.
     Better to find out now and say so. */
  const [linkReady, setLinkReady] = useState(false);
  const [linkDead, setLinkDead] = useState(recovery ? recoveryError() : null);
  useEffect(() => {
    if (!recovery || linkDead) return;
    const tk = recoveryTokens();
    if (!tk) { setLinkDead(t('auth_recovery_expired')); return; }
    let alive = true;
    setSessionFromTokens(tk)
      .then(() => { if (alive) setLinkReady(true); })
      .catch(() => { if (alive) setLinkDead(t('auth_recovery_expired')); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recovery]);

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
      // The session is already live — from the OTP verify, or from the
      // tokens the email link arrived with. Releasing the gate lands
      // in the app, signed in, with the password they just chose.
      setTimeout(() => {
        if (recovery) { clearRecovery(); if (onDone) onDone(); }
        finishOnboarding();
      }, 700);
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
    setMyFlag(c.flag || null);
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
    /* ── YOUR PEOPLE, COUNTED ───────────────────────────────────────
       "خليه لما اختار preferences يقلي أنا شبه كام user حول العالم".
       One screen between the vibe and the app: how many people here
       picked the same thing, from where. Counted from the database —
       and if the count does not come back in four seconds, the app
       opens anyway. Nobody is kept out of the app by a statistic. */
    setMyVibe(vibe);
    setKin('loading');
    setStep(3);
    try {
      const k = await countKindred({ intent: vibe, myFlag, meId: id });
      if (!k) { finishOnboarding(); return; }
      setKin(k);
    } catch (e) {
      finishOnboarding();
    }
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

        {recovery ? (
          /* ── BACK FROM THE EMAIL LINK ────────────────────────────
             One field and one button. Nothing else is offered here,
             because somebody who has just tapped a link in their
             email to get back into their own account should not have
             to find their way through a sign-in form to do it. */
          <View style={{ alignItems: 'center' }}>
            <Wordmark height={92} style={{ marginBottom: 4 }} />
            <Text style={{ color: C.dim, fontSize: 14, marginBottom: 30 }}>
              {linkDead ? t('auth_reset_title') : t('auth_recovery_title')}
            </Text>
            <Glass style={{ padding: 20, alignSelf: 'stretch', marginBottom: 30 }}>
              {linkDead ? (
                <>
                  <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginBottom: 16 }}>
                    {t('auth_recovery_expired')}
                  </Text>
                  <NeonButton
                    label={t('auth_recovery_again')}
                    onPress={() => { clearRecovery(); if (onDone) onDone(); }}
                  />
                </>
              ) : !linkReady ? (
                <Text style={{ color: C.dim, fontSize: 13.5 }}>{t('auth_checking')}</Text>
              ) : (
                <>
                  <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 20, marginBottom: 16 }}>
                    {t('auth_recovery_sub')}
                  </Text>
                  <TextInput
                    placeholder={t('auth_new_password')} placeholderTextColor={C.faint}
                    value={newPass} onChangeText={setNewPass} secureTextEntry style={inputStyle()}
                  />
                  <NeonButton
                    label={busy ? t('auth_saving') : t('auth_set_password')}
                    onPress={busy ? undefined : saveNewPassword}
                    style={{ marginTop: 12 }}
                  />
                </>
              )}
              {error ? <Text style={{ color: C.coral, fontSize: 12.5, marginTop: 12 }}>{error}</Text> : null}
              {notice ? <Text style={{ color: C.green, fontSize: 12.5, marginTop: 12 }}>{notice}</Text> : null}
            </Glass>
          </View>
        ) : step === 0 && welcome && mode !== 'reset' ? (
          <Welcome
            onStart={() => { setMode('signup'); setError(null); setNotice(null); setWelcome(false); }}
            onSignIn={() => { setMode('signin'); setError(null); setNotice(null); setWelcome(false); }}
          />
        ) : step === 0 && mode === 'reset' ? (
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
            {/* a way back to the welcome page — every screen has a way out */}
            <Pressable onPress={() => { setWelcome(true); setError(null); setNotice(null); }} hitSlop={10}
              accessibilityRole="button" accessibilityLabel={t('back')}
              style={{ alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={C.text} />
            </Pressable>
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
        ) : step === 3 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            {kin === 'loading' || !kin ? (
              <Text style={{ color: C.dim, fontSize: 14 }}>{t('kin_looking')}</Text>
            ) : kin.first ? (
              <>
                <Text style={{ fontSize: 56, marginBottom: 14 }}>{(myVibe || '').split(' ')[0]}</Text>
                <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>{t('kin_first_title')}</Text>
                <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 34, paddingHorizontal: 10 }}>{t('kin_first_sub')}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, marginBottom: 6 }}>{(myVibe || '').split(' ')[0]}</Text>
                <Text style={{ color: C.purple, fontSize: 64, fontWeight: '900', letterSpacing: -1.5 }}>{kindredNumber(kin.total, lang)}</Text>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 22, marginTop: 2, marginBottom: 22, paddingHorizontal: 16 }}>
                  {t(kin.total === 1 ? 'kin_same_one' : 'kin_same')}
                </Text>
                {/* the flags those people actually set, most common first */}
                {kin.flags.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginBottom: 16, paddingHorizontal: 10 }}>
                    {kin.flags.map((f) => <Text key={f} style={{ fontSize: 23, marginHorizontal: 3, marginBottom: 4 }}>{f}</Text>)}
                    {kin.moreFlags ? <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800', marginStart: 6 }}>+{kindredNumber(kin.moreFlags, lang)}</Text> : null}
                  </View>
                ) : null}
                {kin.sameHere ? (
                  <Text style={{ color: C.dim, fontSize: 14, marginBottom: 30 }}>
                    {kin.myFlag} {kindredNumber(kin.sameHere, lang)} {t('kin_here')}
                  </Text>
                ) : <View style={{ height: 22 }} />}
              </>
            )}
            {kin && kin !== 'loading' ? (
              <NeonButton label={t('kin_go')} onPress={finishOnboarding} style={{ alignSelf: 'stretch' }} />
            ) : null}
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
