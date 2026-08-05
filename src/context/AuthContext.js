import React, { createContext, useContext, useState, useEffect } from 'react';
import { SUPABASE_READY } from '../lib/supabase';
import * as auth from '../services/auth';
import { ensureMyProfile, touchLastActive } from '../services/profiles';
import { loadAccountSettings, forgetAccountSettings } from '../services/accountSettings';

/* Session state for the whole app.
   Real mode  — session comes from Supabase and survives restarts.
   Demo mode  — no credentials configured; enterDemo() flips local state,
                matching the original prototype's onLogin behavior. */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [demoAuthed, setDemoAuthed] = useState(false);
  const [onboarding, setOnboarding] = useState(false); // keeps AuthScreen mounted through the vibe picker
  const [loading, setLoading] = useState(SUPABASE_READY);

  /* ── WHY THIS HAS A TIMER ────────────────────────────────────────
     Looking up the stored session is the first thing the app does, and
     until it answers we show a plain canvas. That is fine when it takes
     200ms. It is a disaster when it never answers — and it doesn't
     always answer: an iPhone that suspended the tab, a token refresh
     against a stalled connection, a network that goes away mid-flight.
     There is no timeout inside the client, so the promise just hangs,
     `loading` stays true, and the app sits on a blank page for ever.

     That blank page is what people were seeing when a chat or the
     camera "opened white": not a crash — Safari had thrown the tab
     away, the app started again, and the session lookup never came
     back.

     So: give it six seconds. If it hasn't answered by then, carry on as
     signed-out. Nothing is lost if a session does turn up afterwards —
     `onAuthStateChange` fires and the app signs itself in. And when the
     tab comes back to the foreground still waiting, ask again. */
  useEffect(() => {
    if (!SUPABASE_READY) return undefined;
    let alive = true;
    let settled = false;
    let subscription;

    const done = (s) => {
      if (!alive || settled) return;
      settled = true;
      if (s !== undefined) setSession(s);
      setLoading(false);
    };

    const ask = () => {
      auth.getSession().then((s) => done(s)).catch(() => done(null));
    };

    ask();
    const bail = setTimeout(() => done(undefined), 6000);

    // the listener is also an answer — if it fires first, stop waiting
    subscription = auth.onAuthStateChange((s) => {
      if (!alive) return;
      setSession(s);
      done(undefined);
    });

    /* Back in the foreground and still stuck on the splash? The lookup
       we started before the phone went to sleep is never coming back;
       start a fresh one. */
    const onVisible = () => {
      if (typeof document === 'undefined' || document.hidden) return;
      if (settled) return;
      ask();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearTimeout(bail);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Self-heal: make sure the signed-in user has a profiles row —
  // accounts created before the signup trigger existed don't, and
  // without it every post/story/vibe insert fails silently.
  useEffect(() => {
    if (SUPABASE_READY && session && session.user) {
      ensureMyProfile(session.user).catch(() => {});
    }
  }, [session]);

  // Presence heartbeat — stamp "last active" now, every 2 min while the
  // app is open, and whenever it comes back to the foreground, so other
  // people see a REAL active status for you in chat.
  useEffect(() => {
    if (!SUPABASE_READY || !session || !session.user) return;
    const uid = session.user.id;
    const beat = () => touchLastActive(uid);
    beat();
    const id = setInterval(beat, 2 * 60 * 1000);
    const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) beat(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [session]);

  /* Your own settings, from your account rather than from whichever
     phone you happen to be holding — see services/accountSettings.js. */
  useEffect(() => {
    const id = session && session.user && session.user.id;
    if (id) loadAccountSettings(id);
  }, [session]);

  const value = {
    session,
    loading,
    isDemo: !SUPABASE_READY,
    isAuthenticated: (SUPABASE_READY ? !!session : demoAuthed) && !onboarding,
    user: session ? session.user : null,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: async () => {
      if (SUPABASE_READY) await auth.signOut();
      // the next person on this phone must not inherit these
      forgetAccountSettings();
      setDemoAuthed(false);
    },
    enterDemo: () => setDemoAuthed(true),
    beginOnboarding: () => setOnboarding(true),
    finishOnboarding: () => setOnboarding(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
