"use client";

import type { VerificationResult } from "@/lib/types";

interface VerificationTimelineProps {
  steps: VerificationResult[];
  activeStep?: string;
}

const STEP_LABELS: Record<string, string> = {
  ground: "Ground in brand system",
  generate: "Generate artifact",
  verify: "Verify output",
  "type-check": "Type-check",
  lint: "Lint & AGENTS.md rules",
  "render-check": "Storybook render-check",
  "token-verify": "Token verification",
  "font-embed": "Font embedding",
  "visual-qa": "Visual QA",
  "dimension-check": "Dimension check",
  "token-check": "Token usage check",
  screenshot: "Screenshot capture",
};

export function VerificationTimeline({ steps, activeStep }: VerificationTimelineProps) {
  if (steps.length === 0 && !activeStep) return null;

  const allSteps = activeStep && !steps.find((s) => s.step === activeStep)
    ? [...steps, { step: activeStep, status: "pending" as const }]
    : steps;

  return (
    <div className="px-4 py-3 border-t border-[var(--border-secondary)]">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
        Verification
      </p>
      <div className="space-y-2">
        {allSteps.map((step) => (
          <div key={step.step} className="flex items-start gap-2">
            <StatusIcon status={step.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {STEP_LABELS[step.step] ?? step.step}
              </p>
              {step.detail && (
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: VerificationResult["status"] }) {
  switch (status) {
    case "pass":
      return (
        <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">
          ✓
        </span>
      );
    case "fail":
      return (
        <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs">
          ✗
        </span>
      );
    case "pending":
      return (
        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        </span>
      );
    case "skip":
      return (
        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs">
          –
        </span>
      );
  }
}
