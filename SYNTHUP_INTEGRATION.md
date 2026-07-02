# SynthUp Integration Contract

Internal reference for Loop Design Studio ↔ SynthUp API integration.

## Status

| Capability | SynthUp support | Studio handling |
|---|---|---|
| Session / thread API | Assumed: `POST /v1/sessions`, `POST /v1/sessions/:id/messages` | BFF proxies; falls back to mock adapter when `SYNTHUP_API_URL` unset |
| Streaming | Assumed: SSE `text/event-stream` on message endpoint | Normalized to `StudioEvent` schema in BFF |
| Skill injection | Assumed: `skills[]` array on session create (name + path) | Skills synced from `skills/` on deploy via `scripts/sync-skills.ts` |
| Repo / workspace binding | Assumed: `workspace` field on session (`next-app`, `loop-brand-skill`) | Per-skill `workspacePath` in registry |
| Tool / script execution | Partial — long-running scripts may timeout | BFF post-processing runs verify scripts locally |
| File upload + download | Assumed: `POST /v1/files`, signed download URLs | Local `storage/` with S3 adapter interface for prod |
| Auth | Service account key (`SYNTHUP_API_KEY`) + user email passthrough | Google SSO on Studio; user email forwarded as `X-Loop-User` |

## Endpoints (expected SynthUp surface)

Validate these with the SynthUp team before production deploy.

### Create session

```
POST /v1/sessions
Authorization: Bearer $SYNTHUP_API_KEY
Content-Type: application/json

{
  "skill": "loop-brand-deck",
  "workspace": "/workspaces/loop-brand-skill",
  "user_email": "rebecca@bankonloop.com",
  "metadata": { "studio_session_id": "..." }
}

→ 201 { "id": "synthup_sess_abc", "status": "active" }
```

### Send message (streaming)

```
POST /v1/sessions/:id/messages
Content-Type: application/json
Accept: text/event-stream

{ "content": "Make a deck for Acme Corp", "role": "user" }

→ SSE stream:
event: text_delta
data: {"content":"I'll help you"}

event: tool_call
data: {"name":"run_script","args":{"script":"build/build-deck.js"}}

event: done
data: {"status":"awaiting_spec_confirmation"}
```

### Approve spec / trigger generation

```
POST /v1/sessions/:id/approve
{ "spec": { "title": "...", "slides": [...] } }

→ SSE stream with step_start / step_done / artifact_ready events
```

### Upload artifact

```
POST /v1/sessions/:id/artifacts
Content-Type: multipart/form-data

→ { "id": "art_xyz", "url": "https://..." }
```

## BFF post-processing (when SynthUp cannot run scripts)

| Workflow | Post-processing in Studio BFF |
|---|---|
| Decks | `node skills/loop-brand-deck/build/verify.js`, font embed, thumbnail gen |
| Components | `tsc --noEmit`, lint, Storybook render-check against `STORYBOOK_URL` |
| Social | Playwright screenshot, token color assert |
| Demos | Playwright screenshot, token usage check |

## Auth model

- **Studio → SynthUp:** service account `SYNTHUP_API_KEY` (server-side only)
- **Browser → Studio:** Google OAuth (`@bankonloop.com` domain restriction)
- **User identity passthrough:** `user.email` sent to SynthUp for audit/rate limits

## Rate limits (configure with SynthUp team)

| Tier | Sessions/day | Messages/session |
|---|---|---|
| All employees | 20 | 50 |
| Engineers + design | 50 | 100 |

## Environment variables

```bash
SYNTHUP_API_URL=https://api.synthup.internal
SYNTHUP_API_KEY=sk_...
SYNTHUP_MOCK=true          # use mock adapter (dev default)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
DATABASE_URL=postgresql://...  # or sqlite for local
S3_BUCKET=loop-design-studio-artifacts
STORYBOOK_URL=http://localhost:6006
NEXT_APP_PATH=/path/to/next-app
```

## Workflow routing

| Skill | SynthUp workspace | BFF post-process |
|---|---|---|
| `generate-loop-ui` | `next-app` | tsc, lint, render-check |
| `loop-brand-deck` | `loop-brand-skill` | verify.js, embed-fonts, thumbnails |
| `loop-social-post` | `loop-brand-skill` | Playwright screenshot, token assert |
| `loop-visual-demo` | `loop-design-studio` | Playwright screenshot, token check |
