import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSession, listSessions, saveSession, trackEvent } from "@/lib/db";
import { getSkill } from "@/lib/skills";
import { createSynthUpAdapter } from "@/lib/synthup/adapter";
import { resolveUser } from "@/lib/identity";
import type { CreateSessionInput, Session } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = resolveUser(req);
  if (!user) return NextResponse.json({ error: "Email domain not allowed" }, { status: 403 });
  const sessions = listSessions(user.email);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = resolveUser(req);
  if (!user) return NextResponse.json({ error: "Email domain not allowed" }, { status: 403 });
  const body = (await req.json()) as CreateSessionInput;

  if (body.skillId && !getSkill(body.skillId)) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 400 });
  }

  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    userEmail: user.email,
    skillId: body.skillId ?? null,
    phase: "intent" as const,
    synthupSessionId: null,
    spec: null,
    specApproved: false,
    title: body.title ?? "New request",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    artifacts: [],
    gaps: [],
    verification: [],
    analytics: { messageCount: 0 },
  };

  if (body.skillId) {
    const skill = getSkill(body.skillId)!;
    const adapter = await createSynthUpAdapter();
    const synthup = await adapter.createSession({
      skillId: body.skillId,
      workspace: skill.workspacePath,
      userEmail: user.email,
      studioSessionId: session.id,
    });
    session.synthupSessionId = synthup.id;
  }

  saveSession(session);
  trackEvent({
    type: "session_created",
    sessionId: session.id,
    skillId: session.skillId,
    userEmail: user.email,
  });

  return NextResponse.json({ session }, { status: 201 });
}
