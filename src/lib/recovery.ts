import { saveSession } from "./db";
import type { Session } from "./types";

// A generation normally completes in 1-5 minutes. If a session still claims
// to be generating long after it started, the run died (server restart,
// crashed process, killed stream) and nothing else will ever reset it.
const STALE_GENERATION_MS = 15 * 60 * 1000;

/**
 * Detect and repair sessions whose agent run died mid-flight. Resets the
 * phase to "error" and un-approves the spec so the user can review it and
 * approve again to retry.
 */
export function reconcileStaleSession(session: Session): Session {
  if (session.phase !== "generating") return session;
  const startedAt = session.analytics?.generationStartedAt;
  const age = startedAt ? Date.now() - new Date(startedAt).getTime() : Infinity;
  if (age < STALE_GENERATION_MS) return session;

  session.phase = "error";
  session.specApproved = false;
  return saveSession(session);
}
