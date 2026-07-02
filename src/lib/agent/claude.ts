import fs from "fs";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  ArtifactRef,
  SpecOutline,
  StudioEvent,
  VerificationResult,
} from "../types";
import type { SynthUpAdapter, SynthUpSessionConfig } from "../synthup/adapter";
import {
  addArtifact,
  getSession,
  saveSession,
  trackEvent,
  updateAnalytics,
  updateVerification,
} from "../db";
import { getSkill } from "../skills";
import { recordGap } from "../pipeline";
import { runScreenshot, runTokenCheck } from "./verification";

const SESSION_PREFIX = "claude_";

const SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "sections"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "items"],
        properties: {
          heading: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
  },
};

const CLARIFY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "spec"],
  properties: {
    reply: {
      type: "string",
      description:
        "Message shown to the user in the chat: clarifying questions, or a short intro to the drafted spec.",
    },
    spec: {
      description: "The drafted spec, or null if you still need answers before drafting one.",
      anyOf: [{ type: "null" }, SPEC_SCHEMA],
    },
  },
};

const GENERATION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "files", "gaps"],
  properties: {
    summary: { type: "string", description: "One-paragraph summary of what was generated." },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["filename", "description"],
        properties: {
          filename: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "Design-system or asset gaps encountered (things you had to approximate or flag).",
    },
  },
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function artifactsDir(): string {
  return process.env.ARTIFACTS_PATH ?? path.join(process.cwd(), "storage", "artifacts");
}

function studioSessionFor(adapterSessionId: string) {
  const studioId = adapterSessionId.replace(SESSION_PREFIX, "");
  const session = getSession(studioId);
  if (!session) throw new Error(`Studio session not found for ${adapterSessionId}`);
  return session;
}

function loadSkillMarkdown(skillId: string): string {
  const skillPath = path.join(process.cwd(), "skills", skillId, "SKILL.md");
  if (!fs.existsSync(skillPath)) return "";
  return fs.readFileSync(skillPath, "utf-8");
}

interface QueryRunResult {
  structuredOutput: unknown;
  claudeSessionId: string | null;
}

async function runQuery(params: {
  prompt: string;
  systemPrompt?: string;
  resume?: string;
  allowedTools: string[];
  outputFormat: Record<string, unknown>;
  maxTurns: number;
  additionalDirectories?: string[];
}): Promise<QueryRunResult> {
  let claudeSessionId: string | null = null;
  let structuredOutput: unknown = undefined;

  const q = query({
    prompt: params.prompt,
    options: {
      cwd: process.cwd(),
      model: process.env.CLAUDE_AGENT_MODEL || undefined,
      systemPrompt: params.systemPrompt,
      resume: params.resume,
      allowedTools: params.allowedTools,
      additionalDirectories: params.additionalDirectories,
      // Headless server context — there is no interactive user to approve tool calls.
      permissionMode: "bypassPermissions",
      maxTurns: params.maxTurns,
      outputFormat: { type: "json_schema", schema: params.outputFormat },
    },
  });

  for await (const message of q) {
    if ("session_id" in message && typeof message.session_id === "string") {
      claudeSessionId = message.session_id;
    }
    if (message.type === "result") {
      if (message.subtype !== "success") {
        const detail = "result" in message ? (message as { result?: string }).result : undefined;
        throw new Error(`Agent run failed (${message.subtype})${detail ? `: ${detail}` : ""}`);
      }
      structuredOutput = message.structured_output;
    }
  }

  return { structuredOutput, claudeSessionId };
}

export class ClaudeAgentAdapter implements SynthUpAdapter {
  async createSession(config: SynthUpSessionConfig): Promise<{ id: string }> {
    return { id: `${SESSION_PREFIX}${config.studioSessionId}` };
  }

