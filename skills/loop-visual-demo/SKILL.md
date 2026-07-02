---
name: loop-visual-demo
description: >
  Build clickable HTML prototypes for flow walkthroughs and rough ideas using Loop
  design tokens. Use when someone needs a visual demo or prototype without
  production React code — onboarding flows, settings walkthroughs, concept demos.
  Triggers: "prototype", "demo", "walkthrough", "clickable mockup", "HTML demo".
---

# Loop Visual Demo Agent

Generate single-file HTML/CSS/JS prototypes grounded in Loop design tokens.

## The loop

1. **Spec** — which screens/states, interactions, copy. Confirm before building.
2. **Ground** — use CSS custom properties from Loop tokens (`--brand-500`, etc.). DM Sans via Google Fonts.
3. **Generate** — self-contained `index.html`, no build step.
4. **Verify** — headless screenshot, token usage check, no invented brand colors.

## Style rules

- Pill buttons (`border-radius: 999px`)
- Cards: 24px radius, soft shadow
- Semantic tokens only — never raw hex except in `:root` definitions
- Banner: "Prototype only — not production code"

## Patterns (from onboarding prototype)

- View switching via `.hidden` class or `showScreen(n)`
- `localStorage` for state persistence
- Sidebar nav for multi-step flows
- Modal/drawer for secondary actions

## Output

- `index.html` (self-contained)
- Screenshot of key state
- List of screens included

## When NOT to use

If the output needs real React components, use `generate-loop-ui` instead.
