# Decisions

The architectural choices the brief asked to be made once and written down.
Each records what was decided, why, and what would make it worth revisiting.

---

## 1. Tenant routing: path-based, not subdomain

**Decided:** organisations are addressed at `/o/{slug}` when multi-org routing
lands. The slug already exists on `organizations` and is unique.

`{org}.unlost.app` needs a registered domain, wildcard DNS, and a wildcard TLS
certificate. None of those exist yet, and none of them buy anything until there
is a second paying customer. Path-based routing works on a free `*.vercel.app`
host today.

The resolver is one function. Moving to subdomains later means changing where
the slug is read from, not changing how anything is scoped — scoping is by
`org_id` in the session, never by the URL.

**Revisit when:** a customer wants their own branded domain, or a proposal share
link needs to look like the agency rather than like Unlost.

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

**Decided:** the application connects as `unlost_app`, which is `NOINHERIT`, owns
nothing, and holds no table privileges. Each request opens a transaction,
`SET LOCAL ROLE`s into one of four role-specific database roles, and
`SET LOCAL`s the tenant context.

Three properties follow from Postgres rather than from discipline:

| If a query forgets… | What happens |
|---|---|
| tenant context | matches nothing (`org_id = NULL` is never true) |
| the role switch | refused: `unlost_app` has no privilege, and no schema `USAGE` |
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

**Decided:** `unlost.authenticate_lookup(email)` is `SECURITY DEFINER`, owned by
`unlost_bootstrap` — a role that cannot log in and is reachable only through that
function.

Sign-in is the one moment where tenant context cannot exist yet: which
organisation an email belongs to is the question being asked. Everything else,
signup included, runs under ordinary tenant context — signup mints the org id
first, sets context to it, and then satisfies the same policies every other
request does.

A test asserts this is the only `SECURITY DEFINER` function in the schema, that
its owner cannot log in, and that only `unlost_app` may execute it.

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

---

## 12. The name

**Decided:** Unlost. The product was called Kiln for one day.

"Kiln" was built on Clay's own metaphor — the oven that fires clay. That works
for one agency's internal tool and stops working the moment a studio in Jeddah
or Beirut opens it, because the name is about somebody else. In Arabic it says
nothing at all.

نِسبة carries both halves of the product at once: **the ratio** — margin, share,
the split — and **affiliation** — who belongs to what, who draws from what.
Three syllables, unambiguous in English, and not a translation of anything.

An Arabic name on a B2B product sold internationally also does work at the
committee table: it says this came out of a real market rather than being
assembled from one.

A search turned up no SaaS using it. Trademark clearance is a legal question and
has not been done.

---

## 13. Two materials, and colour that means one thing

**Decided:** the workspace is paper — a cool grey leaning slightly green,
explicitly not cream. The deal card is a **different material**: a solid dark
petrol body sitting on top of it.

Every number in the product lives inside that body. This is "card-first, not
dashboard-first" made visible instead of explained: a dashboard is something you
check, a card is something you do, and the two do not look alike here.

Saturation is reserved entirely for margin. No green button, no green success
tick, no green anything. If green means healthy profit, a second green costs the
first one its meaning.

---

## 14. Three signals, but two different questions

**Decided:** the card answers two things separately, because conflating them
makes one of them lie.

- **Where the price sits** — `marginSignal`, which consults the floor. Below it,
  the price reads red, the track reads red, and the button changes its words.
- **How the margin is doing** — `marginHealth`, which consults only the margin.

A deal sold under the floor can still carry a 64% margin. The first draft
coloured that bar red, and it was wrong: the bar measures profit, the profit was
fine, and the red was reporting a pricing policy as though it were a loss. Now
the price says "you broke the floor" and the bar goes on saying "64%, healthy".
Both true, neither distorted to agree with the other.

The third signal is deliberately `below-floor` rather than "critical". The floor
is a line the agency drew itself, so crossing it is a fact rather than a
judgement about a percentage.

---

## 15. Below the floor, the vocabulary changes

**Decided:** a price under the floor is never blocked, disabled, or met with an
error. The button stops saying *Close the deal* and starts saying *Send for
approval*.

The limit is a door to somewhere, not a wall. The account manager is not stopped
and is not scolded; the journey continues through the entrance it belongs to.

The wording is a courtesy to the person dragging. The **rule** is
`routeForClose`, a pure function in the money module, evaluated on the server
against the band as stored — because the browser has to know the band in order
to draw the track, which means the browser can also lie about it. Asking the
server to close a below-floor deal routes it to approval regardless of what the
client believed.

---

## 16. The instrument has a body

**Decided:** the price slider is the one place in the product with weight.

- **Detents** at floor, target and ceiling. Within grabbing distance the handle
  takes the exact value, so "on the floor" and "on target" are places you can
  land rather than approximately hit.
- **Resistance** below the floor: the handle travels 45% of the distance the
  finger does. The floor becomes something you feel yourself pushing past.
- **Haptics** on crossing a detent, stronger at the floor than the others.
- **Nice steps** — the reading lands on 500 rather than 63,847, via
  `niceStepFor`, because a price is something you say out loud to a client.
- The track extends **below** the floor. A slider that stopped there would be
  lying about what is allowed.

The margin is recomputed in the browser by importing the same money module the
server uses — not a re-implementation, not floats for the preview. That is why
the number mid-drag and the number stored on release cannot disagree.

---

## 17. RTL, written down once

**Decided:** four rules, so they stop being re-decided per component.

1. **Numbers stay left-to-right inside Arabic text.** This is the one that
   breaks most and shows up last: an amount at the end of an Arabic sentence
   gets reordered by the bidi algorithm and separators migrate. Every figure
   renders inside `<bdi dir="ltr">` via a `Figure` component.
2. **The margin bar fills from the inline start** — left in English, right in
   Arabic. It is a quantity, and quantity follows reading direction.
3. **A time axis always runs left to right**, in both languages. Time is not a
   quantity. These two rules look contradictory and are not, which is exactly
   why both are written here.
4. **Logical properties from the first line.** `margin-inline-start`, never
   `margin-left`. Nothing needs an RTL override later because nothing was
   written physically in the first place.

In a right-to-left track the arrow keys follow the screen, not the number: the
arrow pointing at the ceiling raises the price.

**Typography:** Alexandria for headings — drawn for Arabic and Latin together,
and specifically not Cairo, which has become the default on everything Egyptian
and now reads as one. IBM Plex Sans / Plex Sans Arabic for text. IBM Plex Mono
with tabular figures for readings, because numbers are the content and a
proportional face lets them change width as they change value, which makes the
whole row twitch on every frame of a drag.
