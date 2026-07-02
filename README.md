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
- **BFF:** Next.js API routes proxying the agent backend
- **Agent backends:** Claude Agent SDK (`src/lib/agent/`), SynthUp HTTP, or mock — selected via `AGENT_BACKEND`
- **Skills:** `skills/` directory (Claude Code skill format, loaded per-session)
- **Storage:** Local `storage/artifacts/` (S3 in production)
- **DB:** JSON file store at `data/studio.db.json` (Postgres in production)

See [SYNTHUP_INTEGRATION.md](./SYNTHUP_INTEGRATION.md) for the (superseded) SynthUp API contract.

## Agent backend

`AGENT_BACKEND=claude` (recommended) runs each session on the
[Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk):

- **Spec phase** — the agent reads the selected skill's `SKILL.md`, asks
  clarifying questions, and returns a structured spec (JSON-schema enforced).
- **Generation phase** — on spec approval the same Claude session resumes,
  writes real artifact files into `storage/artifacts/<session>/`, and the
  adapter runs real verification: file check, brand-token scan (off-palette
  colors fail and feed the gap backlog), and a headless-Chrome screenshot.

Auth: the SDK uses your local Claude Code login; no `ANTHROPIC_API_KEY` needed
in dev. Optionally set `CLAUDE_AGENT_MODEL` to pin a model.

## Environment

| Variable | Purpose |
|---|---|
| `AGENT_BACKEND` | `claude` \| `synthup` \| `mock` |
| `CLAUDE_AGENT_MODEL` | Optional model override for the Claude backend |
| `SYNTHUP_MOCK=true` | Use mock adapter when `AGENT_BACKEND` is unset |
| `SYNTHUP_API_URL` | Real SynthUp endpoint (`AGENT_BACKEND=synthup`) |
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
