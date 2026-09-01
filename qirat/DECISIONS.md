# Decisions

The architectural choices the brief asked to be made once and written down.
Each records what was decided, why, and what would make it worth revisiting.

---

## 1. Tenant routing: path-based, not subdomain

**Decided:** organisations are addressed at `/o/{slug}` when multi-org routing
lands. The slug already exists on `organizations` and is unique.

`{org}.qirat.app` needs a registered domain, wildcard DNS, and a wildcard TLS
certificate. None of those exist yet, and none of them buy anything until there
is a second paying customer. Path-based routing works on a free `*.vercel.app`
host today.

The resolver is one function. Moving to subdomains later means changing where
the slug is read from, not changing how anything is scoped — scoping is by
`org_id` in the session, never by the URL.

**Revisit when:** a customer wants their own branded domain, or a proposal share
link needs to look like the agency rather than like Qirat.

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

**Decided:** the application connects as `qirat_app`, which is `NOINHERIT`, owns
nothing, and holds no table privileges. Each request opens a transaction,
`SET LOCAL ROLE`s into one of four role-specific database roles, and
`SET LOCAL`s the tenant context.

Three properties follow from Postgres rather than from discipline:

| If a query forgets… | What happens |
|---|---|
| tenant context | matches nothing (`org_id = NULL` is never true) |
| the role switch | refused: `qirat_app` has no privilege, and no schema `USAGE` |
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

**Decided:** `qirat.authenticate_lookup(email)` is `SECURITY DEFINER`, owned by
`qirat_bootstrap` — a role that cannot log in and is reachable only through that
function.

Sign-in is the one moment where tenant context cannot exist yet: which
organisation an email belongs to is the question being asked. Everything else,
signup included, runs under ordinary tenant context — signup mints the org id
first, sets context to it, and then satisfies the same policies every other
request does.

A test asserts this is the only `SECURITY DEFINER` function in the schema, that
its owner cannot log in, and that only `qirat_app` may execute it.

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

**Decided:** Qirat. The product was called Kiln for one day.

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

---

## 18. The name, third time

**Decided:** Qirat (قيراط).

Three names in one session is not a good look, so the reasoning is worth
recording rather than repeating.

- **Kiln** was Clay's own metaphor — the oven that fires clay. Fine for one
  agency's internal tool, wrong for a product a studio in Jeddah opens.
- **Nisba** (نِسبة) was strong and the availability check came back clean. It
  was dropped by preference, not by conflict.
- **Unlost** was preferred, and turned out to be taken twice: unlost.ai, an AI
  recall tool in the same software space, and an Unlost app on Google Play.

A search across six candidates found five already in use, and the pattern is
worth knowing: **short Arabic financial words are almost all taken**, because
MENA fintech is crowded. Mizan is an Egyptian commerce SaaS and an Islamic
banking core. Hissa is an Indian cap-table platform — directly adjacent to "who
owns what share". Qist is QisstPay, which has raised $15M. Sanad is sanad.ai.
The English namespace is worse: Reckon, Tally and Divvy are all established
accounting or expense products.

**Qirat** survives because it is a longer, more specific word, and it carries
the product in one term. A qirat is a unit of measure — the carat — and in
Egypt it is also a share in a property: *قيراط في المشروع*, a stake in the
project. Measurement and share, which is exactly what a margin and a payout
are.

**The open risk, recorded rather than buried:** a US entity, Qirat LLC, holds
one trademark in the advertising and business-services class. That class is
adjacent to an agency operations platform. This is a lawyer's question, not an
engineer's, and it should be answered before the name goes on a contract or an
investor document. The rename itself is mechanical and reversible.

---

## 19. The payout engine balances, or the period does not close

**Decided:** `computePayouts` splits each deal independently using the rules
frozen onto that deal, then gathers the results per person. Before a single row
is written, `checkPayoutRunBalances` proves that, for every currency:

    every statement + the bonus pool + what the agency retained
      = the distributable profit of every deal in the period

If that fails, the close is **refused** and the error says it is a bug rather
than a rounding difference. An unbalanced run is money on one side of the books
and not the other, and writing it would make the product worse than the
spreadsheet it replaces.

A thousand generated periods are tested for this invariant, with random
revenues, costs, house rates and deal owners.

**Splitting per deal rather than pooling first** is what lets a statement show
its working: a partner sees each deal, the pool it produced, the rate applied
and their share of it. That is the only form of a payout number anyone can
actually agree with or dispute.

---

## 20. What a Partner may see, precisely

**Decided:** two separate lists, because one list was wrong.

`MEMBER_FORBIDDEN_COLUMNS` is everything financial. A Member sees assigned work
and no number anywhere.

`PARTNER_FORBIDDEN_COLUMNS` is shorter, and the difference *is* the product: a
Partner is entitled to their own payout — the amount, the deals behind it, the
rate it was paid at. What they may not see is the agency's economics: any deal's
price, any service's band, any cost, the house rate.

