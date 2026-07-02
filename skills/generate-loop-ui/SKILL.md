---
name: generate-loop-ui
description: >
  Use when generating a UI screen or component for next-app from a spec, a rough
  idea, or a design — a new onboarding step, form, sign-in/sign-up flow, review
  screen, or page-level UI. Works even with no written spec: it gathers context,
  drafts a spec, confirms it, then generates code that uses Loop's REAL
  components, passes type-check, and actually renders — not plausible-but-fake markup.
---

# Generating Loop UI (real components, verified)

An LLM left alone produces plausible layout code with invented components and
wrong props. Two things prevent that: **ground every component in the real source,
and verify by running the checks — never assume.**

## Step 0 — establish the spec before building

If the user gave a complete spec, use it. If they gave only a rough idea (e.g.
"a sign-up flow", "a settings page"), DO NOT start generating from assumptions:

1. Decide whether you have enough to build the right thing. A spec needs: which
   screen(s)/states, the fields and controls, the exact user-facing copy, the
   primary action, and any branching/conditional logic.
2. If anything essential is missing, ASK first — a few targeted questions, not a
   long form. Prefer concrete options over open questions.
3. Draft a short spec from their answers and **show it for confirmation** before
   generating. Do not invent fields, copy, industries, or states the user did not
   give — surface those as questions or flagged assumptions, never as silent fact.
4. Only generate once the spec is confirmed.

## Rule 0 — only real components, flag gaps

Use only components that already exist in this repo. Never invent a component, an
import path, or a prop. If the screen needs something that does not exist, build
the closest real thing and **state the gap explicitly** in your summary. Do not
silently fake it. (Real gaps seen so far: no generic "Card"/section container; no
status "Badge"/"Tag"; `AlertBanner` supports only `variant: 'success' | 'error'`,
no `warning`. Auth screens may need components that don't exist yet — check before
assuming, and flag what's missing.)

## Step 1 — find the real component (use the map first)

Use these verified imports as the FIRST resort — do not search if the component is
listed here:

| Component | Import |
|---|---|
| Button | `@/components/base/buttons/button` |
| Select | `@/components/base/select/select` |
| AlertBanner | `@/components/ui/alert-banner` |
| Checkbox | `@/components/base/checkbox/checkbox` |
| Input | `@/components/base/input/input` |

Only if a component is NOT in the table, search `src/components/**` for the real
file and import from its actual path. Do not guess an import.

## Step 2 — read the real source before using it

For each component you use, **open its files** — do not rely on memory or on the
Storybook manifest (its docgen is unreliable for showcase components):

- **Props:** read the `Props` interface in the component's `.tsx`.
- **Usage:** read the component's own `*.stories.tsx` for the correct pattern.

This is mandatory for compound / React-Aria components, which fail at **runtime**
even when they type-check. For `Select`, **read `src/components/base/select/select.stories.tsx`**
and copy its pattern exactly: an `items` array of `{ id, label }`, children as a
**render function** returning `Select.Item` with an `id`, and `defaultSelectedKey`
rather than a controlled `value`/`onChange`. (A controlled `onChange` fights the
`Key | null` signature; non-render-function children break the collection at
runtime with `Cannot read properties of undefined (reading 'id')`.)

## Step 3 — follow the repo rules (these block CI)

- Semantic tokens ONLY (`text-primary`, `bg-brand-solid`, `border-secondary`).
  NEVER raw color scales (`text-gray-900`, `bg-green-700`) and NEVER doubled token
  prefixes (`bg-bg-primary`, `text-text-primary`). Verify token names against
  `src/styles/variables.css` if unsure.
- Shared `Button` for every button. Pages Router + CSR only. Classic Apollo hooks.
- No barrel files. No new code comments. i18n all user-facing text.
- No type-laundering casts (`as string`, `as any`). Do not copy pre-existing
  violations you see elsewhere in the repo.
- Component coverage = Storybook stories. `*.test.tsx` render tests are banned.

## Step 4 — verify by running the checks (do not trust a green check)

Run these and fix what they report — repeat until they pass:

1. **Type-check the generated file** (not the whole repo, which is slow):
   `npx tsc --noEmit <path-to-the-story-file>` — or rely on CI for the full-repo
   pass. Catches wrong imports, wrong props, type mismatches against real components.
2. **Lint/format the generated file:** `yarn lint <path>` and `yarn prettier <path>`.
3. **Render-check:** the story must *render*, not just compile. With Storybook
   running (`yarn storybook`), open the story's `iframe.html?id=...` and confirm it
   does NOT show "The component failed to render properly." Type-check validates the
   contract; only rendering catches runtime failures (e.g. a component needing a
   provider/collection it wasn't given).

Notes on verification cost:
- The full automated a11y/axe pass (story tests) needs a Playwright browser build.
  Pre-install it once with `npx playwright install chromium` to avoid mid-run
  stalls. If it is unavailable, do NOT block — verify rendering directly and note
  in your summary that a reviewer/CI should run the axe pass.
- A check reporting *failure* is also not proof — confirm against the actual
  rendered page before trusting the detector.

## Output

Write the screen as a Storybook story (`*.stories.tsx`) under the feature folder
(or a clearly-named scratch folder for experiments), with a `meta` title and named
story exports for the screen's states (default + branching states). In your
summary, list: the real components used (and that you read their source), the
verification results, and any components you had to approximate and why — those
gaps are design-system findings worth surfacing.
