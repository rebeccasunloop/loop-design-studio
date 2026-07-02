import type { NextRequest } from "next/server";
import type { User } from "./types";

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "bankonloop.com,loop.ca")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

/**
 * Resolve the requesting user, in order of trust:
 * 1. `Cf-Access-Authenticated-User-Email` — set by Cloudflare Access after
 *    Google SSO when the app is served through an Access-protected tunnel.
 *    Access strips/overwrites this header on incoming requests, so it cannot
 *    be spoofed by visitors.
 * 2. `x-user-email` — local development convenience.
 * 3. Default dev identity.
 *
 * Returns null when the email's domain is not in ALLOWED_EMAIL_DOMAINS.
 */
export function resolveUser(req: NextRequest): User | null {
  const email = (
    req.headers.get("cf-access-authenticated-user-email") ??
    req.headers.get("x-user-email") ??
    "dev@bankonloop.com"
  ).toLowerCase();

  const domain = email.split("@")[1];
  if (!domain || !allowedDomains.includes(domain)) return null;

  const localPart = email.split("@")[0];
  const name = localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

  return {
    id: email,
    email,
    name: name || email,
    // Everyone gets full skill access during the beta; tighten when SSO roles exist.
    role: "engineer",
  };
}
