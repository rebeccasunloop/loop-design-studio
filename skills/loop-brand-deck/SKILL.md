---
name: loop-brand-deck
description: >
  Generate on-brand Loop sales/marketing collateral — customer presentation decks,
  one-pagers, and (phase 2) social posts — as editable .pptx grounded in the real
  Loop Design System. Use whenever someone at Loop (sales, growth, recruiting, CX)
  needs a client-facing deck or one-pager that must look like Loop's hand-designed
  Figma collateral, not a generic AI slide. Triggers: "make a deck for [client]",
  "one-pager for [client]", "pitch slides", "customer presentation", "Loop deck".
license: Internal — Loop brand assets are proprietary.
---

# Loop Brand Agent — Decks & One-Pagers

Generate client-facing collateral that is **provably on-brand**: every color traces
to a Loop design token, every font is a DM family, every asset is a real exported
Loop graphic. The agent grounds in the real brand system, generates a .pptx,
verifies it against the tokens, and flags anything it had to approximate — it never
invents an off-brand substitute.

This is the document/deck counterpart to the UI-generation agent. Same thesis:
**ground in the real system, flag gaps, verify against reality, distill into a
portable artifact.**

---

## The loop (always run all four steps)

1. **Spec from rough idea** — the requester says "I need a deck for Acme." Ask only
   the few questions you need (below), draft a slide outline, confirm, then build.
2. **Ground** — load `build/brand.js` (the token source of truth) and the real
   assets in `assets/`. Never hardcode hex or invent a layout; consume tokens.
3. **Generate** — build the `.pptx` with `pptxgenjs` using the layout patterns
   below. Render to images and run **visual QA with a subagent** (fresh eyes).
4. **Verify** — run `node build/verify.js <file>`. It fails if any color or font is
   off-brand. Embed fonts (`build/embed-fonts.py`) so the deck is portable. Flag any
   gap (a missing asset, an undefined layout) to the requester rather than faking it.

---

## Step 1 — Spec questions (ask at most these, then confirm an outline)

- **Client name?** (drives the "Prepared for [Client]" pill and the title.)
- **What's the goal of this deck?** (land a new account / upsell / onboard / recruit.)
- **Which Loop value props matter most for this client?** (FX savings, global
  accounts, corporate card, bulk payments, all-in-one platform.) Pick 2–4; don't
  cram everything in.
- **Any hard numbers to feature?** (their FX volume, a savings estimate, a rate.)
  If they give a savings number, use the stat-callout slide; if not, omit it —
  **never invent a figure.**
- **Length?** Default 5 slides (cover / why-Loop / products / proof / CTA).

Then draft a one-line-per-slide outline, confirm, and build. Don't over-ask: if the
requester gave a detailed brief, skip straight to the outline.

---

## Step 2 — Grounding: the brand system (from DESIGN.md, ALPHA)

Consume `build/brand.js`. Do not retype these values into slides — import them.

**Color.** One brand voltage on neutral chrome. Loop Green ramp, anchor
`brand-500 #045B3F`. Deep surfaces: `brand-700 #003926`, `brand-800 #00291A`,
`brand-900 #001D11`. The lime **`brightGreen #D2F3A7` is decorative/accent only**
(the swoosh, a headline pop, a CTA pill) — never body text, never a status meaning.
Neutrals are Tailwind neutral. Text: `#171717` primary, `#404040` secondary. On
dark green, body text uses `brand-100 #BBE5D0` (calm muted), headings white.

**Type.** Single-family system: **DM Sans** for everything (display = SemiBold/600
with negative tracking ≥36px; body = Regular/400; labels/emphasis = Medium/500),
**DM Mono** for figures/amounts/account numbers. The display/body distinction is
weight + tracking, not a second family. Money always renders in DM Mono.

**Geometry.** The signature is the large radius + soft depth. Cards/modals 24px,
large feature cards 26px, hero blocks 28px, controls 20px, **buttons are full
pills.** Never bolt a sharp corner onto a rounded group. Depth is soft, diffuse
shadow + light hairlines — never hard 1px rules, never edge accent stripes.

**Voice.** See the Voice section below — and heed the em-dash / AI-tone warning.

### The collateral layer (defined here — not in the product DESIGN.md)

The product design system covers UI (buttons, inputs, tables). Loop's *collateral*
extends it with these patterns, which this skill defines and keeps consistent:

- **Dark hero background** — deep forest-green gradient (`deck-bg-dark.png`,
  generated from `brand-600 → brand-900`). Used on cover, proof, and CTA slides.
- **"Prepared for [Client]" pill** — `brand-700` fill, `brand-400` hairline, white
  client name. Top-right of the cover.
- **Section label** — small-caps, DM Sans Medium, tracked +1.6pt, in accent green
  on dark (or `brand-500` on light). E.g. "WHY LOOP", "OUR CORE PRODUCTS".
- **White feature card** — 24px radius, soft shadow, optional Loop app-icon, bold
  title, secondary-color body. Used in 3-up and 2×2 grids.
- **Stat callout** — oversized DM Mono number in accent green on dark, label below.
- **CTA pill** — accent-green pill with `bankonloop.com/build`, on a dark close slide.
- **Sandwich structure** — dark cover + dark close, light content slides between.

---

## Step 3 — Generate (layout patterns)

Use `LAYOUT_WIDE` (13.3×7.5). `build/build-deck.js` is the reference implementation;
copy it and swap content. Patterns, one per slide archetype:

- **Cover** — dark bg, white logo top-left, Prepared-for pill, two-weight display
  headline, lead subhead, hero graphic (`card-swoosh.png` / `visa-card-green.png`)
  bleeding off the right. (The real Bayshore cover uses the pill-mesh background
  `bgPillMesh` with a black Prepared-for pill and a year label top-left — both valid.)
- **Table of contents** — split layout: LEFT half is a dark/pill-mesh panel with the
  big "Table of Contents" display heading; RIGHT half is white with grouped sections
  (Product / Integration / Pricing), each a list of entries with right-aligned page
  numbers in DM Mono. Top-left "LOOP FINANCIAL" pill, thin hairline under it.
- **Why-Loop** — dark bg, section label, display heading, 3 white feature cards.
- **Products / feature grid** — LIGHT bg, 2×2 white card grid + hero card image right.
- **Feature-table slide** (the Bayshore "Product" pages) — LIGHT bg, "LOOP FINANCIAL"
  pill top-left, big section title ("Product" / "Integration"), a subsection label
  ("Core Platform"), then a two-column **Feature | Notes** table: light-gray column
  headers, hairline row dividers (border-secondary), Feature in `text-primary`, Notes
  in `text-secondary`. This is the workhorse layout for capability/spec decks.
- **Multi-column feature list** — under a table, a 3-column grid of short
  feature/value rows separated by hairlines (the Expense-Management "Other Features").
- **Pricing-cards** — LIGHT bg, 2 large bordered cards (rectRadius 26px, brand-green
  hairline), each: numbered circle badge, plan name, big DM Mono price + "/mo",
  an accent-light-green pill for the one-time line, hairline, then a checkmark
  rewards/inclusions list. Mirror the two cards exactly for visual balance.
- **Stat / savings** — dark bg, big DM Mono number in accent green, supporting card.
- **CTA close** — dark OR light. The real Bayshore close is LIGHT: two-weight display
  headline ("Let's Scale together."), short supporting line, dashboard hero image
  (`dashboard-accounts.svg`) on the right. Also valid: dark close with accent CTA pill.

**Background treatments (3, all real):** `bgDark` (hero line-tracery, for cover /
stat / dark closes), `bgPillMesh` (rounded-pill mesh, for cover / TOC left panel),
and white/`n50` (for content, tables, pricing). Sandwich: dark or pill-mesh cover +
content in white + cover-weight close. Never invent a 4th background.

**Hard rules (from the pptx skill + brand):** no accent stripes / color bars / lines
under titles (AI tells); never center body text; titles ≥36pt, body 14–16pt; 0.7"
margins; vary layouts; every slide has a visual element; pptxgenjs hex has **no `#`**;
never share a shadow object across shapes (use the `shadowCard()`/`shadowSoft()`
factories in brand.js).

