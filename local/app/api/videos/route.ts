import { NextRequest, NextResponse } from "next/server";
import { listVideos, writeVideoMeta, slugify } from "@/lib/studio";

export async function GET() {
  return NextResponse.json({ videos: listVideos() });
}

export async function POST(req: NextRequest) {
  const { title, status, category, hookLine, thumbnailFormat, thumbnailWord, thumbnailBubble } = await req.json();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const slug = slugify(title);
  writeVideoMeta(slug, {
    title,
    status: status ?? "idea",
    category,
    hookLine,
    thumbnailFormat,
    thumbnailWord,
    thumbnailBubble,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ slug });
}
