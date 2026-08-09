# Clay — Website Architecture & Design System

**Clay Creative Agency** · "Shape Potential."
This document is the engineering and UX companion to `index.html` (the production frontend). Every decision below is derived from the official Brand Guidelines and Company Profile.

---

## 1. Brand Foundation (extracted from the official documents)

### 1.1 Palette — intentionally minimal, monochrome

| Token | Name | Hex | Usage (per guidelines) |
|---|---|---|---|
| `--ink` | Black | `#000000` | Primary text, headlines, key elements |
| `--paper` | White | `#FFFFFF` | Backgrounds, clean layouts |
| `--fog` | Light Gray | `#F5F5F5` | Soft surfaces, section grounds |
| `--mist` | Gray | `#E0E0E0` | Hairline rules, borders |
| `--stone` | Dark Gray | `#B3B3B3` | Secondary text, captions |
| `--raw-clay` | Raw Clay | `#8C7B6C` | **Extension** — reserved exclusively for the *Formed by Clay* initiative; never competes with the monochrome core |

> Guideline note honored: *"Do not use other colors as primary brand colors."* The single earthy accent is scoped to the sub-brand only.

### 1.2 Typography

- **Primary typeface:** Suisse Int'l — with the guideline-approved alternates **Neue Haas Grotesk → Helvetica Neue → Inter → Satoshi**.
- Web stack: `"Suisse Int'l", "Neue Haas Grotesk", "Helvetica Neue", Inter, Helvetica, Arial, sans-serif`
- Weights used: Light 300 (oversized display), Regular 400 (body), Medium 500 (UI/labels), Bold 700 (emphasis) — *"Do not use indistinguishable weights."*
- Display headlines end with a period — the deck's own voice: **"Shape Potential."**
- Micro-labels: uppercase, `letter-spacing: 0.14em` (matches "CLAY CREATIVE AGENCY" footer treatment in the deck).

### 1.3 Voice & messaging (used verbatim across the site)

- Essence: **Shape Potential.** / **Potential, made visible.** / **From raw material to meaningful form.**
- Manifesto: *"Before technology. Before markets. Before anything."*
- CLAY method: **C**reate · **L**isten · **A**dapt · **Y**ield
- Approach: 01 Listen · 02 Discover · 03 Shape · 04 Build · 05 Evolve
- Values: Clarity · Intent · Substance · Craft · Evolution
- Services: Strategy · Identity · Messaging · Experience · Systems · Evolution
- Tone: Clear. Thoughtful. Human. Confident — *certain, never loud.* Purposeful.

---

## 2. Recommended Full-Stack Architecture

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router, RSC)** | Static-quality performance for the marketing surface, server actions for forms, one codebase for site + portal |
| UI | **React 19 + Tailwind CSS v4** | Design tokens map 1:1 into `@theme` (see §2.2) |
| Motion | **Framer Motion** (site) + CSS transitions (portal) | Orchestrated reveals on the editorial pages; restraint in the dashboard |
| Database | **PostgreSQL** (Neon/Supabase) | Relational integrity for intakes ↔ contracts ↔ signatures, applications, bookings |
| ORM | **Prisma** | Typed schema shared across server actions and the portal |
| Auth | **Auth.js (NextAuth v5)** — email magic-link | Frictionless: applicants and clients never create passwords |
| Contracts / e-sign | **Own audit-trailed acceptance record** (hash of contract body + timestamp + IP + typed-name signature), optionally escalating to DocuSign/Dropbox Sign API for countersigned PDFs | Keeps the flow in-brand and frictionless; PDF generation via `@react-pdf/renderer` |
| Files (CVs, portfolios, briefs) | **S3-compatible storage** (R2) with signed upload URLs | |
| Payments (course booking) | **Stripe Checkout** | Deposit or full payment at booking confirmation |
| Email | **Resend + React Email** | Branded transactional mail (contract copy, application receipt, booking confirmation) |
| CMS (portfolio) | **MDX in-repo or Sanity** | Case studies are art-directed; MDX gives per-project layout control |
| Hosting | **Vercel** | |

