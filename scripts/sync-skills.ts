#!/usr/bin/env npx tsx
/**
 * Sync skills from loop-design-studio/skills/ to SynthUp on deploy.
 * Run: npm run sync-skills
 */
import fs from "fs";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), "skills");
const REGISTRY_PATH = path.join(SKILLS_DIR, "registry.json");

interface Registry {
  skills: { id: string; name: string }[];
}

async function main() {
  const registry: Registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  const apiUrl = process.env.SYNTHUP_API_URL;
  const apiKey = process.env.SYNTHUP_API_KEY;

  console.log(`Syncing ${registry.skills.length} skills...`);

  for (const skill of registry.skills) {
    const skillPath = path.join(SKILLS_DIR, skill.id, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      console.warn(`  ⚠ Missing: ${skill.id}/SKILL.md`);
      continue;
    }
    const content = fs.readFileSync(skillPath, "utf-8");
    console.log(`  ✓ ${skill.id} (${content.length} bytes)`);

    if (apiUrl && apiKey) {
      const res = await fetch(`${apiUrl}/v1/skills`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: skill.id, content }),
      });
      if (!res.ok) {
        console.error(`  ✗ Failed to sync ${skill.id}: ${res.status}`);
      }
    }
  }

  if (!apiUrl) {
    console.log("\nSYNTHUP_API_URL not set — skills validated locally only.");
  } else {
    console.log("\nSkills synced to SynthUp.");
  }
}

main().catch(console.error);
