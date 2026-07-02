import fs from "fs";
import path from "path";
import registry from "../../skills/registry.json";
import type { SkillDefinition } from "./types";

export function getSkills(): SkillDefinition[] {
  return registry.skills as SkillDefinition[];
}

export function getSkill(id: string): SkillDefinition | null {
  return getSkills().find((s) => s.id === id) ?? null;
}

export function getSkillMdPath(skillId: string): string {
  return path.join(process.cwd(), "skills", skillId, "SKILL.md");
}

export function loadSkillContent(skillId: string): string {
  const skillPath = getSkillMdPath(skillId);
  if (!fs.existsSync(skillPath)) {
    return `# ${skillId}\n\nSkill file not found.`;
  }
  return fs.readFileSync(skillPath, "utf-8");
}

export function getSkillsForRole(role: string): SkillDefinition[] {
  return getSkills().filter((s) => {
    if (s.requiredRole === "all") return true;
    if (s.requiredRole === "engineer" && (role === "engineer" || role === "admin"))
      return true;
    return false;
  });
}
