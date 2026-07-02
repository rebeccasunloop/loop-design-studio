import fs from "fs";
import path from "path";
import { getSession } from "./db";
import type { ArtifactRef, OutputType } from "./types";

function getArtifactsDir(): string {
  const dir = process.env.ARTIFACTS_PATH ?? path.join(process.cwd(), "storage", "artifacts");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveArtifactFile(
  sessionId: string,
  filename: string,
  content: string | Buffer,
  type: OutputType,
  mimeType: string,
  metadata?: Record<string, unknown>
): ArtifactRef {
  const dir = path.join(getArtifactsDir(), sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  const id = crypto.randomUUID();
  return {
    id,
    sessionId,
    type,
    filename,
    mimeType,
    url: `/api/artifacts/${id}/download`,
    metadata: { ...metadata, storagePath: filePath },
    createdAt: new Date().toISOString(),
  };
}

export function getArtifactById(artifactId: string): {
  content: Buffer;
  mimeType: string;
  filename: string;
} | null {
  // Search all sessions for artifact
  const dataPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "studio.db.json");
  if (!fs.existsSync(dataPath)) return null;
  const db = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
    sessions: { artifacts: ArtifactRef[] }[];
  };

  for (const session of db.sessions) {
    const artifact = session.artifacts.find((a) => a.id === artifactId);
    if (artifact) {
      const filePath = path.join(
        getArtifactsDir(),
        artifact.sessionId,
        artifact.filename
      );
      if (fs.existsSync(filePath)) {
        return {
          content: fs.readFileSync(filePath),
          mimeType: artifact.mimeType,
          filename: artifact.filename,
        };
      }
    }
  }
  return null;
}

export function readArtifactContent(artifactId: string): {
  content: Buffer;
  mimeType: string;
  filename: string;
} | null {
  return getArtifactById(artifactId);
}
