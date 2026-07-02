"use client";

import { useEffect, useState } from "react";

interface AnalyticsSummary {
  totalSessions: number;
  specConfirmationRate: number;
  avgTimeToArtifactMs: number;
  verificationPassRate: number;
  gapsFound: number;
  bySkill: Record<string, number>;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary));
  }, []);

  if (!summary) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading analytics…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Beta Analytics</h1>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Total sessions" value={String(summary.totalSessions)} />
        <MetricCard
          label="Spec confirmation rate"
          value={`${Math.round(summary.specConfirmationRate * 100)}%`}
        />
        <MetricCard
          label="Avg time to artifact"
          value={`${Math.round(summary.avgTimeToArtifactMs / 1000)}s`}
        />
        <MetricCard
          label="Verification pass rate"
          value={`${Math.round(summary.verificationPassRate * 100)}%`}
        />
        <MetricCard label="Gaps found" value={String(summary.gapsFound)} />
      </div>
      <h2 className="text-lg font-semibold mt-8 mb-3">By skill</h2>
      <div className="space-y-2">
        {Object.entries(summary.bySkill).map(([skill, count]) => (
          <div key={skill} className="flex justify-between text-sm p-3 rounded-xl bg-white border">
            <span>{skill}</span>
            <span className="font-medium">{count}</span>
          </div>
        ))}
        {Object.keys(summary.bySkill).length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">No sessions yet</p>
        )}
      </div>
      <a href="/" className="inline-block mt-6 text-sm text-brand-600 hover:underline">
        ← Back to Studio
      </a>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-[var(--border-secondary)]">
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