### 2.2 Design tokens → Tailwind v4

```css
@theme {
  --color-ink: #000000;
  --color-paper: #ffffff;
  --color-fog: #f5f5f5;
  --color-mist: #e0e0e0;
  --color-stone: #b3b3b3;
  --color-raw-clay: #8c7b6c;
  --font-sans: "Suisse Int'l", "Neue Haas Grotesk", "Helvetica Neue", Inter, Helvetica, Arial, sans-serif;
  --tracking-label: 0.14em;
}
```

### 2.3 Data model (Prisma, abridged)

```prisma
model Intake {
  id           String   @id @default(cuid())
  company      String
  contactName  String
  email        String
  industry     String?
  companySize  String?
  services     String[]          // Strategy | Identity | Messaging | Experience | Systems | Evolution
  brief        String
  budgetBand   String
  timeline     String
  status       IntakeStatus @default(SUBMITTED)  // SUBMITTED → REVIEWED → CONTRACT_SENT → SIGNED
  contract     Contract?
  createdAt    DateTime @default(now())
}

model Contract {
  id            String   @id @default(cuid())
  intakeId      String   @unique
  intake        Intake   @relation(fields: [intakeId], references: [id])
  reference     String   @unique        // e.g. CLA-2026-0148
  bodyMarkdown  String                  // rendered terms at time of send
  bodySha256    String                  // integrity hash — what was accepted
  signedName    String?
  signedEmail   String?
  signedAt      DateTime?
  signedIp      String?
  status        ContractStatus @default(DRAFT)   // DRAFT → SENT → ACCEPTED
}

model Application {
  id        String   @id @default(cuid())
  track     Track                       // CAREER | TRAINING
  roleSlug  String                      // job or program id
  name      String
  email     String
  portfolio String?
  cvUrl     String?
  note      String?
  status    AppStatus @default(RECEIVED) // RECEIVED → SHORTLIST → INTERVIEW → OFFER | ARCHIVED
  createdAt DateTime @default(now())
}

model Course {
  id        String    @id @default(cuid())
  slug      String    @unique
  title     String
  level     String
  weeks     Int
  priceEGP  Int
  sessions  CourseSession[]
}

model CourseSession {
  id        String   @id @default(cuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  startsOn  DateTime
  seats     Int
  bookings  Booking[]
}

model Booking {
  id         String   @id @default(cuid())
  sessionId  String
  session    CourseSession @relation(fields: [sessionId], references: [id])
  name       String
  email      String
  reference  String   @unique          // e.g. ACD-2026-0072
  paidVia    String?                   // stripe checkout id
  status     BookingStatus @default(RESERVED) // RESERVED → CONFIRMED → ATTENDED
  createdAt  DateTime @default(now())
}
```

### 2.4 Route map (App Router)

```
app/
  (site)/
    page.tsx                     → Hero + Philosophy
    work/page.tsx                → Selected Works index
    work/[slug]/page.tsx         → Case study (MDX, art-directed)
    begin/page.tsx               → Client intake wizard (steps 1–3)
    begin/agreement/page.tsx     → Contract preview + digital acceptance
    formed-by-clay/page.tsx      → Initiative
  (academy)/
    academy/page.tsx             → Path selector (Careers / Training / Courses)
    academy/careers/...          → Roles + application drawer
    academy/training/...         → Programs + application
    academy/courses/...          → Catalogue → session → booking → Stripe
  api/…                          → server actions preferred; webhooks (stripe, resend) here
```

Component tree for the sections implemented in `index.html` (1:1 mapping when porting to React):
`<SiteNav>` `<Hero>` `<Philosophy>` `<Method>` `<WorksGallery><WorkCard>` `<IntakeWizard><StepCompany|StepProject|StepScope><ContractPreview><SignaturePad>` `<AcademyShell><AcademyRail><CareersPanel><TrainingPanel><CoursesPanel><ApplyDrawer><BookingPanel>` `<FormedByClay>` `<Footer>`

