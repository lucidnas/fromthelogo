import { NextRequest, NextResponse } from "next/server";
import { writeVideoMeta } from "@/lib/studio";
import type { VideoStatus } from "@/lib/studio";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();

  const allowed: VideoStatus[] = ["idea", "researched", "scripted", "vo", "rendered"];
  if (body.status && !allowed.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const updated = writeVideoMeta(slug, body);
  return NextResponse.json({ ok: true, ...updated });
}
