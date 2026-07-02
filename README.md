# Loop Design Studio

Internal AI chat interface for Loop employees. Routes prompts through SynthUp with company-customized skills to produce verified, on-brand artifacts.

## Workflows

| Skill | Output |
|---|---|
| **Frontend Components** | Type-checked Storybook stories (scratch folder) |
| **Slide Decks** | On-brand presentation decks |
| **Social Media Posts** | LinkedIn, Instagram, X images + captions |
| **Visual Demos** | Single-file HTML prototypes |

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Frontend:** Next.js 15, React, Tailwind (Loop tokens)
- **BFF:** Next.js API routes proxying SynthUp
- **Skills:** `skills/` directory, synced on deploy
- **Storage:** Local `storage/artifacts/` (S3 in production)
- **DB:** JSON file store at `data/studio.db.json` (Postgres in production)

See [SYNTHUP_INTEGRATION.md](./SYNTHUP_INTEGRATION.md) for SynthUp API contract.

## Environment

| Variable | Purpose |
|---|---|
| `SYNTHUP_MOCK=true` | Use mock adapter (default for dev) |
| `SYNTHUP_API_URL` | Real SynthUp endpoint |
| `STORYBOOK_URL` | For component render-check |
| `ANALYTICS_ENABLED` | Session metrics |

## Beta analytics

`GET /api/analytics` returns:
- Spec confirmation rate
- Average time-to-artifact
- Verification pass rate
- Gaps found (design-system backlog feed)

## Auth (production)

Configure Google Workspace SSO via `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Restrict to `@bankonloop.com` domain.

Dev mode uses `x-user-email` header (defaults to `dev@bankonloop.com`).
