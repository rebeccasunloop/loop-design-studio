"use client";

import { useEffect, useRef, useState } from "react";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

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
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }

  async function loadSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`);
    const data = await res.json();
    setActiveSession(data.session);
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
    const res = await fetch("/api/sessions", {
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
    await consumeSSE(`/api/sessions/${activeId}/messages`, { content }, (event) => {
      if (event.type === "text_delta") {
        accumulated += event.content;
        setStreamText(accumulated);
      }
      if (event.type === "spec_ready") {
        setPendingSpec(event.spec);
      }
      if (event.type === "gap_found") {
        setGaps((prev) => [...prev, event.message]);
      }
    });

    if (accumulated) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: accumulated },
      ]);
    }
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

    await consumeSSE(`/api/sessions/${activeId}/approve-spec`, {}, (event) => {
      if (event.type === "step_start") setActiveStep(event.step);
      if (event.type === "step_done") {
        setVerification((prev) => [
          ...prev.filter((s) => s.step !== event.step),
          { step: event.step, status: event.status, detail: event.detail },
        ]);
      }
      if (event.type === "gap_found") {
        setGaps((prev) => [...prev, event.message]);
      }
      if (event.type === "artifact_ready") {
        loadSession(activeId);
      }
    });

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

          {/* Artifact panel */}
          <div className="w-96 flex-shrink-0 bg-white flex flex-col">
            <ArtifactPanel
              artifacts={activeSession?.artifacts ?? []}
              skillId={activeSession?.skillId ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

async function consumeSSE(
  url: string,
  body: object,
  onEvent: (event: StudioEvent) => void
): Promise<void> {
  const res = await fetch(url, {
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