Row-level security does the other half. A Partner may select a statement amount,
but only on rows where they are the beneficiary. There is no "mine" clause in
the query that reads statements — an Owner gets the organisation's and a Partner
gets their own, and the difference is a policy, so the route cannot get it wrong
and neither can the next route.

The first version of this used one list for both roles, which failed a test by
forbidding a Partner from seeing their own statement. That test was right.

---

## 21. Statements are fixed; corrections are entries

**Decided:** `payout_statements` holds no UPDATE or DELETE privilege for any
role, *and* a trigger refuses both plus TRUNCATE — so it holds for the role that
owns the table too. A correction is a new signed row in `payout_adjustments`
carrying a reason, and adjustments are themselves immutable.

A closed period cannot be reopened, by the same reasoning: reopening would
restate statements people have already been paid against.

The question a partner asks two years later is not "what does it say now" but
"what changed, and who changed it". Only an append-only ledger can answer that.

**PDF:** a statement is a printable page rather than a server-rendered PDF.
Chromium does not fit in a serverless function, and a browser's own "save as
PDF" produces a real one from a page designed to print. When a render service
exists, the same markup becomes the PDF template.

---

## 22. A service costs what it is made of

**Decided:** every service carries a `cost_template` — the videographer, the kit,
the editor, the catering — and the estimate on a deal is that template priced
out, not a number somebody remembered.

The range alone (`default_cost_min_minor` / `max`) gave no reasoning. An estimate
nobody can take apart is an estimate nobody argues with, and an estimate nobody
argues with is how a margin quietly becomes fiction three deals before anyone
notices.

The template is **not** granted to a Member. `task_template` is theirs; what the
work costs is not. The Member grant names its columns explicitly, so a new
column is excluded by default — which was the intent, and is now commented so
the next person knows it was a decision.

**The seeded rates are a starting structure, not researched market data.** They
are plausible Cairo day rates chosen to total inside each service's existing cost
range, and the screen says so under the catalogue. An agency replaces them in the
first week; the structure is the part that carries over.

Three tests keep the seed honest: every template totals inside its own service's
range, every service still makes money at its own floor, and every line is named
in both languages.

### What the templates immediately showed

Priced out, four of the five services return 36–47% margin at their floor price.
**Video Production returns 14.4%.**

That is not a bug in the template; it is the pricing. The floor on video is set
where a shoot barely covers itself, and the reason is visible in the build-up:
location and permits, talent, transport and catering come to 6,200 — most of a
third of the cost, and precisely the sort of spending that reaches a spreadsheet
late or not at all. An agency selling video near its floor and forgetting the
catering is losing money on it.

Surfacing that on day one, from the seed, is the product working.

## 23. A margin is computed on net, always

This is the gap the product exists to close in Europe, and it is arithmetic
rather than a feature.

An agency in Berlin invoices a client in Paris under the reverse charge, so it
adds no VAT: the invoice reads 10,000 and the agency earns 10,000. The
freelancer who did the work invoices 4,000 plus 19%, so 4,760 leaves the bank.
Put those two numbers side by side — which is what a spreadsheet does — and the
deal reports **52.4%**. The real margin is **60%**, because the 760 is reclaimed:
it was never the agency's money, it was the tax authority's, held briefly.

On one deal that is an argument about a number. On a commission calculation it is
a shortfall in somebody's pay, every month, in the direction they are least able
to check: on this deal the account manager's share is 600 rather than 524.

So: **VAT collected is not revenue and VAT paid is not a cost** — unless the
agency cannot reclaim it, which is the one case that flips and is handled
explicitly. `src/money/tax.ts` computes it; nothing in it infers a legal position
from a country code, because which treatment applies to a given supply is a
question for the agency and its accountant.

Five treatments, and four of them charge nothing for four different reasons:
`standard`, `reverse_charge`, `zero_rated`, `exempt`, `not_registered`. The card
says which, in words, because "no VAT" and "the client accounts for the tax"
describe different obligations and only one of them is somebody else's.

## 24. The reclaim decision is made once and stored

`costs.amount_minor` is **what the cost cost** — the net when the agency reclaims
the tax, the whole invoice when it cannot. `costs.vat_minor` is the reclaimable
part, recorded so the VAT position can be answered without re-deriving it.

The first version of this read `organizations.vat_registered` at query time and
added the VAT back for an unregistered agency. That was wrong for the same reason
a deal reads its frozen house rate rather than today's: an agency that
deregisters next year would have silently changed what last year's deals cost,
and every closed statement would stop reconciling. The decision is now made when
the money goes out and written down. `tests/vat.test.ts` flips the organisation's
registration and asserts a closed deal's cost does not move.

An agency that cannot reclaim is never asked the question. For it the tax is part
of what the work cost, the whole figure goes in, and the margin is right without
anyone having to think about it.

## 25. Open deals follow the agency; closed ones never do

