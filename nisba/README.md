# Nisba

Every deal an agency signs becomes a branded proposal, a task board, a live
margin, and a payout — from a single card.

**Phase 0 is complete, and Phase 1's core is in.** Auth, organisations, four
enforced roles, and tenant isolation proved by an automated suite — plus the
deal card and the price instrument: drag the price and the margin moves with it,
in either language.

`../` in this repository is a different project (`moments-superapp`). Nisba lives
entirely in this directory and shares nothing with it.

---

## Running it locally

Needs Node 22 and Postgres 16.

```bash
cd nisba
npm install
cp .env.example .env          # then fill in the values
npm run db:migrate            # creates roles, schema, RLS policies
npm run dev                   # http://localhost:3000
```

Create an agency at `/signup`. You land on a populated deal card, not an empty
state: five services priced, a brand kit, a client and a sample deal.

### Local Postgres from scratch

```bash
sudo -u postgres psql -c "create database nisba_dev;"
sudo -u postgres psql -c "create database nisba_test;"
sudo -u postgres psql -c "alter role postgres with password 'localdev';"
```

Then point `ADMIN_DATABASE_URL` and `TEST_ADMIN_DATABASE_URL` at them. The
migration creates `nisba_app` and the four role-specific roles itself.

---

## Tests

```bash
npm run typecheck
npm run build                 # the route suite runs against the real build
npm test
```

236 tests, about eleven seconds.

| Suite | What it holds down |
|---|---|
| `src/money/*.test.ts` | 144 tests. Every function, negative margins, zero-revenue deals, currency mismatches, three-decimal and zero-decimal currencies, amounts past 2^53, step snapping, the below-floor routing rule, and a thousand generated splits that must each sum exactly. |
| `tests/structure.test.ts` | Every table has `org_id`, RLS **enabled and forced**, and a policy. The connection role owns nothing and cannot bypass RLS. No financial column is granted to a Member. |
| `tests/isolation.test.ts` | Org A cannot read, join, subquery, update, delete or insert its way into Org B. Context does not survive its transaction. |
| `tests/roles.test.ts` | A Member cannot select a financial column on any table. An account manager sees their own pipeline and cannot reassign a colleague's deal to themselves. |
| `tests/immutability.test.ts` | The audit log refuses edits even from the table's owner. A closed deal's terms cannot move and it cannot be reopened. |
| `tests/routes.test.ts` | The same isolation, over HTTP, against the production build, with real signed sessions — every route, every role. |

The structural suite is the one that matters most over time: it fails on a table
that *has not been written yet* if that table arrives without `org_id`, without
forced RLS, or without a policy.

---

## Deploying

Free, no card, about ten minutes. Nothing here needs a paid tier.

### 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech) (free tier, always-on).
2. Copy the connection string for the owner role. That becomes
   `ADMIN_DATABASE_URL`.
3. Run the migration once from your machine:

   ```bash
   ADMIN_DATABASE_URL='postgres://…' NISBA_APP_DB_PASSWORD='<a long random string>' \
     npm run db:migrate
   ```

   This creates `nisba_app` and the four role-specific roles. `DATABASE_URL` is
   then the same host and database as the admin URL, but as `nisba_app` with the
   password you just set.

### 2. Application — Vercel

1. Import this repository at [vercel.com](https://vercel.com).
2. **Set Root Directory to `nisba`.** The repository root is a different project.
3. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the `nisba_app` connection string, **pooled** |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |

   `ADMIN_DATABASE_URL` and `NISBA_APP_DB_PASSWORD` are **not** set on Vercel.
   The running application must never hold them.

4. Deploy. Visit `/signup`.

The app boots against Neon's pooled connection deliberately: tenant context is
`SET LOCAL` inside a transaction, so it is correct under transaction pooling
rather than merely usually correct.

### A note on Phase 5

Payout statements are PDFs, and headless Chromium does not fit inside a Vercel
serverless function. When Phase 5 lands, the render step wants either
`@sparticuz/chromium-min` or a small container elsewhere. It does not change
anything decided here, and it is not a reason to pick a different host today.

---

## Layout

```
src/
  money/          The money module. Pure, no I/O, exhaustively tested.
                  Every piece of money arithmetic in Nisba is in here.
  db/
    migrations/   Roles and schema, RLS and grants, immutability triggers.
    client.ts     withTenant() — the only way into the database.
    roles.ts      The four application roles and their database roles.
  auth/           Password hashing and the Auth.js configuration.
  server/         Session, onboarding, and read models.
  app/            Routes. Role-differentiated shell.
  i18n/           English and Arabic, typed so a missing string is a build error.
tests/            Isolation, roles, immutability, and HTTP-level route tests.
```

`DECISIONS.md` records the architectural choices and why they were made.

---

## What Phase 0 does not include

Named honestly, so nothing here reads as more finished than it is:

- **Deals cannot be created yet.** Onboarding seeds one and it is fully
  priceable, but there is no "new deal" flow. Next.
- **Costs are a single estimated figure.** Receipt capture, actual-versus-
  estimated drift, and the WhatsApp nudge are Phase 4 — and until they exist,
  every margin in the system is an estimate wearing a precise-looking number.
- **No user invitations.** An organisation gets its Owner at signup. Adding
  account managers, members and partners currently means an insert.
- **Member and Partner views are correct but empty.** They have nothing to show
  until tasks (Phase 3) and payout statements (Phase 5) exist. Both say so, in
  the words of what the reader is trying to do.
- **No dark mode.** The brief did not ask for one and it doubles the design
  surface. Worth doing before anyone uses this all day.
