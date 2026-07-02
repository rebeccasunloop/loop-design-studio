"use client";

import type { ArtifactRef } from "@/lib/types";

interface ArtifactPanelProps {
  artifacts: ArtifactRef[];
  skillId: string | null;
}

export function ArtifactPanel({ artifacts, skillId }: ArtifactPanelProps) {
  if (artifacts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-4xl mb-3 opacity-30">◈</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Artifacts will appear here after generation
          </p>
        </div>
      </div>
    );
  }

  const primary = artifacts.find((a) => !a.filename.includes("slide-") && !a.filename.includes("social-") && !a.filename.includes("screenshot")) ?? artifacts[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[var(--border-secondary)]">
        <h3 className="font-semibold text-sm">{primary.filename}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 capitalize">
          {primary.type} artifact
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {primary.type === "demo" && primary.filename.endsWith(".html") && (
          <DemoPreview url={primary.url} />
        )}
        {primary.type === "component" && (
          <ComponentPreview artifact={primary} />
        )}
        {primary.type === "deck" && (
          <DeckPreview artifacts={artifacts} primary={primary} />
        )}
        {primary.type === "social" && (
          <SocialPreview artifacts={artifacts} primary={primary} />
        )}
      </div>

      <div className="p-4 border-t border-[var(--border-secondary)] space-y-2">
        {primary.type === "component" && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
            Scratch folder only — ready for engineer review. Never auto-merged.
          </p>
        )}
        {primary.type === "demo" && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
            Prototype only — not production code.
          </p>
        )}
        <a
          href={primary.url}
          download
          className="block w-full py-2.5 text-center rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          Download
        </a>
      </div>
    </div>
  );
}

function DemoPreview({ url }: { url: string }) {
  const previewUrl = `${url}?inline=1`;
  return (
    <iframe
      src={previewUrl}
      className="w-full h-[500px] rounded-xl border border-[var(--border-secondary)] bg-white"
      sandbox="allow-scripts allow-same-origin"
      title="Demo preview"
    />
  );
}

function ComponentPreview({ artifact }: { artifact: ArtifactRef }) {
  const storybookUrl = artifact.metadata?.storybookUrl as string | undefined;
  return (
    <div className="space-y-3">
      <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-xl overflow-auto max-h-80">
        <code>Download to view TSX source</code>
      </pre>
      {storybookUrl && (
        <a
          href={storybookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-600 hover:underline"
        >
          Open in Storybook →
        </a>
      )}
      {Array.isArray(artifact.metadata?.gaps) && (
        <ul className="text-xs text-amber-700 space-y-1">
          {(artifact.metadata.gaps as string[]).map((g) => (
            <li key={g}>⚠ {g}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeckPreview({
  artifacts,
  primary,
}: {
  artifacts: ArtifactRef[];
  primary: ArtifactRef;
}) {
  const slides = artifacts.filter((a) => a.filename.startsWith("slide-"));
  let manifest: { slides?: { index: number; layout: string }[] } = {};
  try {
    // manifest is in primary json - thumbnails are separate
  } catch { /* */ }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((slide) => (
          <div key={slide.id} className="flex-shrink-0">
            <img
              src={slide.url}
              alt={slide.filename}
              className="w-40 h-auto rounded-lg border border-[var(--border-secondary)]"
            />
          </div>
        ))}
      </div>
      {slides.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          Deck manifest ready. Full .pptx via loop-brand-deck build scripts.
        </p>
      )}
    </div>
  );
}

function SocialPreview({
  artifacts,
}: {
  artifacts: ArtifactRef[];
  primary: ArtifactRef;
}) {
  const images = artifacts.filter((a) => a.filename.startsWith("social-"));
  const platforms = ["linkedin", "instagram", "twitter"] as const;
  const labels = { linkedin: "LinkedIn", instagram: "Instagram", twitter: "X" };

  return (
    <div className="space-y-4">
      {platforms.map((p) => {
        const img = images.find((a) => a.filename.includes(p));
        if (!img) return null;
        return (
          <div key={p}>
            <p className="text-xs font-medium text-[var(--text-tertiary)] mb-1">
              {labels[p]}
            </p>
            <img
              src={img.url}
              alt={labels[p]}
              className="w-full rounded-lg border border-[var(--border-secondary)]"
            />
          </div>
        );
      })}
    </div>
  );
}
