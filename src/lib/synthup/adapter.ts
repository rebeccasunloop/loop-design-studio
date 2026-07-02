import type { SpecOutline, StudioEvent, VerificationStep } from "../types";

export interface SynthUpSessionConfig {
  skillId: string;
  workspace: string;
  userEmail: string;
  studioSessionId: string;
}

export interface SynthUpAdapter {
  createSession(config: SynthUpSessionConfig): Promise<{ id: string }>;
  sendMessage(
    sessionId: string,
    content: string,
    onEvent: (event: StudioEvent) => void
  ): Promise<void>;
  approveSpec(
    sessionId: string,
    spec: SpecOutline,
    onEvent: (event: StudioEvent) => void
  ): Promise<void>;
}

export type AgentBackend = "claude" | "synthup" | "mock";

export function getAgentBackend(): AgentBackend {
  const configured = process.env.AGENT_BACKEND;
  if (configured === "claude" || configured === "synthup" || configured === "mock") {
    return configured;
  }
  if (process.env.SYNTHUP_MOCK !== "true" && process.env.SYNTHUP_API_URL) {
    return "synthup";
  }
  return "mock";
}

export async function createSynthUpAdapter(): Promise<SynthUpAdapter> {
  switch (getAgentBackend()) {
    case "claude": {
      const { ClaudeAgentAdapter } = await import("../agent/claude");
      return new ClaudeAgentAdapter();
    }
    case "synthup": {
      const { HttpSynthUpAdapter } = await import("./http");
      return new HttpSynthUpAdapter();
    }
    default: {
      const { MockSynthUpAdapter } = await import("./mock");
      return new MockSynthUpAdapter();
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function streamEvents(
  events: StudioEvent[],
  onEvent: (event: StudioEvent) => void,
  delayMs = 80
): Promise<void> {
  for (const event of events) {
    onEvent(event);
    if (event.type === "text_delta") await sleep(delayMs);
    else await sleep(delayMs * 2);
  }
}

export const VERIFICATION_STEPS: Record<string, VerificationStep[]> = {
  "generate-loop-ui": ["ground", "generate", "type-check", "lint", "render-check"],
  "loop-brand-deck": ["ground", "generate", "token-verify", "font-embed", "visual-qa"],
  "loop-social-post": ["ground", "generate", "token-verify", "dimension-check", "visual-qa"],
  "loop-visual-demo": ["ground", "generate", "token-check", "screenshot"],
};
