# Qirat

Every deal an agency signs becomes a branded proposal, a task board, a live
margin, and a payout — from a single card.

**Phases 0, 1, 4 and 5 are in — the whole wedge, end to end.** Sign up, drag a
price, record what you actually spent, close the month, and a partner opens a
statement showing every deal they touched and what it earned them. Tenant
isolation, four enforced roles and the immutability rules are proved by an
automated suite.

`../` in this repository is a different project (`moments-superapp`). Qirat lives
entirely in this directory and shares nothing with it.

---

## Running it locally

Needs Node 22 and Postgres 16.

```bash
cd qirat
npm install
cp .env.example .env          # then fill in the values
npm run db:migrate            # creates roles, schema, RLS policies
npm run dev                   # http://localhost:3000
```

Create an agency at `/signup`. You land on a populated deal card, not an empty
state: five services priced, a brand kit, a client and a sample deal.

### Local Postgres from scratch

```bash
sudo -u postgres psql -c "create database qirat_dev;"
sudo -u postgres psql -c "create database qirat_test;"
sudo -u postgres psql -c "alter role postgres with password 'localdev';"
```

Then point `ADMIN_DATABASE_URL` and `TEST_ADMIN_DATABASE_URL` at them. The
migration creates `qirat_app` and the four role-specific roles itself.

---

## Tests

```bash
npm run typecheck
npm run build                 # the route suite runs against the real build
npm test
```

303 tests, about fifteen seconds.

| Suite | What it holds down |
|---|---|
| `src/money/*.test.ts` | 181 tests. Every function, negative margins, zero-revenue deals, currency mismatches, three-decimal and zero-decimal currencies, amounts past 2^53, step snapping, the below-floor routing rule, cost drift, and a thousand generated splits plus a thousand generated payout periods that must each balance exactly. |
| `tests/structure.test.ts` | Every table has `org_id`, RLS **enabled and forced**, and a policy. The connection role owns nothing and cannot bypass RLS. No financial column is granted to a Member. |
| `tests/isolation.test.ts` | Org A cannot read, join, subquery, update, delete or insert its way into Org B. Context does not survive its transaction. |
| `tests/roles.test.ts` | A Member cannot select a financial column on any table. An account manager sees their own pipeline and cannot reassign a colleague's deal to themselves. |
| `tests/immutability.test.ts` | The audit log refuses edits even from the table's owner. A closed deal's terms cannot move and it cannot be reopened. |
| `tests/costs.test.ts` | A Member can record a cost and cannot read one back — not even their own. An account manager sees costs on their own deals only. A cost cannot attach to another organisation's deal. |
| `tests/payouts.test.ts` | A Partner sees their own statement and no one else's. Statements cannot be edited or deleted, including by the role that owns the table. A closed period cannot be reopened. Corrections require a reason. |
| `tests/routes.test.ts` | The same isolation, over HTTP, against the production build, with real signed sessions — every route, every role. |

The structural suite is the one that matters most over time: it fails on a table
that *has not been written yet* if that table arrives without `org_id`, without
forced RLS, or without a policy.

---

## Trying it without deploying

`demo/deal-card.html` is the price instrument as one self-contained page — the
same money arithmetic, no server. The signature moment of this product is a
physical one, and a screenshot cannot carry it; open the page on a phone and
drag the handle past the floor.

## Deploying

Free, no card, about ten minutes. Nothing here needs a paid tier.

### 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech) (free tier, always-on).
2. Copy the connection string for the owner role. That becomes
   `ADMIN_DATABASE_URL`.
3. Run the migration once from your machine:

   ```bash
   ADMIN_DATABASE_URL='postgres://…' QIRAT_APP_DB_PASSWORD='<a long random string>' \
     npm run db:migrate
   ```

   This creates `qirat_app` and the four role-specific roles. `DATABASE_URL` is
   then the same host and database as the admin URL, but as `qirat_app` with the
   password you just set.

### 2. Application — Vercel

1. Import this repository at [vercel.com](https://vercel.com).
2. **Set Root Directory to `qirat`.** The repository root is a different project.
3. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the `qirat_app` connection string, **pooled** |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |

   `ADMIN_DATABASE_URL` and `QIRAT_APP_DB_PASSWORD` are **not** set on Vercel.
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
                  Every piece of money arithmetic in Qirat is in here.
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
  priceable, but there is no "new deal" flow.
- **The split policy has no editor.** Onboarding seeds a sensible one — a fifth
  of distributable profit to whoever closed the deal, a twentieth to the team
  pool — and `setSplitRulesAction` exists and is validated, but adding a partner
  currently means an insert. The screen shows the policy; it does not yet edit
  it.
- **Statements print rather than download.** A browser's save-as-PDF produces a
  real PDF from the page; a server-rendered one needs the render service.
- **Proposal Studio is untouched.** It was moved behind the payout engine
  deliberately, and that was the right call: the wedge now works end to end.
- **No receipt photos.** Costs are recorded as amount, vendor and date; the
  column for the image is there and needs object storage credentials. The
  WhatsApp evening nudge that makes this happen without anyone opening the app
  is still ahead.
- **Costs in a second currency are counted, not converted.** A USD licence on an
  EGP deal is excluded from the total and the card says how many are missing,
  rather than adding two currencies as though they were one.
- **No user invitations.** An organisation gets its Owner at signup. Adding
  account managers, members and partners currently means an insert.
- **Member and Partner views are correct but empty.** They have nothing to show
  until tasks (Phase 3) and payout statements (Phase 5) exist. Both say so, in
  the words of what the reader is trying to do.
- **No dark mode.** The brief did not ask for one and it doubles the design
  surface. Worth doing before anyone uses this all day.
