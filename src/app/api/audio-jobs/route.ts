import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/audio-jobs?videoId=N — list active (pending/processing) jobs for a video
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }
  const jobs = await prisma.audioJob.findMany({
    where: {
      videoId: Number(videoId),
      status: { in: ["pending", "processing"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ jobs });
}
