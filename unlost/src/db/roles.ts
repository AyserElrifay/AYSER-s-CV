/**
 * The four application roles, and the database role each one maps to.
 *
 * The mapping is the enforcement point. A request never chooses its own SQL
 * privileges: it presents a session, the session names a role, and the
 * transaction switches to that role's database identity before touching a
 * single row.
 */
export const APP_ROLES = ['owner', 'account_manager', 'member', 'partner'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const DB_ROLE_BY_APP_ROLE = {
  owner: 'unlost_role_owner',
  account_manager: 'unlost_role_manager',
  member: 'unlost_role_member',
  partner: 'unlost_role_partner',
} as const satisfies Record<AppRole, string>;

export type DbRole = (typeof DB_ROLE_BY_APP_ROLE)[AppRole];

/** Roles the migration creates. `unlost_app` connects; the rest are switched into. */
export const MANAGED_ROLES = {
  /** The connection role. NOINHERIT, and holds no table privileges of its own. */
  app: 'unlost_app',
  /** Owns the sign-in lookup. Cannot log in; reachable only through that function. */
  bootstrap: 'unlost_bootstrap',
  perAppRole: DB_ROLE_BY_APP_ROLE,
} as const;

export function dbRoleFor(role: AppRole): DbRole {
  const dbRole = DB_ROLE_BY_APP_ROLE[role];
  if (!dbRole) throw new Error(`No database role is mapped to "${role}"`);
  return dbRole;
}

/** Roles that may see money. Used to keep the UI honest; the DB is the authority. */
export function canSeeFinancials(role: AppRole): boolean {
  return role === 'owner' || role === 'account_manager';
}
