import { type CostTemplateLine } from '@/money';
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Mirrors src/db/migrations/*.sql. The SQL is the authority — it carries the
 * RLS policies, the column grants and the constraints, none of which have a
 * representation here. A test asserts the two agree on columns and enums.
 */

export const userRole = pgEnum('user_role', ['owner', 'account_manager', 'member', 'partner']);
export const dealStatus = pgEnum('deal_status', ['draft', 'pending_approval', 'won', 'lost']);
export const costKind = pgEnum('cost_kind', ['estimated', 'actual']);
export const splitRuleKind = pgEnum('split_rule_kind', [
  'partner_equity',
  'manager_commission',
  'bonus_pool',
]);
export const payoutPeriodStatus = pgEnum('payout_period_status', ['open', 'closed']);
export const currencyCode = pgEnum('currency_code', [
  'EGP', 'USD', 'SAR', 'AED', 'QAR', 'EUR', 'GBP', 'KWD', 'BHD', 'OMR', 'JOD', 'TND', 'JPY',
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'MAD',
]);
export const taxTreatment = pgEnum('tax_treatment', [
  'standard',
  'reverse_charge',
  'zero_rated',
  'exempt',
  'not_registered',
]);

/** Money is bigint minor units in the database and bigint in TypeScript. */
const minor = (name: string) => bigint(name, { mode: 'bigint' });

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  defaultCurrency: currencyCode('default_currency').notNull().default('EGP'),
  houseRateBp: integer('house_rate_bp').notNull().default(5000),
  marginHealthyBp: integer('margin_healthy_bp').notNull().default(4000),
  marginWarningBp: integer('margin_warning_bp').notNull().default(2000),
  defaultLocale: text('default_locale').notNull().default('en'),
  numberingSystem: text('numbering_system').notNull().default('latn'),
  costDriftAlertBp: integer('cost_drift_alert_bp').notNull().default(1500),
  country: char('country', { length: 2 }),
  vatRegistered: boolean('vat_registered').notNull().default(false),
  vatRateBp: integer('vat_rate_bp').notNull().default(0),
  defaultTaxTreatment: taxTreatment('default_tax_treatment').notNull().default('not_registered'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: userRole('role').notNull(),
    locale: text('locale').notNull().default('en'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** A way in that belongs to the person, because a freelancer is not an email address. */
    username: text('username'),
    title: text('title'),
    phone: text('phone'),
    dayRateMinor: minor('day_rate_minor'),
    rateCurrency: currencyCode('rate_currency'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
  },
  (t) => [
    index('users_email_idx').on(t.email),
    uniqueIndex('users_org_username_key').on(t.orgId, t.username),
  ],
);

/**
 * Who is on which deal, at the rate agreed when they were put on it.
 *
 * The rate is copied here rather than read from the person, for the same reason
 * a closed deal keeps the house rate it closed with: a raise in June must not
 * change what April's work cost.
 */
export const dealAssignments = pgTable(
  'deal_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    dealId: uuid('deal_id').notNull(),
    userId: uuid('user_id').notNull(),
    dayRateMinor: minor('day_rate_minor').notNull(),
    currency: currencyCode('currency').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deal_assignments_user_idx').on(t.orgId, t.userId)],
);

/**
 * The days themselves.
 *
 * Your own people's time, which never leaves the bank and is exactly the cost
 * agencies forget. `days` is hundredths, so a quarter-day is 25.
 */
export const workLog = pgTable(
  'work_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    dealId: uuid('deal_id').notNull(),
    userId: uuid('user_id').notNull(),
    workedOn: date('worked_on').notNull(),
    days: integer('days').notNull(),
    dayRateMinor: minor('day_rate_minor').notNull(),
    currency: currencyCode('currency').notNull(),
    amountMinor: minor('amount_minor').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('work_log_deal_idx').on(t.orgId, t.dealId),
    index('work_log_user_idx').on(t.orgId, t.userId, t.workedOn),
  ],
);