**Build + recompress:**
```bash
cd build && node build-deck.js
python3 /mnt/skills/public/pptx/scripts/rezip.py ../output/<file>.pptx
```

**Visual QA (required, use a subagent):** render and inspect.
```bash
cd output && python3 /mnt/skills/public/pptx/scripts/office/soffice.py --headless --convert-to pdf <file>.pptx
rm -f slide-*.jpg && pdftoppm -jpeg -r 110 <file>.pdf slide
```
Fix real defects (overflow, overlap, collisions) once, re-verify, stop. **DM Sans is
not on LibreOffice's metric-safe list, but we install the real fonts in QA (`~/.fonts`)
so the preview is trustworthy** — still, leave ~10% slack on display headlines, since
wrapping is the most common defect (it bit the first build on slides 1 and 5).

---

## Step 4 — Verify + embed (the on-brand "type-checker")

```bash
node build/verify.js output/<file>.pptx     # FAILS if any color/font is off-brand
python3 build/embed-fonts.py output/<raw>.pptx output/<final>.pptx   # embed DM fonts
```
`verify.js` unzips the .pptx and asserts every `srgbClr` is a brand token and every
`typeface` is a DM family. This is what separates "looks green" from "is on-brand."
Always run it on the **final** file. `embed-fonts.py` injects the DM fonts into the
OOXML so the deck renders correctly on any machine (reps can edit text; design holds).

**Keynote caveat:** Keynote ignores PPTX-embedded fonts and substitutes. Reps who
open decks in Keynote must install DM Sans + DM Mono on their Mac **once** — see
`FONT-SETUP.md` (60-second install; fonts staged in `fonts-for-install/`). After
that, Keynote renders DM Sans natively. Embedding still helps PowerPoint users.

**If verify fails:** find the offending hex/font, trace it to a token (or remove it).
Do not whitelist your way around it — a violation means a layout introduced an
un-grounded value.

---

## Gaps to flag, never fake

If a requested element has no real asset, say so and offer the closest real one —
don't invent it. Known current gaps in `assets/`:

- **FX-comparison table** (Loop vs Wise/OFX/banks) — appears in the one-pagers but
  is not yet an exported asset. Flag it; offer a native pptx table styled in tokens
  instead, or request the export.
- **Account-details dashboard (CAD/USD)** — NOW AVAILABLE as
  `graphics/dashboard-accounts.svg` (a rasterized dashboard showing the growth chart,
  CAD + USD account-detail cards with routing/transit numbers, and a card preview).
  Good hero for a "Global Accounts" or "one source of truth" slide.
- **Invoices / Bulk-Payments UI screenshots** — the panels in the Taiga one-pager
  are not in `assets/` yet. Flag and request if a slide needs them.
- **Standalone account-detail cards (GBP/EUR alone)** — only CAD/USD appear in the
  dashboard graphic; GBP/EUR exist as floating chips inside `visa-card-green.png`.
  Request standalone exports if a slide needs them isolated.

Surfacing these *is* useful output — it tells the brand team what the collateral
asset library still needs.

---

## Asset inventory (`assets/`)

- `logos/` — `loop-logo-white.png` (for dark bg), `loop-logo-black.png` (light bg).
  Trimmed to true bbox, aspect ~2.84; keep aspect when sizing.
- `backgrounds/` — `hero-real.png` (the REAL Loop hero: deep-green with faint curved
  line-tracery, top-left light falloff — use as the primary dark background),
  `gradient-vertical-pills.png` (the rounded-pill mesh, for covers / TOC panels),
  plus other source gradients and the animated `hero-source.svg`. (`deck-bg-dark.png`
  is a synthesized fallback — prefer `hero-real.png`.)
- `graphics/` — `card-swoosh.png` (upward-arrow growth hero), `visa-card-green.png`
  (green Visa + currency chips), `dashboard-accounts.svg` (CAD/USD account-details
  dashboard), `physical-card.svg`, `retractable-banner.png`.
- `icons/` — `contacts.png`, `info.png`, `documents.png` (soft-green app icons).
- `fonts/` — DM Sans (Regular/Medium/SemiBold/Bold/MediumItalic) + DM Mono
  (Regular/Medium), named as distinct families so PowerPoint resolves weights.
