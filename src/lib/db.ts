import fs from "fs";
import path from "path";
import type {
  ArtifactRef,
  GapFinding,
  Session,
  SessionAnalytics,
  User,
} from "./types";

interface DatabaseSchema {
  sessions: Session[];
  users: User[];
  analytics: AnalyticsEvent[];
}

export interface AnalyticsEvent {
  id: string;
  type:
    | "session_created"
    | "spec_confirmed"
    | "generation_started"
    | "artifact_ready"
    | "verification_complete"
    | "gap_found";
  sessionId: string;
  skillId: string | null;
  userEmail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const DEFAULT_DB: DatabaseSchema = { sessions: [], users: [], analytics: [] };

function getDbPath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "studio.db.json");
}

function readDb(): DatabaseSchema {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB, null, 2));
    return structuredClone(DEFAULT_DB);
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf-8")) as DatabaseSchema;
}

function writeDb(db: DatabaseSchema): void {
  const dbPath = getDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function getUserByEmail(email: string): User | null {
  const db = readDb();
  return db.users.find((u) => u.email === email) ?? null;
}

export function upsertUser(user: User): User {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.email === user.email);
  if (idx >= 0) db.users[idx] = user;
  else db.users.push(user);
  writeDb(db);
  return user;
}

export function getSession(id: string): Session | null {
  const db = readDb();
  return db.sessions.find((s) => s.id === id) ?? null;
}

export function listSessions(userEmail: string): Session[] {
  const db = readDb();
  return db.sessions
    .filter((s) => s.userEmail === userEmail)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function saveSession(session: Session): Session {
  const db = readDb();
  const idx = db.sessions.findIndex((s) => s.id === session.id);
  session.updatedAt = new Date().toISOString();
  if (idx >= 0) db.sessions[idx] = session;
  else db.sessions.push(session);
  writeDb(db);
  return session;
}

export function addArtifact(sessionId: string, artifact: ArtifactRef): void {
  const session = getSession(sessionId);
  if (!session) return;
  session.artifacts.push(artifact);
  saveSession(session);
}

export function addGap(sessionId: string, gap: GapFinding): void {
  const session = getSession(sessionId);
  if (!session) return;
  session.gaps.push(gap);
  saveSession(session);
}

export function updateVerification(
  sessionId: string,
  results: Session["verification"]
): void {
  const session = getSession(sessionId);
  if (!session) return;
  session.verification = results;
  saveSession(session);
}

export function updateAnalytics(
  sessionId: string,
  analytics: Partial<SessionAnalytics>
): void {
  const session = getSession(sessionId);
  if (!session) return;
  session.analytics = { ...session.analytics, messageCount: session.analytics?.messageCount ?? 0, ...analytics };
  saveSession(session);
}

export function trackEvent(event: Omit<AnalyticsEvent, "id" | "createdAt">): void {
  if (process.env.ANALYTICS_ENABLED === "false") return;
  const db = readDb();
  db.analytics.push({
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
}

export function getAnalyticsSummary(): {
  totalSessions: number;
  specConfirmationRate: number;
  avgTimeToArtifactMs: number;
  verificationPassRate: number;
  gapsFound: number;
  bySkill: Record<string, number>;
} {
  const db = readDb();
  const sessions = db.sessions;
  const withSpec = sessions.filter((s) => s.specApproved).length;
  const withArtifact = sessions.filter((s) => s.artifacts.length > 0);
  const times = withArtifact
    .map((s) => s.analytics?.timeToArtifactMs)
    .filter((t): t is number => typeof t === "number");
  const passRates = sessions
    .map((s) => s.analytics?.verificationPassRate)
    .filter((r): r is number => typeof r === "number");
  const bySkill: Record<string, number> = {};
  for (const s of sessions) {
    if (s.skillId) bySkill[s.skillId] = (bySkill[s.skillId] ?? 0) + 1;
  }
  return {
    totalSessions: sessions.length,
    specConfirmationRate: sessions.length ? withSpec / sessions.length : 0,
    avgTimeToArtifactMs: times.length
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0,
    verificationPassRate: passRates.length
      ? passRates.reduce((a, b) => a + b, 0) / passRates.length
      : 0,
    gapsFound: db.analytics.filter((e) => e.type === "gap_found").length,
    bySkill,
  };
}
