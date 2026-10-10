/* A Studio team member types a username on the sign-in screen; behind
   it is an address on a reserved domain that can never receive mail
   (see supabase/functions/team-admin). Pure, so it is checked without
   a network: node scripts/check-team.mjs */
export const TEAM_DOMAIN = 'team.moments.invalid';

/* "Mona" → mona@team.moments.invalid; a real email is left as it is */
export const signInAddress = (typed) => {
  const v = String(typed || '').trim();
  return /^[A-Za-z0-9_.]{3,20}$/.test(v) ? v.toLowerCase() + '@' + TEAM_DOMAIN : v;
};
