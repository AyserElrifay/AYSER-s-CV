// ═══════════════════════════════════════════════════════════════════
//  team-admin — the owner makes, pauses and removes Studio team accounts
//
//  A team member signs in with a USERNAME and a password the owner
//  chose. Behind it is an ordinary sign-in account whose address is
//  <username>@team.moments.invalid — ".invalid" is reserved and can
//  never receive mail, so no message is ever sent anywhere, and the
//  address cannot belong to a real person.
//
//  Only the owner can call this: the caller's own session is checked
//  against public.app_owners on every request. What a member may see in
//  the Studio is decided by their role in the database (studio_can in
//  RUN_ME.sql), not here.
//
//  POST { action, ... } with the owner's session (JWT on)
//    create        { username, password, role }  → { ok, user_id }
//    set_password  { user_id, password }
//    set_role      { user_id, role }
//    pause         { user_id }      signed out of everything, can't sign in
//    resume        { user_id }
//    reset_lock    { user_id }      their Face ID / code removed; they set new ones
//    remove        { user_id }      the account is deleted
//  Passwords are never stored or logged here; they go straight to the
//  auth service, which keeps only a hash.
//
//  Deploy:  supabase functions deploy team-admin
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://ayserelrifay.github.io';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Vary': 'Origin',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const TEAM_DOMAIN = 'team.moments.invalid';
const ROLES = ['safety', 'verify', 'all'];
const USERNAME = /^[a-z0-9_.]{3,20}$/;
const goodPassword = (p: unknown) => typeof p === 'string' && p.length >= 10 && p.length <= 72;
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  const email = who && who.user && who.user.email;
  if (!email) return json(401, { error: 'signed_out' });
  const { data: owner } = await db.from('app_owners').select('email').ilike('email', email).maybeSingle();
  if (!owner) return json(403, { error: 'not_owner' });
  /* and a second step in the last 30 minutes — the same rule as
     studio_fresh() in RUN_ME.sql. The token was just verified by
     getUser above, so its claims can be read as they are. */
  let claims: any = {};
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)));
  } catch { claims = {}; }
  const fresh = claims.aal === 'aal2' && (claims.amr || []).some((a: any) =>
    ['totp', 'mfa/totp', 'mfa/webauthn', 'webauthn', 'mfa/phone'].includes(a && a.method) && Number(a.timestamp) * 1000 > Date.now() - 30 * 60 * 1000);
  if (!fresh) return json(403, { error: 'locked' });

  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: 'body' }); }
  const id = String(b.user_id || '');
  const isTeam = async () => {
    if (!UUID.test(id)) return false;
    const { data } = await db.from('team_members').select('user_id').eq('user_id', id).maybeSingle();
    return !!data;   // never touch an account that is not a team account
  };

  switch (b.action) {
    case 'create': {
      const username = String(b.username || '').trim().toLowerCase();
      if (!USERNAME.test(username)) return json(400, { error: 'username' });
      if (!goodPassword(b.password)) return json(400, { error: 'password' });
      if (!ROLES.includes(b.role)) return json(400, { error: 'role' });
      const { data: taken } = await db.from('team_members').select('user_id').eq('username', username).maybeSingle();
      if (taken) return json(409, { error: 'taken' });
      const { data: made, error } = await db.auth.admin.createUser({
        email: username + '@' + TEAM_DOMAIN, password: b.password, email_confirm: true,
        user_metadata: { name: 'Moments team · ' + username, team: true },
      });
      if (error || !made || !made.user) return json(400, { error: 'create_failed' });
      const { error: e2 } = await db.from('team_members').insert({ user_id: made.user.id, username, role: b.role });
      if (e2) { await db.auth.admin.deleteUser(made.user.id); return json(500, { error: 'create_failed' }); }
      return json(200, { ok: true, user_id: made.user.id });
    }
    case 'set_password': {
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      if (!goodPassword(b.password)) return json(400, { error: 'password' });
      const { error } = await db.auth.admin.updateUserById(id, { password: b.password });
      return error ? json(400, { error: 'failed' }) : json(200, { ok: true });
    }
    case 'set_role': {
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      if (!ROLES.includes(b.role)) return json(400, { error: 'role' });
      await db.from('team_members').update({ role: b.role }).eq('user_id', id);
      return json(200, { ok: true });
    }
    case 'pause': {
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      await db.from('team_members').update({ disabled_at: new Date().toISOString() }).eq('user_id', id);
      await db.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      return json(200, { ok: true });
    }
    case 'resume': {
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      await db.auth.admin.updateUserById(id, { ban_duration: 'none' });
      await db.from('team_members').update({ disabled_at: null }).eq('user_id', id);
      return json(200, { ok: true });
    }
    case 'reset_lock': {
      // a member lost the phone with their passkey and their code: their
      // second steps are removed, and they set new ones at the next sign-in
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      const { data: fs } = await db.auth.admin.mfa.listFactors({ userId: id });
      for (const f of (fs && fs.factors) || []) { await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: id }); }
      return json(200, { ok: true });
    }
    case 'remove': {
      if (!(await isTeam())) return json(404, { error: 'no_member' });
      const { error } = await db.auth.admin.deleteUser(id);   // the team row goes with it (on delete cascade)
      return error ? json(400, { error: 'failed' }) : json(200, { ok: true });
    }
    default:
      return json(400, { error: 'action' });
  }
});
