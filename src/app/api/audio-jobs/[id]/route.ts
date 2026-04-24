import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.audioJob.findUnique({
    where: { id: Number(id) },
    include: {
      video: { select: { id: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If done, also fetch the audio record so the client can update the history
  let audio = null;
  if (job.status === "done" && job.audioId) {
    audio = await prisma.audio.findUnique({ where: { id: job.audioId } });
  }

  return NextResponse.json({ job, audio });
}
