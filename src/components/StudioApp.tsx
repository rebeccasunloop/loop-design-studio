"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-identity";
import type { Session, SkillDefinition, SpecOutline, StudioEvent, VerificationResult } from "@/lib/types";
import { ArtifactPanel } from "./ArtifactPanel";
import { GapCallout } from "./GapCallout";
import { Sidebar } from "./Sidebar";
import { SkillPicker } from "./SkillPicker";
import { SpecConfirmationCard } from "./SpecConfirmationCard";
import { VerificationTimeline } from "./VerificationTimeline";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function StudioApp({ initialSkills }: { initialSkills: SkillDefinition[] }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingSpec, setPendingSpec] = useState<SpecOutline | null>(null);
  const [verification, setVerification] = useState<VerificationResult[]>([]);
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [gaps, setGaps] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState<{ label: string; tokens: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  // Elapsed-time ticker while the agent is working
  const running = streaming || approving;
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Artifact panel: closed by default, opens once this session has artifacts
  useEffect(() => {
    setArtifactPanelOpen((activeSession?.artifacts?.length ?? 0) > 0);
  }, [activeSession?.id, (activeSession?.artifacts?.length ?? 0) > 0]);

  useEffect(() => {
    if (activeId) loadSession(activeId);
    else {
      setActiveSession(null);
      setMessages([]);
      setPendingSpec(null);
      setVerification([]);
      setGaps([]);
    }
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, pendingSpec]);

  async function loadSessions() {
    const res = await apiFetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }

  async function loadSession(id: string) {
    const res = await apiFetch(`/api/sessions/${id}`);
    const data = await res.json();
    setActiveSession(data.session);
    setMessages(
      (data.session.messages ?? []).map((m: { id: string; role: "user" | "assistant"; content: string }) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    );
    setVerification(data.session.verification ?? []);
    setGaps(data.session.gaps?.map((g: { message: string }) => g.message) ?? []);
    if (data.session.spec && !data.session.specApproved) {
      setPendingSpec(data.session.spec);
    }
  }

  async function handleNewSession() {
    setActiveId(null);
    setActiveSession(null);
    setMessages([]);
    setPendingSpec(null);
    setStreamText("");
    setVerification([]);
    setGaps([]);
  }

  async function handleSelectSkill(skillId: string) {
    const res = await apiFetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    const data = await res.json();
    setSessions((prev) => [data.session, ...prev]);
    setActiveId(data.session.id);
    setActiveSession(data.session);
    setMessages([]);
    setPendingSpec(null);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !activeId || streaming) return;

    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);
    setStreaming(true);
    setStreamText("");
    setPendingSpec(null);

    let accumulated = "";
    setProgress({ label: "Starting agent…", tokens: 0 });
    await consumeSSE(`/api/sessions/${activeId}/messages`, { content }, (event) => {
      if (event.type === "text_delta") {
        accumulated += event.content;
        setStreamText(accumulated);
      }
      if (event.type === "agent_progress") {
        setProgress({ label: event.label, tokens: event.tokens ?? 0 });
      }
      if (event.type === "spec_ready") {
        setPendingSpec(event.spec);
      }
      if (event.type === "gap_found") {
        setGaps((prev) => [...prev, event.message]);
      }
    });

    setProgress(null);
    setStreamText("");
    setStreaming(false);
    await loadSession(activeId);
    await loadSessions();
  }

  async function handleApproveSpec() {
    if (!activeId || !pendingSpec) return;
    setApproving(true);
    setVerification([]);
    setActiveStep("ground");

    setProgress({ label: "Starting generation…", tokens: 0 });
    await consumeSSE(`/api/sessions/${activeId}/approve-spec`, {}, (event) => {
      if (event.type === "step_start") setActiveStep(event.step);
      if (event.type === "step_done") {
        setVerification((prev) => [
          ...prev.filter((s) => s.step !== event.step),
          { step: event.step, status: event.status, detail: event.detail },
        ]);
      }
      if (event.type === "agent_progress") {
        setProgress({ label: event.label, tokens: event.tokens ?? 0 });
      }
      if (event.type === "gap_found") {
        setGaps((prev) => [...prev, event.message]);
      }
      if (event.type === "artifact_ready") {
        setArtifactPanelOpen(true);
        loadSession(activeId);
      }
    });

    setProgress(null);
    setPendingSpec(null);
    setApproving(false);
    setActiveStep(undefined);
    await loadSession(activeId);
    await loadSessions();
  }

  const skill = initialSkills.find((s) => s.id === activeSession?.skillId);

  return (
    <div className="flex h-screen">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewSession}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-[var(--border-secondary)] bg-white flex items-center px-4 gap-3">
          {skill && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
              {skill.name}
            </span>
          )}
          {activeSession && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] capitalize">
              {activeSession.phase.replace("_", " ")}
            </span>
          )}
          {activeSession && (
            <span
              className="text-xs px-2.5 py-1 rounded-full border border-[var(--border-secondary)] text-[var(--text-secondary)]"
              title="Model powering this session"
            >
              ✦ {modelDisplayName(activeSession.model)}
            </span>
          )}
          {verification.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700">
              {verification.filter((v) => v.status === "pass").length}/{verification.length} verified
            </span>
          )}
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Chat center */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border-secondary)]">
            {!activeSession ? (
              <div>
                <div className="p-6 text-center border-b border-[var(--border-secondary)]">
                  <h2 className="text-xl font-semibold">What do you want to create?</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Pick a workflow to get started with on-brand Loop output
                  </p>
                </div>
                <SkillPicker skills={initialSkills} onSelect={handleSelectSkill} />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 ${msg.role === "user" ? "bg-[var(--bg-secondary)]" : ""}`}
                    >
                      <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1 capitalize">
                        {msg.role}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}

                  {streaming && streamText && (
                    <div className="p-4">
                      <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">assistant</p>
                      <p className="text-sm whitespace-pre-wrap">{streamText}</p>
                    </div>
                  )}

                  {running && progress && (
                    <AgentActivity label={progress.label} tokens={progress.tokens} elapsed={elapsed} />
                  )}

                  {pendingSpec && (
                    <SpecConfirmationCard
                      spec={pendingSpec}
                      onApprove={handleApproveSpec}
                      onEdit={() => setPendingSpec(null)}
                      loading={approving}
                    />
                  )}

                  <GapCallout gaps={gaps} />
                  <div ref={bottomRef} />
                </div>

                <VerificationTimeline steps={verification} activeStep={activeStep} />

                <form onSubmit={handleSend} className="p-4 border-t border-[var(--border-secondary)] bg-white">
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        activeSession.phase === "spec_pending"
                          ? "Edit spec or ask a question…"
                          : "Describe what you want to create…"
                      }
                      disabled={streaming || approving}
                      className="flex-1 px-4 py-2.5 rounded-full border border-[var(--border-secondary)] text-sm focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="submit"
                      disabled={streaming || approving || !input.trim()}
                      className="px-5 py-2.5 rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Artifact panel — closed by default, opens when an artifact lands */}
          <div
            className={`flex-shrink-0 bg-white flex flex-col transition-all duration-300 ${
              artifactPanelOpen ? "w-96" : "w-11"
            }`}
          >
            {artifactPanelOpen ? (
              <>
                <button
                  onClick={() => setArtifactPanelOpen(false)}
                  className="h-9 flex items-center justify-end px-3 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border-b border-[var(--border-secondary)]"
                  title="Collapse artifacts"
                >
                  Artifacts ⏵
                </button>
                <ArtifactPanel
                  artifacts={activeSession?.artifacts ?? []}
                  skillId={activeSession?.skillId ?? null}
                />
              </>
            ) : (
              <button
                onClick={() => setArtifactPanelOpen(true)}
                className="flex-1 flex flex-col items-center pt-4 gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                title="Expand artifacts"
              >
                <span className="text-xs">⏴</span>
                <span className="text-xs" style={{ writingMode: "vertical-rl" }}>
                  Artifacts{(activeSession?.artifacts?.length ?? 0) > 0 ? ` (${activeSession!.artifacts.length})` : ""}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentActivity({ label, tokens, elapsed }: { label: string; tokens: number; elapsed: number }) {
  return (
    <div className="mx-4 my-2 px-4 py-3 rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] flex items-center gap-3">
      <span className="flex gap-1 items-center" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">{label}</span>
      <span className="text-xs text-[var(--text-tertiary)] tabular-nums flex-shrink-0">
        {tokens > 0 && <span className="mr-3">≈{formatTokens(tokens)} tokens</span>}
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-4-7": "Opus 4.7",
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-5": "Sonnet 5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
  "claude-fable-5": "Fable 5",
};

function modelDisplayName(model: string | null | undefined): string {
  if (!model) return "Opus 4.8"; // adapter default
  return MODEL_NAMES[model] ?? model;
}

async function consumeSSE(
  url: string,
  body: object,
  onEvent: (event: StudioEvent) => void
): Promise<void> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(line.slice(6)) as StudioEvent);
        } catch { /* skip */ }
      }
    }
  }
}
