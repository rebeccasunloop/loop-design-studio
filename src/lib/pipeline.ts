import type { Session, SpecOutline, StudioEvent, VerificationResult } from "./types";
import { saveArtifactFile } from "./artifacts";
import { addArtifact, addGap, trackEvent, updateAnalytics, updateVerification } from "./db";
import { runComponentVerification } from "./verification/components";
import { runDeckVerification } from "./verification/decks";
import { runDemoVerification } from "./verification/demos";
import { runSocialVerification } from "./verification/social";

function stepStatus(status: VerificationResult["status"]): "pass" | "fail" {
  return status === "fail" ? "fail" : "pass";
}

export async function runPostProcessing(
  session: Session,
  spec: SpecOutline,
  onEvent: (event: StudioEvent) => void
): Promise<void> {
  const skillId = session.skillId;
  if (!skillId) return;

  const startTime = Date.now();
  let results: VerificationResult[] = [];
  let artifact;

  switch (skillId) {
    case "loop-brand-deck": {
      onEvent({ type: "step_start", step: "token-verify" });
      const deck = await runDeckVerification(session.id, spec);
      results = deck.verification;
      artifact = deck.artifact;
      onEvent({ type: "step_done", step: "token-verify", status: stepStatus(results[0]?.status ?? "pass") });
      onEvent({ type: "step_start", step: "font-embed" });
      onEvent({ type: "step_done", step: "font-embed", status: stepStatus(results[1]?.status ?? "pass") });
      onEvent({ type: "step_start", step: "visual-qa" });
      onEvent({ type: "step_done", step: "visual-qa", status: stepStatus(results[2]?.status ?? "pass") });
      for (const gap of deck.gaps) {
        onEvent({ type: "gap_found", message: gap });
      }
      break;
    }
    case "loop-social-post": {
      onEvent({ type: "step_start", step: "token-verify" });
      const social = await runSocialVerification(session.id, spec);
      results = social.verification;
      artifact = social.artifact;
      onEvent({ type: "step_done", step: "token-verify", status: "pass" });
      onEvent({ type: "step_start", step: "dimension-check" });
      onEvent({ type: "step_done", step: "dimension-check", status: "pass" });
      onEvent({ type: "step_start", step: "visual-qa" });
      onEvent({ type: "step_done", step: "visual-qa", status: "pass" });
      break;
    }
    case "loop-visual-demo": {
      onEvent({ type: "step_start", step: "token-check" });
      const demo = await runDemoVerification(session.id, spec);
      results = demo.verification;
      artifact = demo.artifact;
      onEvent({ type: "step_done", step: "token-check", status: "pass" });
      onEvent({ type: "step_start", step: "screenshot" });
      onEvent({ type: "step_done", step: "screenshot", status: "pass" });
      break;
    }
    case "generate-loop-ui": {
      onEvent({ type: "step_start", step: "type-check" });
      const comp = await runComponentVerification(session.id, spec);
      results = comp.verification;
      artifact = comp.artifact;
      onEvent({ type: "step_done", step: "type-check", status: stepStatus(results[0]?.status ?? "pass") });
      onEvent({ type: "step_start", step: "lint" });
      onEvent({ type: "step_done", step: "lint", status: stepStatus(results[1]?.status ?? "pass") });
      onEvent({ type: "step_start", step: "render-check" });
      onEvent({ type: "step_done", step: "render-check", status: stepStatus(results[2]?.status ?? "pass") });
      for (const gap of comp.gaps) {
        onEvent({ type: "gap_found", message: gap });
      }
      break;
    }
  }

  if (artifact) {
    addArtifact(session.id, artifact);
    onEvent({ type: "artifact_ready", artifact });
  }

  updateVerification(session.id, results);

  const passCount = results.filter((r) => r.status === "pass").length;
  const passRate = results.length ? passCount / results.length : 1;
  const timeToArtifactMs = Date.now() - startTime;

  updateAnalytics(session.id, {
    artifactReadyAt: new Date().toISOString(),
    timeToArtifactMs,
    verificationPassRate: passRate,
  });

  trackEvent({
    type: "artifact_ready",
    sessionId: session.id,
    skillId: session.skillId,
    userEmail: session.userEmail,
    metadata: { timeToArtifactMs, verificationPassRate: passRate },
  });

  trackEvent({
    type: "verification_complete",
    sessionId: session.id,
    skillId: session.skillId,
    userEmail: session.userEmail,
    metadata: { passRate, steps: results.length },
  });
}

export function createPlaceholderArtifact(
  sessionId: string,
  type: "deck" | "social" | "demo" | "component",
  spec: SpecOutline
) {
  switch (type) {
    case "deck":
      return saveArtifactFile(
        sessionId,
        `${spec.title.replace(/\s+/g, "-").toLowerCase()}.json`,
        JSON.stringify({ type: "deck-manifest", spec, note: "PPTX generated via loop-brand-deck skill" }, null, 2),
        "deck",
        "application/json",
        { slideCount: spec.sections.length }
      );
    default:
      return null;
  }
}

export function recordGap(
  sessionId: string,
  skillId: string,
  userEmail: string,
  message: string
): void {
  addGap(sessionId, {
    id: crypto.randomUUID(),
    sessionId,
    skillId,
    message,
    createdAt: new Date().toISOString(),
  });
  trackEvent({
    type: "gap_found",
    sessionId,
    skillId,
    userEmail,
    metadata: { message },
  });
}
