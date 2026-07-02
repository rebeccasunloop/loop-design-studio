# Loop Design Studio — Beta Runbook

How to run the teammate beta from a single Mac, behind Google SSO, with no
deployed infrastructure. (Real deployment is Phase 2 — see README.)

## One-time setup (host machine)

1. **API key.** Put a company Anthropic API key in `.env` as
   `ANTHROPIC_API_KEY=` (Console → API keys; set a monthly budget cap).
   Without it, every teammate session bills the host's personal Claude seat
   and shares its rate limits.

2. **Cloudflare Tunnel + Access** (`cloudflared` is installed at
   `~/.local/bin/cloudflared`):

   ```bash
   cloudflared tunnel login                 # opens browser; pick the zone (e.g. bankonloop.com)
   cloudflared tunnel create design-studio
   cloudflared tunnel route dns design-studio studio.<your-zone>
   ```

   Then in the Cloudflare dashboard → Zero Trust → Access → Applications:
   - Add an application for `studio.<your-zone>`
   - Login method: Google
   - Policy: allow emails ending in `@bankonloop.com`

   Access authenticates every visitor and forwards their identity as the
   `Cf-Access-Authenticated-User-Email` header, which the app maps to the
   session owner (see `src/lib/identity.ts`). No in-app auth code needed.

3. **Quick smoke-test alternative (no SSO — do not share widely):**
   `cloudflared tunnel --url http://localhost:3000` gives a throwaway
   `trycloudflare.com` URL with zero auth. Fine for a 10-minute demo to one
   person; not for the beta proper.

## Running the beta

```bash
npm run dev                                        # terminal 1
cloudflared tunnel run --url http://localhost:3000 design-studio   # terminal 2
```

Keep the Mac awake (`caffeinate -dims` or Amphetamine). Generation runs take
1–4 minutes; the SSE streams survive the tunnel fine.

## Known beta limitations

- Single host: if the Mac sleeps or the dev server stops, the beta is down.
- JSON-file DB: fine for ~5 concurrent users, not more.
- `generate-loop-ui` needs the `next-app` repo on the host (`NEXT_APP_PATH`).

---

# Tester guide (share this)

**What it is:** an internal AI studio that turns a chat request into a
verified, on-brand artifact — slide decks, social posts, clickable HTML
prototypes, and (for engineers) real Loop UI components.

**How to use it:**
1. Open the URL, sign in with your Loop Google account.
2. Pick a workflow and describe something you *actually need this week* —
   e.g. "make a deck for <client>" or "prototype the new settings flow".
3. Answer its clarifying questions, review the spec card, hit approve.
4. Wait 1–4 minutes; download the artifact and check the verification panel.

**What we're testing:** whether the spec matched what you meant, whether the
artifact is genuinely usable (would you send/show it?), and where it flags
brand/design gaps.

**Feedback:** reply in the Slack thread with (a) the artifact, (b) verdict —
use as-is / usable with edits / not usable, and (c) anything that surprised
you. Everything else (timings, verification results, gap findings) is
collected automatically.

---

# Slack invite draft

> :art: **Design Studio beta — looking for 5 testers.** I've been building an
> internal AI tool that turns a chat request into on-brand collateral: client
> decks, social posts, and clickable product prototypes — every color checked
> against our design tokens before you see it. I need people to throw *real*
> tasks at it this week (something you actually need, not a toy). Takes ~10
> minutes: describe what you want, confirm the spec it proposes, download the
> result. Link: `https://studio.<zone>` (sign in with your Loop Google
> account). Drop your artifact + verdict in this thread. :seedling:
