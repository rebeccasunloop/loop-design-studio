"use client";

interface GapCalloutProps {
  gaps: string[];
}

export function GapCallout({ gaps }: GapCalloutProps) {
  if (gaps.length === 0) return null;

  return (
    <div className="mx-4 my-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
        Design system findings
      </p>
      <ul className="space-y-1">
        {gaps.map((gap) => (
          <li key={gap} className="text-sm text-amber-900 flex gap-2">
            <span>⚠</span>
            {gap}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-700 mt-2">
        These gaps feed the design-system backlog — not failures.
      </p>
    </div>
  );
}