  async sendMessage(
    sessionId: string,
    content: string,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    const session = studioSessionFor(sessionId);
    if (!session.skillId) throw new Error("Session has no skill selected");
    const skill = getSkill(session.skillId);
    const skillMarkdown = loadSkillMarkdown(session.skillId);

    const systemPrompt = [
      `You are the ${skill?.name ?? session.skillId} agent inside Loop Design Studio, an internal tool for Loop (bankonloop.com, Canadian business banking).`,
      `You are in the SPEC phase: your only job right now is to turn the user's request into a confirmed spec. Do NOT generate the artifact yet.`,
      `Rules:`,
      `- If essential information is missing, ask a few targeted questions (prefer concrete options) and return spec: null.`,
      `- Ask at most one round of questions; if the user has answered or the request is clear enough, draft the spec.`,
      `- Never invent facts, numbers, or client details the user did not give — surface them as assumptions instead.`,
      `- Keep the reply short and conversational; the spec itself is rendered separately as a card.`,
      skillMarkdown ? `\n--- SKILL INSTRUCTIONS ---\n${skillMarkdown}` : "",
    ].join("\n");

    const { structuredOutput, claudeSessionId } = await runQuery({
      prompt: content,
      systemPrompt,
      resume: session.claudeSessionId ?? undefined,
      allowedTools: ["Read", "Glob", "Grep"],
      outputFormat: CLARIFY_OUTPUT_SCHEMA,
      maxTurns: 15,
    });

    if (claudeSessionId) {
      const current = getSession(session.id);
      if (current) {
        current.claudeSessionId = claudeSessionId;
        saveSession(current);
      }
    }

    const output = structuredOutput as { reply?: string; spec?: SpecOutline | null } | undefined;
    if (!output?.reply) throw new Error("Agent returned no reply");

    onEvent({ type: "text_delta", content: output.reply });
    if (output.spec) {
      onEvent({ type: "spec_ready", spec: output.spec });
      onEvent({ type: "phase_change", phase: "spec_pending" });
    }
  }

  async approveSpec(
    sessionId: string,
    spec: SpecOutline,
    onEvent: (event: StudioEvent) => void
  ): Promise<void> {
    const session = studioSessionFor(sessionId);
    if (!session.skillId) throw new Error("Session has no skill selected");
    const skill = getSkill(session.skillId);
    const startTime = Date.now();

    onEvent({ type: "phase_change", phase: "generating" });
    onEvent({ type: "step_start", step: "ground" });

    const sessionDir = path.join(artifactsDir(), session.id);
    fs.mkdirSync(sessionDir, { recursive: true });
    const existingFiles = new Set(fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir) : []);

    onEvent({
      type: "step_done",
      step: "ground",
      status: "pass",
      detail: `Loaded ${skill?.name ?? session.skillId} skill and Loop brand context`,
    });
    onEvent({ type: "step_start", step: "generate" });

    const prompt = [
      `The user approved this spec. Generate the artifact now, following the skill instructions.`,
      ``,
      `Approved spec:`,
      "```json",
      JSON.stringify(spec, null, 2),
      "```",
      ``,
      `Write every output file into this directory (create it if needed): ${sessionDir}`,
      `Constraints:`,
      `- Self-contained outputs only (inline CSS/JS; Google Fonts links for DM Sans/DM Mono are fine).`,
      `- Use only Loop brand colors (see skills/loop-brand-deck/build/brand.js) and greyscale.`,
      `- If the skill's preferred tooling is unavailable in this environment, produce the closest faithful equivalent (e.g. an HTML deck instead of .pptx) and record it in gaps.`,
      `- Do not modify any files outside ${sessionDir}.`,
    ].join("\n");

    const additionalDirectories: string[] = [];
    if (session.skillId === "generate-loop-ui" && process.env.NEXT_APP_PATH) {
      additionalDirectories.push(process.env.NEXT_APP_PATH);
    }