---

## 3. UI/UX Wireframe Concepts — keeping "Quiet Luxury" under complexity

### 3.1 Selected Works — the museum catalogue

- **Grid:** 12-column Swiss grid; pieces alternate 7/5 and 5/7 column spans with one full-bleed "featured acquisition" per screen. Asymmetry creates rhythm; alignment creates calm.
- **Exhibit labels, not cards:** no borders, no shadows, no rounded containers. Each piece carries a museum plate — `№ 04 — Identity, 2025` — set in the letterspaced micro-label style, beneath massive imagery.
- **Hover:** image eases to `scale(1.03)` over 1.2s; the plate's title underlines with a 1px rule drawing left→right. Nothing bounces. Nothing glows.
- **Filtering** is typographic — a row of plain words (All / Identity / Campaign / Digital / Motion); the active word is ink, the rest stone. No pills, no buttons.

### 3.2 Client Intake & Digital Contract — the frictionless ceremony

- **One question group per screen.** Four movements: 01 Company → 02 Project → 03 Scope → 04 Agreement. A single hairline progress rule with four numbered ticks sits above; the current number is ink, completed are stone, future are mist.
- **Inputs as typography:** underline-only fields (1px mist, ink on focus), oversized 20px input text. Service selection is a set of typographic chips that fill ink when chosen — choosing services should feel like typesetting a menu.
- **The contract is the reveal, not a PDF attachment.** Step 04 renders a live document — the client's own answers already set into the agreement ("Prepared for **{Company}** · Scope: **{Services}** · Investment band: **{Budget}**") with a scrollable terms column. Seeing their words inside a formal document is the moment of commitment.
- **Signature:** the client types their full legal name; it renders at display scale as the signature line, with the acceptance checkbox and a single ink button — **"Accept & Sign."** Confirmation replaces the document with a quiet plate: reference number, hash-stamped date, "A countersigned copy is on its way."

### 3.3 Talent & Academy — a dashboard that stays a gallery

- **Shell:** left rail (desktop) with the three paths — Careers / Training / Courses — set as plain type with a moving 1px ink indicator; on mobile the rail becomes a top segmented rule. The content area stays paper/fog with hairline-divided rows, never boxed widgets.
- **Careers:** roles as a table-of-contents — role, discipline, location, type — one hairline per row. A row expands in place into the application form (no modal, no page jump): name, email, portfolio, CV, one note. Submitting collapses the row to a quiet "Received — we read everything." state.
- **Training:** programs as editorial spreads — cohort dates set large, curriculum as a numbered list (the Approach numbers reused), one Apply action.
- **Courses:** the catalogue borrows the Works grid. Each course plate: title, level, duration, investment. Booking is a two-beat flow — choose a session (dates as a typographic list with seat counts), confirm — ending in a booking reference plate.
- **State, not chrome:** progress and status are shown with type and hairlines (ink = active, stone = done, mist = upcoming). No badges, no color-coded chips — the monochrome system carries state through weight and tone.

### 3.4 Motion language (global)

- Reveal-on-scroll: 700ms ease `[0.16,1,0.3,1]`, 24px rise, staggered 60ms — once, never looping.
- Hovers: 1px underline draws; images breathe at 1.02–1.03; buttons invert ink/paper.
- `prefers-reduced-motion` collapses everything to opacity.

---

## 4. What `index.html` in this repo is

A **self-contained, production-grade single-page implementation** of the full expanded site (Hero, Philosophy, Selected Works, Intake + Digital Contract, Academy Dashboard, Formed by Clay) — zero external dependencies, fully responsive, light/dark themed, with all interactive flows (wizard, live contract binding, signing, applications, booking) functioning client-side. It is both the design source-of-truth and the markup/token reference for the Next.js port described above.
