import { NextResponse } from "next/server";
import { getSkillsForRole } from "@/lib/skills";

export async function GET() {
  // In production, role comes from session; default to all skills for dev
  const skills = getSkillsForRole("engineer");
  return NextResponse.json({ skills });
}
