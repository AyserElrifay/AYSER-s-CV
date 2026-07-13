import { supabase } from '../lib/supabase';

/* All auth calls live here so screens never touch supabase directly. */

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }, // picked up by the profile trigger (schema.sql)
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription; // caller unsubscribes with .unsubscribe()
}

/* ── Password reset — by email or by phone OTP ── */

// Sends a reset link to the email (works out of the box).
export async function resetPasswordByEmail(email) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) throw error;
}

// Sends a 6-digit SMS code (requires an SMS provider enabled in Supabase Auth).
export async function sendPhoneOtp(phone) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

// Verifies the SMS code → signs the user in; they can then set a new password.
export async function verifyPhoneOtp(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return data;
}

// Sets a new password for the currently-authenticated user.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
