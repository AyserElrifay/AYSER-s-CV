import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { type TenantContext, withTenant } from '@/db/client';
import { auditLog, clients, deals, organizations, services } from '@/db/schema';
import {
  type CostPosition,
  type CostTemplateLine,
  type CurrencyCode,
  type MarginBreakdown,
  type MarginSignal,
  type PriceBand,
  type TaxTreatment,
  type TaxedAmount,
  applyVat,
  computeMargin,
  costPosition,
  marginSignal,
  money,
} from '@/money';

/**
 * Read models for the app shell.
 *
 * Every select names its columns. `select *` is never used against a table with
 * financial columns: for a Member it would be refused by Postgres, which is the
 * correct outcome, but a query that only works for some roles is a query nobody
 * can reason about.
 */

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  defaultCurrency: CurrencyCode;
  houseRateBp: number;
  marginHealthyBp: number;
  marginWarningBp: number;
  costDriftAlertBp: number;
  /** Decides whether a supplier's VAT is a cost or a loan. */
  vatRegistered: boolean;
  vatRateBp: number;
  defaultTaxTreatment: TaxTreatment;
  country: string | null;
}

export async function getOrgSettings(ctx: TenantContext): Promise<OrgSettings | null> {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        defaultCurrency: organizations.defaultCurrency,
        houseRateBp: organizations.houseRateBp,
        marginHealthyBp: organizations.marginHealthyBp,
        marginWarningBp: organizations.marginWarningBp,
        costDriftAlertBp: organizations.costDriftAlertBp,
        vatRegistered: organizations.vatRegistered,
        vatRateBp: organizations.vatRateBp,
        defaultTaxTreatment: organizations.defaultTaxTreatment,
        country: organizations.country,
      })
      .from(organizations)
      .limit(1),
  );
  return rows[0] ?? null;
}

/** Identity only. Safe for a Member or Partner, whose grants exclude the rest. */
export async function getOrgIdentity(
  ctx: TenantContext,
): Promise<{ id: string; name: string; slug: string } | null> {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .limit(1),
  );
  return rows[0] ?? null;
}

export interface DealCardModel {
  id: string;
  title: string;
  clientName: string;
  serviceName: string | null;
  status: 'draft' | 'pending_approval' | 'won' | 'lost';
  deliveryDate: string | null;
  currency: CurrencyCode;
  margin: MarginBreakdown;
  signal: MarginSignal;
  /**
   * The band the slider moves within. Internal: it is sent to the account
   * manager's browser and never to a client. Absent on a deal with no service,
   * in which case the price is free and the margin thresholds decide the signal.
   */
  band: PriceBand | null;
  houseRateBp: number;
  /** Frozen deals are read-only. The slider does not appear on them. */
  isFrozen: boolean;
  /**
   * The price with tax on it.
   *
   * `margin.revenue` is and stays the net — what the agency earns. This is what
   * the client is invoiced, which is a different number and, under a reverse
   * charge, the same one.
   */
  taxed: TaxedAmount;
  /**
   * What was estimated against what has actually been spent. The margin above
   * is computed on `cost.effective`, so once spending passes the estimate the
   * card stops reporting a number the deal no longer has.
   */
  cost: CostPosition;
  costEntryCount: number;
  /** Costs recorded in another currency, excluded from the total until an FX path exists. */
  unconvertedCostCount: number;
  /**
   * Days the agency's own people have logged, in hundredths, and how many are
   * on the deal. A staffed deal with no days on it is the interesting case: it
   * means the margin is still reporting labour as free.
   */
  daysLogged: number;
  peopleOnDeal: number;
}

/**
 * The deal cards for the home screen.
 *
 * RLS decides which rows come back: an Owner gets the agency's, an Account
 * Manager gets their own. The query is identical for both — the difference is
 * enforced one layer down, where it cannot be forgotten.
 */