export const brandKits = pgTable(
  'brand_kits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    logoUrl: text('logo_url'),
    palette: jsonb('palette').notNull().default({}),
    fonts: jsonb('fonts').notNull().default({}),
    lockedConfig: jsonb('locked_config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('brand_kits_one_per_org').on(t.orgId)],
);

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  currency: currencyCode('currency').notNull(),
  floorMinor: minor('floor_minor').notNull(),
  targetMinor: minor('target_minor').notNull(),
  ceilingMinor: minor('ceiling_minor').notNull(),
  defaultCostMinMinor: minor('default_cost_min_minor').notNull(),
  defaultCostMaxMinor: minor('default_cost_max_minor').notNull(),
  taskTemplate: jsonb('task_template').notNull().default([]),
  costTemplate: jsonb('cost_template').$type<CostTemplateLine[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  nameAr: text('name_ar'),
  country: char('country', { length: 2 }),
  defaultCurrency: currencyCode('default_currency'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    clientId: uuid('client_id').notNull(),
    serviceId: uuid('service_id'),
    ownerUserId: uuid('owner_user_id').notNull(),
    title: text('title').notNull(),
    currency: currencyCode('currency').notNull(),
    agreedPriceMinor: minor('agreed_price_minor').notNull(),
    estimatedCostMinor: minor('estimated_cost_minor').notNull(),
    deliveryDate: date('delivery_date'),
    status: dealStatus('status').notNull().default('draft'),
    taxTreatment: taxTreatment('tax_treatment').notNull().default('not_registered'),
    vatRateBp: integer('vat_rate_bp').notNull().default(0),

    // Frozen at close. Never recomputed from today's settings.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    frozenHouseRateBp: integer('frozen_house_rate_bp'),
    frozenFxRate: numeric('frozen_fx_rate', { precision: 30, scale: 12 }),
    frozenFxSource: text('frozen_fx_source'),
    frozenFxCapturedAt: timestamp('frozen_fx_captured_at', { withTimezone: true }),
    frozenSplitRules: jsonb('frozen_split_rules'),
    frozenVatRateBp: integer('frozen_vat_rate_bp'),
    frozenTaxTreatment: taxTreatment('frozen_tax_treatment'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deals_org_status_idx').on(t.orgId, t.status),
    index('deals_org_owner_idx').on(t.orgId, t.ownerUserId),
  ],
);

export const costs = pgTable(
  'costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    dealId: uuid('deal_id').notNull(),
    kind: costKind('kind').notNull().default('actual'),
    amountMinor: minor('amount_minor').notNull(),
    vatMinor: minor('vat_minor').notNull(),
    currency: currencyCode('currency').notNull(),
    vendor: text('vendor'),
    description: text('description'),
    spentOn: date('spent_on').notNull(),
    receiptUrl: text('receipt_url'),
    recordedByUserId: uuid('recorded_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('costs_org_deal_idx').on(t.orgId, t.dealId),
    index('costs_org_spent_idx').on(t.orgId, t.spentOn),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    orgId: uuid('org_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorEmail: text('actor_email'),
    actorRole: userRole('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_org_created_idx').on(t.orgId, t.createdAt)],
);

export const splitRules = pgTable(
  'split_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    kind: splitRuleKind('kind').notNull(),
    beneficiaryUserId: uuid('beneficiary_user_id'),
    rateBp: integer('rate_bp').notNull(),
    label: text('label'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('split_rules_org_active_idx').on(t.orgId, t.isActive)],
);

export const payoutPeriods = pgTable('payout_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  status: payoutPeriodStatus('status').notNull().default('open'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedByUserId: uuid('closed_by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payoutStatements = pgTable(
  'payout_statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    periodId: uuid('period_id').notNull(),
    beneficiaryUserId: uuid('beneficiary_user_id').notNull(),
    currency: currencyCode('currency').notNull(),
    amountMinor: minor('amount_minor').notNull(),
    lines: jsonb('lines').notNull().default([]),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payout_statements_beneficiary_idx').on(t.orgId, t.beneficiaryUserId, t.issuedAt),
  ],
);

export const payoutAdjustments = pgTable(
  'payout_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    statementId: uuid('statement_id').notNull(),
    beneficiaryUserId: uuid('beneficiary_user_id').notNull(),
    currency: currencyCode('currency').notNull(),
    amountMinor: minor('amount_minor').notNull(),
    reason: text('reason').notNull(),
    createdByUserId: uuid('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('payout_adjustments_statement_idx').on(t.orgId, t.statementId)],
);

/**
 * Columns a Member must never receive.
 *
 * The rule is narrower than "no numbers", and the distinction is the product: a
 * Member may never see a fact about the *agency's* economics — any deal's price,
 * any margin, any service band, what a colleague costs. They may see facts about
 * *themselves*: their own day rate, the rate their assignment was agreed at, and
 * the days they logged. Withholding those would mean a person cannot check what
 * they are about to be paid, which is the same argument that gives a Partner
 * their own statement.
 *
 * Row-level security does the other half, and does the part a column list
 * cannot: `users`, `deal_assignments` and `work_log` all restrict a Member to
 * rows that are their own, so the grant below can be generous without the
 * answer ever being.
 *
 * Asserted against the actual grants by a test, so adding a financial column to
 * a table a Member can read fails the build rather than leaking quietly.
 */
export const MEMBER_FORBIDDEN_COLUMNS = {
  organizations: [
    'default_currency',
    'house_rate_bp',
    'margin_healthy_bp',
    'margin_warning_bp',
    'cost_drift_alert_bp',
    'vat_registered',
    'vat_rate_bp',
    'default_tax_treatment',
  ],
  services: [
    'currency',
    'cost_template',
    'floor_minor',
    'target_minor',
    'ceiling_minor',
    'default_cost_min_minor',
    'default_cost_max_minor',
  ],
  deals: [
    'currency',
    'agreed_price_minor',
    'estimated_cost_minor',
    'frozen_house_rate_bp',
    'frozen_fx_rate',
    'frozen_fx_source',
    'frozen_fx_captured_at',
    'frozen_split_rules',
    'tax_treatment',
    'vat_rate_bp',
    'frozen_vat_rate_bp',
    'frozen_tax_treatment',
  ],
  clients: ['default_currency'],
  // A Member holds INSERT on costs and no SELECT at all, so none of these is
  // reachable by them — the grant asymmetry, not a select list, is what does it.
  // That asymmetry is why the timesheet is a separate table: a Member reading
  // their own logged days must not become a Member reading a printer's invoice.
  costs: ['amount_minor', 'vat_minor', 'currency'],
  // A Member holds no privilege at all on the payout tables, so none of these
  // is reachable. Listed anyway: the assertion should fail loudly if somebody
  // ever grants the table wholesale.
  split_rules: ['rate_bp'],
  payout_statements: ['amount_minor', 'currency', 'lines'],
  payout_adjustments: ['amount_minor', 'currency'],
} as const;

/**
 * Columns a Partner must never receive.
 *
 * Deliberately shorter than the Member's list, and the difference is the
 * product: a Partner is *entitled* to their own payout — the amount, the deals
 * behind it, the rate it was paid at. What they may not see is the agency's
 * economics: any deal's price, any service's band, any cost, the house rate.
 *
 * Row-level security does the other half. A Partner may select a statement
 * amount, but only on the rows where they are the beneficiary.
 */
export const PARTNER_FORBIDDEN_COLUMNS = {
  organizations: MEMBER_FORBIDDEN_COLUMNS.organizations,
  services: MEMBER_FORBIDDEN_COLUMNS.services,
  deals: MEMBER_FORBIDDEN_COLUMNS.deals,
  clients: MEMBER_FORBIDDEN_COLUMNS.clients,
  costs: MEMBER_FORBIDDEN_COLUMNS.costs,
  // A Partner is an investor, not a person on the crew: they hold no privilege
  // at all on the staffing tables. Listed so the assertion fails loudly if
  // somebody ever grants one of them wholesale.
  deal_assignments: ['day_rate_minor', 'currency'],
  work_log: ['day_rate_minor', 'amount_minor', 'currency', 'days'],
} as const;
