import { NextRequest } from "next/server";
import { addMessage, getSession, saveSession, trackEvent } from "@/lib/db";
import { runPostProcessing } from "@/lib/pipeline";
import { createSynthUpAdapter, getAgentBackend } from "@/lib/synthup/adapter";
import type { StudioEvent } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  if (!session.spec) {
    return new Response(JSON.stringify({ error: "No spec to approve" }), { status: 400 });
  }
  if (session.specApproved) {
    return new Response(JSON.stringify({ error: "Already approved" }), { status: 400 });
  }

  session.specApproved = true;
  session.phase = "generating";
  session.analytics = {
    ...session.analytics,
    messageCount: session.analytics?.messageCount ?? 0,
    specConfirmedAt: new Date().toISOString(),
    generationStartedAt: new Date().toISOString(),
  };
  saveSession(session);

  trackEvent({
    type: "spec_confirmed",
    sessionId: session.id,
    skillId: session.skillId,
    userEmail: session.userEmail,
  });

  trackEvent({
    type: "generation_started",
    sessionId: session.id,
    skillId: session.skillId,
    userEmail: session.userEmail,
  });

  const encoder = new TextEncoder();
  const spec = session.spec;

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      function send(event: StudioEvent) {
        if (event.type === "text_delta") {
          assistantText += event.content;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        if (session.synthupSessionId) {
          const adapter = await createSynthUpAdapter();
          await adapter.approveSpec(session.synthupSessionId, spec, send);
        }

        // The Claude adapter generates real artifacts and runs verification
        // itself; the simulated post-processing is for the mock/SynthUp paths.
        if (getAgentBackend() !== "claude") {
          await runPostProcessing(session, spec, send);
        }

        if (assistantText) {
          addMessage(id, {
            id: crypto.randomUUID(),
            sessionId: id,
            role: "assistant",
            content: assistantText,
            createdAt: new Date().toISOString(),
          });
        }

        const updated = getSession(id);
        if (updated) {
          updated.phase = "complete";
          saveSession(updated);
        }
        send({ type: "phase_change", phase: "complete" });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Generation failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
