"use client";

import type { SkillDefinition } from "@/lib/types";

const ICONS: Record<string, string> = {
  component: "⚛",
  deck: "📊",
  social: "📱",
  demo: "🎨",
};

interface SkillPickerProps {
  skills: SkillDefinition[];
  onSelect: (skillId: string) => void;
  disabled?: boolean;
}

export function SkillPicker({ skills, onSelect, disabled }: SkillPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
      {skills.map((skill) => (
        <button
          key={skill.id}
          onClick={() => onSelect(skill.id)}
          disabled={disabled}
          className="text-left p-4 rounded-2xl border border-[var(--border-secondary)] bg-white hover:border-brand-500 hover:shadow-sm transition-all disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{ICONS[skill.icon] ?? "✦"}</span>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{skill.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                {skill.description}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2 italic">
                e.g. &ldquo;{skill.triggerExamples[0]}&rdquo;
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
