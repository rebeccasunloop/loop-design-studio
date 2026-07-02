"use client";

import type { SpecOutline } from "@/lib/types";

interface SpecConfirmationCardProps {
  spec: SpecOutline;
  onApprove: () => void;
  onEdit: () => void;
  loading?: boolean;
}

export function SpecConfirmationCard({
  spec,
  onApprove,
  onEdit,
  loading,
}: SpecConfirmationCardProps) {
  return (
    <div className="mx-4 my-3 p-4 rounded-2xl border-2 border-brand-500 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-brand-500">
          Spec for review
        </span>
      </div>
      <h3 className="font-semibold text-lg">{spec.title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{spec.summary}</p>

      <div className="mt-4 space-y-3">
        {spec.sections.map((section) => (
          <div key={section.heading}>
            <h4 className="text-sm font-medium text-brand-600">{section.heading}</h4>
            <ul className="mt-1 space-y-0.5">
              {section.items.map((item) => (
                <li key={item} className="text-sm text-[var(--text-secondary)] flex gap-2">
                  <span className="text-brand-500">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {spec.assumptions && spec.assumptions.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-medium text-amber-800 mb-1">Assumptions / gaps</p>
          {spec.assumptions.map((a) => (
            <p key={a} className="text-xs text-amber-700">{a}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex-1 py-2.5 px-4 rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Building…" : "Approve & Build"}
        </button>
        <button
          onClick={onEdit}
          disabled={loading}
          className="py-2.5 px-4 rounded-full border border-[var(--border-secondary)] text-sm font-medium hover:bg-[var(--bg-secondary)]"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
