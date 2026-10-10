import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SUPABASE_READY } from '../lib/supabase';
import { myStanding, askForCoach } from '../services/standing';
import { tapSuccess } from '../utils/feedback';

/* ─── AFTER A STRIKE ──────────────────────────────────────────────────
   Ayser: a confirmed report is a strike and a session with a Moments
   life coach before anything else; a second one closes the account.
   This is the screen that says so, plainly, over the whole app. It is
   not what stops anything — the database refuses the messages, posts
   and plans (safety_gate in RUN_ME.sql) — it is what makes sure the
   person knows why, and what to do next. */

export const SafetyHold = () => {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const { user, signOut } = useAuth();
  const uid = user && user.id;
  const [s, setS] = useState(null);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!SUPABASE_READY || !uid) return undefined;
    let alive = true;
    const look = () => myStanding(uid).then((r) => { if (alive) setS(r); }).catch(() => {});
    look();
    /* asked again whenever the app comes back to the front — a session
       done, or a decision made, shows without a reload */
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') look(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, [uid]);

  if (!s || (s.state !== 'coach' && s.state !== 'closed')) return null;
  const closed = s.state === 'closed';
  const waiting = asked || !!s.coach_asked_at;

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    try { await askForCoach(); tapSuccess(); setAsked(true); } catch (e) {}
    setBusy(false);
  };

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.bg, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 40 }}>{closed ? '🔒' : '🤝'}</Text>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.4, marginTop: 14 }}>{t(closed ? 'sk_closed' : 'sk_coach')}</Text>
      <Text style={{ color: C.dim, fontSize: 15, lineHeight: 22, marginTop: 10 }}>{t(closed ? 'sk_closed_sub' : 'sk_coach_sub')}</Text>
      <View style={{ flex: 1 }} />
      {!closed ? (
        waiting ? (
          <View style={{ padding: 16, borderRadius: 18, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>⏳ {t('sk_asked')}</Text>
          </View>
        ) : (
          <Pressable onPress={ask} disabled={busy} accessibilityRole="button"
            style={{ backgroundColor: C.purple, borderRadius: 18, paddingVertical: 17, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '800' }}>{t('sk_ask')}</Text>}
          </Pressable>
        )
      ) : null}
      <Pressable onPress={() => signOut && signOut()} accessibilityRole="button" style={{ marginTop: 14, alignSelf: 'center', padding: 8 }}>
        <Text style={{ color: C.dim, fontSize: 14, fontWeight: '800' }}>{t('sign_out')}</Text>
      </Pressable>
    </View>
  );
};
