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
export const currencyCode = pgEnum('currency_code', [
  'EGP', 'USD', 'SAR', 'AED', 'QAR', 'EUR', 'GBP', 'KWD', 'BHD', 'OMR', 'JOD', 'TND', 'JPY',
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
  },
  (t) => [index('users_email_idx').on(t.email)],
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

    // Frozen at close. Never recomputed from today's settings.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    frozenHouseRateBp: integer('frozen_house_rate_bp'),
    frozenFxRate: numeric('frozen_fx_rate', { precision: 30, scale: 12 }),
    frozenFxSource: text('frozen_fx_source'),
    frozenFxCapturedAt: timestamp('frozen_fx_captured_at', { withTimezone: true }),
    frozenSplitRules: jsonb('frozen_split_rules'),

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

/** Columns a Member must never receive. Asserted against the grants by a test. */
export const FINANCIAL_COLUMNS = {
  organizations: [
    'default_currency',
    'house_rate_bp',
    'margin_healthy_bp',
    'margin_warning_bp',
    'cost_drift_alert_bp',
  ],
  services: [
    'currency',
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
  ],
  clients: ['default_currency'],
  // A Member holds INSERT on costs and no SELECT at all, so none of these is
  // reachable by them — the grant asymmetry, not a select list, is what does it.
  costs: ['amount_minor', 'currency'],
} as const;