A deal that has not closed has not been invoiced, so there is no paper to
contradict. When an agency registers for VAT, every open deal still sitting on
the old default moves with it — an agency that crosses the threshold on Tuesday
should not have to open every draft to say so.

A deal deliberately set to something else stays where somebody put it, which is
why the action reads the outgoing default before overwriting it: only the old
value can tell a deal that was following the agency from a deal that was set by
hand.

A closed deal is the opposite. Its treatment and rate are frozen at close beside
the house rate and the split rules, because a VAT rate changes by legislation,
sometimes at a few weeks' notice, and an invoice issued at 19% must keep saying
19% afterwards or every historical deal disagrees with the paper the client is
holding.

## 26. Two catalogues, one standard

A European agency signing up gets `EUROPE_SERVICES` priced in euros, a MENA one
gets `DEFAULT_SERVICES` in pounds, and `startingPointFor(country)` decides.
Neither is a translation of the other: a Berlin studio sells a "Brand Identity
System" where a Cairo one sells a "Brand Book", and the cost build-ups are
different because the costs are different.

What is identical is the standard both are held to. The same tests run over both:
every cost build-up totals inside its own range, every service still makes money
at its own floor, every band is ordered, every cost line is named in both
languages. A European agency that signed up and found a service whose floor loses
money would have been handed the same broken product, in euros.

The country never registers an agency for VAT on its behalf. It offers a rate and
then stops talking; whether the agency is registered is a fact about the agency,
and assuming it would put tax on invoices that must not carry it.

## 27. Everyone signs in as themselves

An organisation could previously only ever hold its owner. Four roles were
enforced in the database, tested at the query layer and over HTTP — and
reachable by nobody, because there was no way to create a second account.

So: the Owner adds people, and each gets a **username** and a password. A
username rather than an email address, because a freelancer is not an email
address: people join for one shoot and leave, half of them share a family
address, and this product notifies over WhatsApp precisely because email is
where work goes to be ignored here. `users.email` is now nullable and a phone
number is the way to reach somebody; a `users_reachable` check requires one of
the two, so an account nobody can sign into and nobody can contact cannot exist.

The password the Owner chooses is handed back to them once, in readable form, so
they can pass it on however they already talk to that person. It is stored only
as a scrypt hash, and the account is flagged `must_change_password`.

The one sanctioned RLS bypass — `qirat.authenticate_lookup` — now matches either
credential in a single query. Two lookups would answer "does this username
exist?" by which one came back faster.

## 28. A day rate, frozen onto the assignment

Every margin in the product used to be computed as though the agency's own
people were free. That is the single most flattering assumption a spreadsheet
can make, and it is why agencies believe retainers are profitable.

A person has a **day rate**. Days, not hours: agencies quote crew, editors and
designers by the day, an hour is a unit people estimate badly and record worse,
and quarter-days cover the honest cases. Quantities are hundredths, so 0.5 is
expressible and 0.333 is refused rather than silently rounded — somebody who
types a third means a third, and this system does not have thirds.

**The rate is copied onto the assignment**, not read from the person. Same rule
as the house rate on a closed deal: a raise in June must not change what April's
work cost. `deal_assignments.day_rate_minor` is where the rate stops moving, and
`work_log` copies it again onto each entry, so a row keeps saying what it said
when it was written.

Logged days reach the deal card's cost, the margin, and the payout run.
`tests/team.test.ts` closes a deal and proves it: the same deal pays its account
manager **4,520 instead of 5,500** once the days that delivered it are counted.

## 29. A Member's own numbers are not the agency's numbers

The rule was "a Member must never receive a financial field". That was too
blunt, and the Partner already showed why: a Partner sees their own statement,
because a person is entitled to know what they are owed.

The rule is now stated precisely. A Member may never see a fact about the
**agency's** economics — any deal's price, any margin, any service band, what a
colleague costs. They may see facts about **themselves**: their own day rate,
the rate their assignment was agreed at, and the days they logged. Row-level
security does the part a column list cannot — `users`, `deal_assignments` and
`work_log` all restrict a Member to rows that are their own.

Which is why the timesheet is a **separate table from `costs`**. A Member holds
INSERT on `costs` and no SELECT at all, and that asymmetry is load-bearing: a
Member reading their own logged days must not become a Member reading a
printer's invoice. They are also genuinely two kinds of money — `costs` is what
left the bank, `work_log` is time that never did — and the deal card sums both.

Two clauses in `work_log_member_write` matter beyond the obvious. A Member may
log only in their own name, and only against a deal they are actually on. Without
the second, "did the insert succeed" answers "is this a real deal id" for
anybody willing to guess.

## 30. The Member's portal is the light material

A Member's screen has no dark card. The dark card is the deal's economics, and
this person is not being shown economics — giving them the same body would
promise a number that is not coming. Their portal is paper: what you are on,
what your day is worth, and a form with two fields for saying you worked
Tuesday. No colour appears on it at all, which is the colour rule holding rather
than an omission.
