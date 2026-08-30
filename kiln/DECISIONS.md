# Decisions

The architectural choices the brief asked to be made once and written down.
Each records what was decided, why, and what would make it worth revisiting.

---

## 1. Tenant routing: path-based, not subdomain

**Decided:** organisations are addressed at `/o/{slug}` when multi-org routing
lands. The slug already exists on `organizations` and is unique.

`{org}.kiln.app` needs a registered domain, wildcard DNS, and a wildcard TLS
certificate. None of those exist yet, and none of them buy anything until there
is a second paying customer. Path-based routing works on a free `*.vercel.app`
host today.

The resolver is one function. Moving to subdomains later means changing where
the slug is read from, not changing how anything is scoped — scoping is by
`org_id` in the session, never by the URL.

**Revisit when:** a customer wants their own branded domain, or a proposal share
link needs to look like the agency rather than like Kiln.

---

## 2. Money: integer minor units, held as `bigint`

**Decided:** `Money = { currency, minor: bigint }`. Postgres columns are
`bigint`. No `numeric`, no floats, anywhere.

`numeric` would also have been correct, but it arrives in JavaScript as a string
and every operation would need parsing at the boundary. Integer minor units are
exact by construction and `bigint` cannot silently lose precision above 2^53 —
which a large retainer in a weak currency will reach.

Consequences that are enforced rather than hoped for:

- The currency exponent is data (`EGP` 2, `KWD` 3, `JPY` 0), not the constant 2.
- Rates are basis points, integers. A house rate of 33.33% is `3333`, not
  `0.3333`.
- Division goes through one function with an explicit rounding mode, defaulting
  to banker's rounding so a year of commissions carries no systematic drift.
- Splitting uses the largest-remainder method, so shares sum to the whole
  exactly. There is a test that runs a thousand generated splits and asserts it.

**Revisit when:** never, realistically. This is the decision that is most
expensive to change and least likely to need changing.

---

## 3. Currency is per deal, not per organisation

**Decided:** `deals.currency`, and the FX rate used at close is frozen onto the
deal (`frozen_fx_rate`, `frozen_fx_source`, `frozen_fx_captured_at`).

An agency in Cairo bills an Egyptian client in EGP and a Riyadh client in SAR in
the same week, and both land in one payout period. Recomputing a February margin
at August's rate does not correct February — it destroys a number a partner has
already been paid against.

---

## 4. Isolation: RLS at the database, with four database roles

**Decided:** the application connects as `kiln_app`, which is `NOINHERIT`, owns
nothing, and holds no table privileges. Each request opens a transaction,
`SET LOCAL ROLE`s into one of four role-specific database roles, and
`SET LOCAL`s the tenant context.

Three properties follow from Postgres rather than from discipline:

| If a query forgets… | What happens |
|---|---|
| tenant context | matches nothing (`org_id = NULL` is never true) |
| the role switch | refused: `kiln_app` has no privilege, and no schema `USAGE` |
| that the context is per-request | impossible: `SET LOCAL` dies with the transaction |

That last one is what makes this safe behind a transaction pooler, where the
next request may land on the same physical connection.

`FORCE ROW LEVEL SECURITY` is set on every table, not just `ENABLE`. Without
`FORCE`, a table's owner bypasses its own policies, and the owner is whoever ran
the migration — the single most common way an RLS schema turns out to have been
decorative.

**Revisit when:** never, without a very good reason. Loosening any part of this
is how tenant data leaks.

---

## 5. Column privileges, because RLS cannot hide a column

**Decided:** "a Member must never receive a financial field" is enforced with
`GRANT SELECT (columns…)`, not with careful select lists.

RLS is row-level. It has no opinion about columns. So the four application roles
are real Postgres roles carrying real column grants: asking a Member role for
`deals.agreed_price_minor` is an error, not a filtered result. `SELECT *` from a
table with financial columns fails for a Member — deliberately, because the lazy
query is the dangerous one.

`password_hash` is granted to no application role at all, not even the Owner's.
The Owner may write one (creating a user, resetting a password) and cannot read
one back.

---

## 6. One sanctioned RLS bypass, and only one

**Decided:** `kiln.authenticate_lookup(email)` is `SECURITY DEFINER`, owned by
`kiln_bootstrap` — a role that cannot log in and is reachable only through that
function.

