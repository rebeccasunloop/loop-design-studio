import { NextRequest, NextResponse } from "next/server";
import { readArtifactContent } from "@/lib/artifacts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const result = readArtifactContent(decoded);
  if (!result) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const disposition = inline
    ? "inline"
    : `attachment; filename="${result.filename}"`;

  return new NextResponse(new Uint8Array(result.content), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": disposition,
    },
  });
}