    let generationError: string | null = null;
    let output: { summary?: string; files?: { filename: string; description: string }[]; gaps?: string[] } | undefined;
    try {
      const run = await runQuery({
        prompt,
        resume: session.claudeSessionId ?? undefined,
        allowedTools: ["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
        outputFormat: GENERATION_OUTPUT_SCHEMA,
        maxTurns: 60,
        additionalDirectories: additionalDirectories.length ? additionalDirectories : undefined,
      });
      output = run.structuredOutput as typeof output;
      if (run.claudeSessionId) {
        const current = getSession(session.id);
        if (current) {
          current.claudeSessionId = run.claudeSessionId;
          saveSession(current);
        }
      }
    } catch (err) {
      generationError = err instanceof Error ? err.message : String(err);
    }

    const producedFiles = fs.existsSync(sessionDir)
      ? fs.readdirSync(sessionDir).filter((f) => !existingFiles.has(f) && !f.startsWith("."))
      : [];
    const producedPaths = producedFiles.map((f) => path.join(sessionDir, f));

    const results: VerificationResult[] = [];
    const generateResult: VerificationResult = {
      step: "generate",
      status: generationError || producedFiles.length === 0 ? "fail" : "pass",
      detail: generationError
        ? generationError
        : producedFiles.length === 0
          ? "Agent completed but produced no artifact files"
          : `${producedFiles.length} file(s): ${producedFiles.join(", ")}`,
    };
    results.push(generateResult);
    onEvent({ type: "step_done", step: "generate", status: generateResult.status === "pass" ? "pass" : "fail", detail: generateResult.detail });

    if (generateResult.status === "fail") {
      updateVerification(session.id, results);
      throw new Error(generateResult.detail ?? "Generation failed");
    }

    onEvent({ type: "step_start", step: "token-check" });
    const tokenCheck = runTokenCheck(producedPaths);
    results.push(tokenCheck.result);
    onEvent({
      type: "step_done",
      step: "token-check",
      status: tokenCheck.result.status === "fail" ? "fail" : "pass",
      detail: tokenCheck.result.detail,
    });

    onEvent({ type: "step_start", step: "screenshot" });
    const screenshot = await runScreenshot(sessionDir, producedPaths);
    results.push(screenshot.result);
    onEvent({
      type: "step_done",
      step: "screenshot",
      status: screenshot.result.status === "fail" ? "fail" : "pass",
      detail: screenshot.result.detail,
    });
    if (screenshot.screenshotPath) producedPaths.push(screenshot.screenshotPath);

    const descriptions = new Map((output?.files ?? []).map((f) => [f.filename, f.description]));
    for (const filePath of producedPaths) {
      const filename = path.basename(filePath);
      const artifact: ArtifactRef = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        type: skill?.outputType ?? "demo",
        filename,
        mimeType: MIME_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream",
        url: "",
        metadata: { storagePath: filePath, description: descriptions.get(filename) },
        createdAt: new Date().toISOString(),
      };
      artifact.url = `/api/artifacts/${artifact.id}/download`;
      addArtifact(session.id, artifact);
      onEvent({ type: "artifact_ready", artifact });
    }

    const gaps = [...(tokenCheck.gaps ?? []), ...(output?.gaps ?? [])];
    for (const gap of gaps) {
      recordGap(session.id, session.skillId, session.userEmail, gap);
      onEvent({ type: "gap_found", message: gap });
    }

    updateVerification(session.id, results);
    const scored = results.filter((r) => r.status !== "skip");
    const passRate = scored.length ? scored.filter((r) => r.status === "pass").length / scored.length : 1;
    updateAnalytics(session.id, {
      artifactReadyAt: new Date().toISOString(),
      timeToArtifactMs: Date.now() - startTime,
      verificationPassRate: passRate,
    });
    trackEvent({
      type: "artifact_ready",
      sessionId: session.id,
      skillId: session.skillId,
      userEmail: session.userEmail,
      metadata: { timeToArtifactMs: Date.now() - startTime, verificationPassRate: passRate, backend: "claude" },
    });
    trackEvent({
      type: "verification_complete",
      sessionId: session.id,
      skillId: session.skillId,
      userEmail: session.userEmail,
      metadata: { passRate, steps: results.length, backend: "claude" },
    });
  }
}