Sign-in is the one moment where tenant context cannot exist yet: which
organisation an email belongs to is the question being asked. Everything else,
signup included, runs under ordinary tenant context — signup mints the org id
first, sets context to it, and then satisfies the same policies every other
request does.

A test asserts this is the only `SECURITY DEFINER` function in the schema, that
its owner cannot log in, and that only `kiln_app` may execute it.

> During Phase 0 this function was briefly owned by `postgres`, which would have
> run it as a superuser and bypassed RLS entirely rather than through the narrow
> role. The structural test caught it. That is what the test is for.

---

## 7. Freeze on close, enforced by constraint and trigger

**Decided:** a `won` deal cannot exist without `closed_at`,
`frozen_house_rate_bp` and `frozen_split_rules` (a `CHECK` constraint), and once
won, its price, currency, FX rate, split rules and close time cannot change (a
`BEFORE UPDATE` trigger). It cannot be reopened.

Costs and delivery dates may still move, because those are not the terms.

The audit log is append-only the same way: no application role holds `UPDATE` or
`DELETE`, *and* a trigger refuses both plus `TRUNCATE`, so it holds even for the
role that owns the table.

---

## 8. Auth: email and password, self-hosted

**Decided:** Auth.js v5 with a Credentials provider and JWT sessions. Passwords
hashed with scrypt from Node's standard library.

scrypt rather than argon2id because argon2 needs a native module, and a native
module is a deployment failure waiting to happen on a serverless host. The work
factor is stored in the hash string, so it can be raised later without
invalidating existing passwords.

No third party holds the identities, and nothing depends on an email arriving —
which matters given that notifications are meant to go over WhatsApp.

The session carries `orgId` and `role`. **Tenant context is read from the signed
session and from nowhere else**: not a header, not a query parameter, not a path
segment, not a body field. This is the trust boundary of the whole design, it is
one function (`contextFor`), and there is a route-level test that throws org
ids at headers and query strings and asserts they are ignored.

---

## 9. Localisation: RTL from the first byte

**Decided:** `dir` and `lang` are set on the root element from a cookie, and
switching language is a **full document navigation** through
`/locale/[locale]`, not a client-side update.

Changing locale changes `dir`, and patching that during a soft navigation races
the content — for a frame or two, Arabic text lays out left-to-right. Serving a
fresh document means the direction is right before anything paints.

That route returns a **relative** `Location`. `NextResponse.redirect` builds an
absolute URL from the server's own view of its host (`localhost` locally, the
upstream origin behind a proxy); redirecting there moves the browser to a
different origin from the one the `Set-Cookie` applies to, and the cookie is
silently dropped. This was a real bug, caught in a browser, and there is now a
test asserting the header stays relative.

Typography is IBM Plex Sans with IBM Plex Sans Arabic: the Arabic is drawn as
Arabic rather than derived from the Latin, and the two are metrically compatible,
so a bilingual financial table keeps one baseline grid across a language switch.

Arabic defaults to Arabic-Indic digits (`٠١٢٣`), overridable per organisation —
Gulf finance teams often prefer Latin digits on money inside an otherwise Arabic
interface.

---

## 10. Losses are absorbed by the house

**Decided:** when a deal loses money, the house takes the entire loss and the
split engine sees zero. It never sees a negative number.

A negative distributable means invoicing a freelancer for their share of a deal
that went wrong. No agency does that, and a payout engine that *can* produce a
negative statement will eventually produce one by accident.

**Revisit when:** an agency with genuine equity partners wants losses shared.
That is a per-organisation policy, not a change to the arithmetic.

---

## 11. Colour is reserved for margin

**Decided:** saturation belongs to margin state and nothing else. No success
green, no link blue, no accent. Everything that is not margin is ink on a quiet
ground.

If green means "this deal is healthy", then a green anything-else costs green
its meaning. The ground is a cool greige, deliberately neither the
cream-and-serif nor the near-black-and-acid that the brief ruled out.

Members and Owners get visibly different shells: the Member view is narrower,
has no organisation name, no role chip, and no navigation. They should not feel
like two views of one product, because one of them has no business knowing what
anything costs.
