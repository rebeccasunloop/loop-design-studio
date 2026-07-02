import type { SpecOutline, StudioEvent } from "../types";
import type { SynthUpAdapter, SynthUpSessionConfig } from "./adapter";
import { sleep, streamEvents } from "./adapter";

// Module-level store survives across serverless invocations in dev
const mockSessions = new Map<string, { skillId: string; prompt: string }>();

const MOCK_SPECS: Record<string, (prompt: string) => SpecOutline> = {
  "loop-brand-deck": (prompt) => ({
    title: `Deck: ${extractClient(prompt)}`,
    summary: "5-slide customer presentation deck",
    sections: [
      { heading: "Cover", items: [`Prepared for ${extractClient(prompt)}`, "Loop branding, hero graphic"] },
      { heading: "Why Loop", items: ["FX savings at 12-47 bps", "Global accounts in 37 currencies", "3 feature cards"] },
      { heading: "Products", items: ["Corporate card", "Global accounts", "Bulk payments", "2x2 feature grid"] },
      { heading: "Proof", items: ["Stat callout with savings estimate (if provided)", "Dashboard hero graphic"] },
      { heading: "CTA", items: ["Let's scale together", "bankonloop.com/build"] },
    ],
  }),
  "loop-social-post": (prompt) => ({
    title: `Social: ${prompt.slice(0, 40)}`,
    summary: "LinkedIn + Instagram + X formats",
    sections: [
      { heading: "Visual", items: ["Loop logo top-left", "Headline in DM Sans SemiBold", "Brand green accent", "Hero graphic"] },
      { heading: "Caption", items: ["Lead with reader reality", "One concrete number if provided", "CTA to bankonloop.com"] },
      { heading: "Formats", items: ["LinkedIn 1200x627", "Instagram 1080x1080", "X 1600x900"] },
    ],
  }),
  "loop-visual-demo": (prompt) => ({
    title: `Demo: ${prompt.slice(0, 40)}`,
    summary: "Single-file HTML prototype with Loop tokens",
    sections: [
      { heading: "Screens", items: ["Landing state", "Primary flow step", "Confirmation state"] },
      { heading: "Interactions", items: ["Form inputs with validation", "Step navigation", "localStorage persistence"] },
      { heading: "Style", items: ["DM Sans", "Loop brand tokens via CSS variables", "Pill buttons, 24px card radius"] },
    ],
  }),
  "generate-loop-ui": (prompt) => ({
    title: `Component: ${prompt.slice(0, 40)}`,
    summary: "Storybook story with real Loop components",
    sections: [
      { heading: "Screen", items: ["Primary view with form fields", "Submit action", "Error/success states"] },
      { heading: "Components", items: ["Button", "Input", "Select", "AlertBanner"] },
      { heading: "Rules", items: ["Semantic tokens only", "i18n all copy", "Storybook story output"] },
    ],
    assumptions: ["No Card component exists — will use closest layout pattern", "Badge/Tag not available — will flag gap"],
  }),
};

function extractClient(prompt: string): string {
  const match = prompt.match(/for\s+([A-Za-z0-9\s]+)/i);
  return match?.[1]?.trim() ?? "Client";
}

export class MockSynthUpAdapter implements SynthUpAdapter {
  async createSession(config: SynthUpSessionConfig): Promise<{ id: string }> {
    const id = `mock_${config.studioSessionId}`;
    mockSessions.set(id, { skillId: config.skillId, prompt: "" });
    return { id };
  }

  async sendMessage(
    sessionId: string,
    content: string,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    let session = mockSessions.get(sessionId);
    if (!session) {
      // Recover from studio session id embedded in mock session id
      const studioId = sessionId.replace(/^mock_/, "");
      const { getSession } = await import("../db");
      const studioSession = getSession(studioId);
      if (studioSession?.skillId) {
        session = { skillId: studioSession.skillId, prompt: "" };
        mockSessions.set(sessionId, session);
      }
    }
    if (!session) throw new Error("Session not found");

    session.prompt = content;

    const specFn = MOCK_SPECS[session.skillId] ?? MOCK_SPECS["loop-visual-demo"];
    const spec = specFn(content);

    const clarifyEvents: StudioEvent[] = [
      { type: "text_delta", content: "I'll help you create " },
      { type: "text_delta", content: "something on-brand for Loop. " },
      { type: "text_delta", content: "Let me draft a spec for your review.\n\n" },
    ];

    await streamEvents(clarifyEvents, onEvent, 40);

    const questions = getClarifyQuestions(session.skillId);
    if (questions.length > 0) {
      await streamEvents(
        [{ type: "text_delta", content: questions.join("\n") }],
        onEvent,
        30
      );
    }

    await sleep(300);
    onEvent({ type: "spec_ready", spec });
    onEvent({ type: "phase_change", phase: "spec_pending" });
  }

  async approveSpec(
    sessionId: string,
    _spec: SpecOutline,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    onEvent({ type: "phase_change", phase: "generating" });
    onEvent({ type: "step_start", step: "ground" });
    await sleep(400);
    onEvent({ type: "step_done", step: "ground", status: "pass", detail: "Loaded brand tokens and assets" });

    onEvent({ type: "step_start", step: "generate" });
    await sleep(600);
    onEvent({ type: "step_done", step: "generate", status: "pass", detail: "Artifact generated" });
  }
}

function getClarifyQuestions(skillId: string): string[] {
  switch (skillId) {
    case "loop-brand-deck":
      return [
        "A few quick questions:",
        "1. What's the goal of this deck? (land / upsell / onboard)",
        "2. Which Loop value props matter most? (FX, global accounts, card, bulk payments)",
        "3. Any hard numbers to feature?",
      ];
    case "loop-social-post":
      return ["Which platform is primary? (LinkedIn / Instagram / X)"];
    case "generate-loop-ui":
      return ["Which screen states do you need? (default / error / loading)"];
    default:
      return [];
  }
}
