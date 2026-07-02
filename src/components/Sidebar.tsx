"use client";

import type { Session } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ sessions, activeId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--border-secondary)] bg-white flex flex-col">
      <div className="p-4 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            L
          </div>
          <div>
            <h1 className="font-semibold text-sm">Design Studio</h1>
            <p className="text-xs text-[var(--text-tertiary)]">Loop internal</p>
          </div>
        </div>
        <button
          onClick={onNew}
          className="w-full py-2 px-3 rounded-full bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          + New request
        </button>
        <a
          href="/analytics"
          className="block text-xs text-center text-[var(--text-tertiary)] hover:text-brand-600 mt-2"
        >
          Beta analytics →
        </a>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] p-3 text-center">
            No conversations yet
          </p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full text-left p-3 rounded-xl mb-1 text-sm transition-colors ${
                activeId === s.id
                  ? "bg-brand-100 text-brand-700"
                  : "hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              }`}
            >
              <p className="font-medium truncate">{s.title}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 capitalize">
                {s.phase.replace("_", " ")}
                {s.skillId ? ` · ${s.skillId.split("-").pop()}` : ""}
              </p>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
