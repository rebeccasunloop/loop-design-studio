import { StudioApp } from "@/components/StudioApp";
import { getSkillsForRole } from "@/lib/skills";

export default function Home() {
  const skills = getSkillsForRole("engineer");
  return <StudioApp initialSkills={skills} />;
}
