import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { SUPABASE_READY, storedSessionNow } from '../lib/supabase';
import * as auth from '../services/auth';
import { ensureMyProfile, touchLastActive } from '../services/profiles';
import { askFounderWelcome } from '../services/founder';
import { loadAccountSettings, forgetAccountSettings } from '../services/accountSettings';
import { isOwner } from '../services/music';
import { publishViewerIsOwner } from '../lib/plumbing';

/* Session state for the whole app.
   Real mode  — session comes from Supabase and survives restarts.
   Demo mode  — no credentials configured; enterDemo() flips local state,
                matching the original prototype's onLogin behavior. */

const AuthContext = createContext(null);

/* Read once, before the first render. See storedSessionNow. */
const BOOT = storedSessionNow();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(BOOT);
  const [demoAuthed, setDemoAuthed] = useState(false);
  const [onboarding, setOnboarding] = useState(false); // keeps AuthScreen mounted through the vibe picker
  /* Somebody already signed in on this phone does not wait for the
     network to be told so — the splash leaves as soon as it can. */
  const [loading, setLoading] = useState(SUPABASE_READY && !BOOT);

  /* ── THE SAME PERSON IS THE SAME OBJECT ──────────────────────────
     Ayser: "الكود بيرجع تاني من الأول كل ما يبدأ في task جديدة".

     Measured, and he is exactly right. The login renews itself every
     hour, and again whenever the app comes back from the background
     close to the hour. Each renewal hands over a brand-new session
     object, carrying a brand-new user object — the same person, a
     different object. Fifty-six screens and hooks read that user and
     reload when it changes, so every renewal threw away what every
     screen had and asked the database for all of it again: twelve
     queries in the three seconds after one renewal, with nothing on
     screen having changed.

     So the user only becomes a new object when it is a different
     person, or when their account details really changed
     (USER_UPDATED). A renewal keeps the one everybody already has. */
  const userRef = useRef(BOOT ? BOOT.user : null);
  const [user, setUser] = useState(userRef.current);
  const take = (s, event) => {
    const u = s && s.user ? s.user : null;
    const prev = userRef.current;
    const same = !!(u && prev && u.id === prev.id && event !== 'USER_UPDATED');
    if (!same) { userRef.current = u; setUser(u); }
    setSession(s);
  };

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
      if (s !== undefined) take(s, 'INITIAL');
      setLoading(false);
    };

    const ask = () => {
      auth.getSession().then((s) => done(s)).catch(() => done(null));
    };

    ask();
    const bail = setTimeout(() => done(undefined), 6000);

    // the listener is also an answer — if it fires first, stop waiting
    subscription = auth.onAuthStateChange((s, event) => {
      if (!alive) return;
      take(s, event);
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

  const uid = user ? user.id : null;

  // Self-heal: make sure the signed-in user has a profiles row —
  // accounts created before the signup trigger existed don't, and
  // without it every post/story/vibe insert fails silently.
  useEffect(() => {
    if (SUPABASE_READY && uid && userRef.current) {
      ensureMyProfile(userRef.current).catch(() => {});
    }
  }, [uid]);

  /* A new account gets one message from Ayser (src/services/founder.js).
     Asked a few seconds in, so the profile and the language are there. */
  useEffect(() => {
    if (!SUPABASE_READY || !uid) return undefined;
    const h = setTimeout(() => { askFounderWelcome(uid).catch(() => {}); }, 6000);
    return () => clearTimeout(h);
  }, [uid]);

  // Presence heartbeat — stamp "last active" now, every 2 min while the
  // app is open, and whenever it comes back to the foreground, so other
  // people see a REAL active status for you in chat.
  useEffect(() => {
    if (!SUPABASE_READY || !uid) return undefined;
    const beat = () => touchLastActive(uid);
    beat();
    const id = setInterval(beat, 2 * 60 * 1000);
    const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) beat(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [uid]);

  /* Whether the person holding the phone is Ayser. Screens that have to
     choose between a developer's instruction and a human sentence ask
     here — see src/lib/plumbing.js. */
  useEffect(() => {
    publishViewerIsOwner(isOwner(user));
  }, [user]);

  /* Your own settings, from your account rather than from whichever
     phone you happen to be holding — see services/accountSettings.js. */
  useEffect(() => {
    if (uid) loadAccountSettings(uid);
  }, [uid]);

  const signedIn = SUPABASE_READY ? !!session : demoAuthed;
  const value = useMemo(() => ({
    loading,
    isDemo: !SUPABASE_READY,
    isAuthenticated: signedIn && !onboarding,
    user,
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
  /* The raw session is not handed out: it changes on every renewal and
     nothing outside this file reads it. Who is signed in is `user`. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, loading, signedIn, onboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
