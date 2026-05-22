import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { VIDEOS_DIR } from "@/lib/studio";

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  json: "application/json",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path: parts } = await params;
  const filePath = path.join(VIDEOS_DIR, slug, ...parts);

  try {
    const data = fs.readFileSync(filePath);
    const ext = parts[parts.length - 1].split(".").pop() ?? "";
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
