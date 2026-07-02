import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addMessage, getSession, saveSession } from "@/lib/db";
import { getSkill } from "@/lib/skills";
import { createSynthUpAdapter } from "@/lib/synthup/adapter";
import type { StudioEvent } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
  const sess = session;

  const { content } = await req.json();
  if (!content?.trim()) {
    return new Response(JSON.stringify({ error: "Empty message" }), { status: 400 });
  }

  if (!sess.skillId) {
    return new Response(JSON.stringify({ error: "Select a skill first" }), { status: 400 });
  }

  const skill = getSkill(sess.skillId);
  if (!skill) {
    return new Response(JSON.stringify({ error: "Unknown skill" }), { status: 400 });
  }

  if (!sess.synthupSessionId) {
    const adapter = await createSynthUpAdapter();
    const synthup = await adapter.createSession({
      skillId: sess.skillId,
      workspace: skill.workspacePath,
      userEmail: sess.userEmail,
      studioSessionId: sess.id,
    });
    sess.synthupSessionId = synthup.id;
  }

  sess.phase = "clarify";
  sess.analytics = {
    ...sess.analytics,
    messageCount: (sess.analytics?.messageCount ?? 0) + 1,
  };
  if (sess.title === "New request") {
    sess.title = content.slice(0, 60);
  }
  saveSession(sess);
  addMessage(sess.id, {
    id: uuidv4(),
    sessionId: sess.id,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  });

  const synthupSessionId = sess.synthupSessionId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      function send(event: StudioEvent) {
        if (event.type === "text_delta") {
          assistantText += event.content;
        }
        if (event.type === "spec_ready") {
          const current = getSession(id);
          if (current) {
            current.spec = event.spec;
            current.phase = "spec_pending";
            saveSession(current);
          }
        }
        if (event.type === "phase_change") {
          const current = getSession(id);
          if (current) {
            current.phase = event.phase;
            saveSession(current);
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const adapter = await createSynthUpAdapter();
        await adapter.sendMessage(synthupSessionId!, content, send);
        if (assistantText) {
          addMessage(id, {
            id: uuidv4(),
            sessionId: id,
            role: "assistant",
            content: assistantText,
            createdAt: new Date().toISOString(),
          });
        }
        send({ type: "message_complete", messageId: uuidv4() });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
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
