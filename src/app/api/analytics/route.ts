import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/db";

export async function GET() {
  const summary = getAnalyticsSummary();
  return NextResponse.json({ summary });
}
