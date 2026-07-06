import React, { createContext, useContext, useState, useEffect } from 'react';
import { SUPABASE_READY } from '../lib/supabase';
import * as auth from '../services/auth';

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

  useEffect(() => {
    if (!SUPABASE_READY) return;
    let subscription;
    auth
      .getSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
    subscription = auth.onAuthStateChange(setSession);
    return () => subscription && subscription.unsubscribe();
  }, []);

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
      setDemoAuthed(false);
    },
    enterDemo: () => setDemoAuthed(true),
    beginOnboarding: () => setOnboarding(true),
    finishOnboarding: () => setOnboarding(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
