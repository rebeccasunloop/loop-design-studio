export type OutputType = "component" | "deck" | "social" | "demo";
export type UserRole = "all" | "engineer" | "admin";
export type SessionPhase =
  | "intent"
  | "clarify"
  | "spec_pending"
  | "generating"
  | "complete"
  | "error";

export type VerificationStep =
  | "ground"
  | "generate"
  | "verify"
  | "type-check"
  | "lint"
  | "render-check"
  | "token-verify"
  | "font-embed"
  | "visual-qa"
  | "dimension-check"
  | "token-check"
  | "screenshot";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  outputType: OutputType;
  icon: string;
  workspacePath: string;
  requiredRole: UserRole;
  triggerExamples: string[];
  verificationSteps: string[];
}

export interface SpecOutline {
  title: string;
  summary: string;
  sections: SpecSection[];
  assumptions?: string[];
}

export interface SpecSection {
  heading: string;
  items: string[];
}

export interface ArtifactRef {
  id: string;
  sessionId: string;
  type: OutputType;
  filename: string;
  mimeType: string;
  url: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface VerificationResult {
  step: string;
  status: "pass" | "fail" | "pending" | "skip";
  detail?: string;
  durationMs?: number;
}

export interface GapFinding {
  id: string;
  sessionId: string;
  skillId: string;
  message: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: {
    quickReplies?: string[];
    spec?: SpecOutline;
    verification?: VerificationResult[];
  };
}

export interface Session {
  id: string;
  userId: string;
  userEmail: string;
  skillId: string | null;
  phase: SessionPhase;
  synthupSessionId: string | null;
  spec: SpecOutline | null;
  specApproved: boolean;
  title: string;
  createdAt: string;
  updatedAt: string;
  artifacts: ArtifactRef[];
  gaps: GapFinding[];
  verification: VerificationResult[];
  analytics?: SessionAnalytics;
}

export interface SessionAnalytics {
  specConfirmedAt?: string;
  generationStartedAt?: string;
  artifactReadyAt?: string;
  timeToArtifactMs?: number;
  verificationPassRate?: number;
  messageCount: number;
}

export type StudioEvent =
  | { type: "text_delta"; content: string }
  | { type: "message_complete"; messageId: string }
  | { type: "spec_ready"; spec: SpecOutline }
  | { type: "step_start"; step: VerificationStep }
  | { type: "step_done"; step: string; status: "pass" | "fail"; detail?: string }
  | { type: "artifact_ready"; artifact: ArtifactRef }
  | { type: "gap_found"; message: string }
  | { type: "phase_change"; phase: SessionPhase }
  | { type: "error"; message: string };

export interface CreateSessionInput {
  skillId?: string;
  userEmail: string;
  userId: string;
  title?: string;
}

export interface SendMessageInput {
  content: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
