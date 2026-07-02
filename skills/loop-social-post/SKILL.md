---
name: loop-social-post
description: >
  Create on-brand Loop social media images and captions for LinkedIn, Instagram,
  and X/Twitter. Use when someone at Loop needs a social post for product launches,
  hiring, announcements, or events. Grounds in real brand tokens and assets.
  Triggers: "LinkedIn post", "social media", "Instagram graphic", "hiring post",
  "announce on X", "product launch post".
license: Internal — Loop brand assets are proprietary.
---

# Loop Social Post Agent

Generate on-brand social media collateral grounded in the real Loop brand system.

## The loop (always run all four steps)

1. **Spec from rough idea** — ask platform (LinkedIn / Instagram / X), topic, and any numbers to feature. Draft outline, confirm, then build.
2. **Ground** — load `../loop-brand-deck/build/brand.js` tokens and `../loop-brand-deck/assets/`. Never hardcode hex.
3. **Generate** — build HTML/CSS at exact platform dimensions, screenshot with Playwright.
4. **Verify** — assert colors/fonts match tokens; check character limits; visual QA.

## Platform dimensions

| Platform | Size | Caption limit |
|---|---|---|
| LinkedIn | 1200 × 627 | 3000 chars (aim for < 1500) |
| Instagram | 1080 × 1080 | 2200 chars |
| X / Twitter | 1600 × 900 | 280 chars |

## Templates

- **Announcement** — dark hero bg, logo top-left, headline, CTA pill
- **Hiring** — light bg, role title, team value prop, link to careers
- **Product launch** — feature graphic right, headline left, stat if provided
- **Event** — date/time prominent, DM Mono for figures

## Voice

Follow `../loop-brand-deck/VOICE.md`. Lead with reader reality. No hype words. No invented stats.

## Output

- PNG per platform
- Caption text (separate from image)
- Verification report (token check + dimension check)

## Gaps to flag

If a requested graphic is not in assets/, flag it and use closest real asset.