export async function getDealCards(
  ctx: TenantContext,
  settings: OrgSettings,
): Promise<DealCardModel[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: deals.id,
        title: deals.title,
        status: deals.status,
        deliveryDate: deals.deliveryDate,
        currency: deals.currency,
        agreedPriceMinor: deals.agreedPriceMinor,
        estimatedCostMinor: deals.estimatedCostMinor,
        frozenHouseRateBp: deals.frozenHouseRateBp,
        taxTreatment: deals.taxTreatment,
        vatRateBp: deals.vatRateBp,
        frozenTaxTreatment: deals.frozenTaxTreatment,
        frozenVatRateBp: deals.frozenVatRateBp,
        // Correlated, and evaluated under the caller's own policies on `costs`:
        // an account manager's totals cannot include a colleague's deal.
        //
        // `amount_minor` is what the cost cost. Reclaimable VAT was separated
        // into `vat_minor` when the cost was entered and is not summed here:
        // that money comes back, and counting it would understate every margin
        // by the tax rate. Nothing about today's settings enters this sum.
        //
        // Two sources, because there are two kinds of cost. `costs` is what left
        // the bank — a printer, a stock licence, a freelancer's invoice.
        // `work_log` is your own people's days, which never leave the bank and
        // are the cost every agency forgets: the four days a designer spent on
        // the retainer everyone agrees is profitable.
        actualCostMinor: sql<string>`(
          coalesce((
            select sum(c.amount_minor)
            from costs c
            where c.deal_id = ${deals.id}
              and c.kind = 'actual'
              and c.currency = ${deals.currency}
          ), 0)
          + coalesce((
            select sum(w.amount_minor)
            from work_log w
            where w.deal_id = ${deals.id} and w.currency = ${deals.currency}
          ), 0)
        )::text`,
        // Days logged by the agency's own people, in hundredths.
        daysLogged: sql<number>`coalesce((
          select sum(w.days)::int from work_log w
          where w.deal_id = ${deals.id} and w.currency = ${deals.currency}
        ), 0)`,
        peopleOnDeal: sql<number>`(
          select count(*)::int from deal_assignments a where a.deal_id = ${deals.id}
        )`,
        costEntryCount: sql<number>`(
          (select count(*)::int from costs c
           where c.deal_id = ${deals.id} and c.currency = ${deals.currency})
          + (select count(*)::int from work_log w
             where w.deal_id = ${deals.id} and w.currency = ${deals.currency})
        )`,
        // Counted, not silently added. A USD stock licence on an EGP deal needs
        // the deal's frozen rate to be converted, and until that path exists it
        // is more honest to say a number is missing than to total two
        // currencies as though they were one.
        unconvertedCostCount: sql<number>`(
          select count(*)::int from costs c
          where c.deal_id = ${deals.id} and c.currency <> ${deals.currency}
        )`,
        clientName: clients.name,
        serviceName: services.name,
        serviceCurrency: services.currency,
        floorMinor: services.floorMinor,
        targetMinor: services.targetMinor,
        ceilingMinor: services.ceilingMinor,
      })
      .from(deals)
      .leftJoin(clients, eq(clients.id, deals.clientId))
      .leftJoin(services, eq(services.id, deals.serviceId))
      .orderBy(desc(deals.createdAt)),
  );

  const thresholds = {
    healthyFromBp: settings.marginHealthyBp,
    warningFromBp: settings.marginWarningBp,
  };

  return rows.map((row) => {
    // A closed deal is scored on the house rate it closed with, never on
    // today's. This is the freeze, read back.
    const houseRate = row.frozenHouseRateBp ?? settings.houseRateBp;
    const price = money(row.agreedPriceMinor, row.currency);

    const cost = costPosition(
      money(row.estimatedCostMinor, row.currency),
      money(BigInt(row.actualCostMinor), row.currency),
      settings.costDriftAlertBp,
    );
    // The margin runs on the effective cost, not the estimate. An estimate stops
    // being the best guess the moment more than it has already been spent.
    const margin = computeMargin(price, cost.effective, houseRate);

    // A band priced in another currency than the deal cannot be compared to it,
    // so the deal is treated as unbanded rather than compared wrongly.
    const band =
      row.floorMinor !== null &&
      row.targetMinor !== null &&
      row.ceilingMinor !== null &&
      row.serviceCurrency === row.currency
        ? {
            floor: money(row.floorMinor, row.currency),
            target: money(row.targetMinor, row.currency),
            ceiling: money(row.ceilingMinor, row.currency),
          }
        : null;

    return {
      id: row.id,
      title: row.title,
      clientName: row.clientName ?? '—',
      serviceName: row.serviceName,
      status: row.status,
      deliveryDate: row.deliveryDate,
      currency: row.currency,
      margin,
      band,
      houseRateBp: houseRate,
      isFrozen: row.status === 'won',
      // A closed deal keeps the treatment and rate it was invoiced under. VAT
      // rates move by legislation, and a historical invoice must not move with
      // them.
      taxed: applyVat(
        price,
        row.frozenTaxTreatment ?? row.taxTreatment,
        row.frozenVatRateBp ?? row.vatRateBp,
      ),
      cost,
      costEntryCount: row.costEntryCount,
      unconvertedCostCount: row.unconvertedCostCount,
      daysLogged: row.daysLogged,
      peopleOnDeal: row.peopleOnDeal,
      signal: marginSignal({
        marginBasisPoints: margin.marginBasisPoints,
        price,
        ...(band ? { band } : {}),
        thresholds,
      }),
    };
  });
}

export interface ServiceBandModel {
  id: string;
  name: string;
  nameAr: string | null;
  currency: CurrencyCode;
  floorMinor: bigint;
  targetMinor: bigint;
  ceilingMinor: bigint;
  /** The build-up behind the estimate. Not granted to a Member. */
  costTemplate: CostTemplateLine[];
}

export async function getServiceBands(ctx: TenantContext): Promise<ServiceBandModel[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({
        id: services.id,
        name: services.name,
        nameAr: services.nameAr,
        currency: services.currency,
        floorMinor: services.floorMinor,
        targetMinor: services.targetMinor,
        ceilingMinor: services.ceilingMinor,
        costTemplate: services.costTemplate,
      })
      .from(services)
      .orderBy(services.name),
  );
}

export interface AuditEntry {
  id: bigint;
  action: string;
  entityType: string;
  actorEmail: string | null;
  createdAt: Date;
}

export async function getRecentAudit(ctx: TenantContext, limit = 10): Promise<AuditEntry[]> {
  return withTenant(ctx, (tx) =>
    tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        actorEmail: auditLog.actorEmail,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit),
  );
}
