import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slotId = parseInt(id, 10);

    if (isNaN(slotId)) {
      return NextResponse.json({ error: "Invalid slot ID" }, { status: 400 });
    }

    const body = await request.json();
    const { pitchId, status, notes, videoId } = body;

    const data: Record<string, unknown> = {};
    if (pitchId !== undefined) data.pitchId = pitchId;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (videoId !== undefined) data.videoId = videoId;

    // If assigning a pitch and status is still open, move to planned
    if (pitchId && !status) {
      const current = await prisma.calendarSlot.findUnique({ where: { id: slotId } });
      if (current && current.status === "open") {
        data.status = "planned";
      }
    }

    const slot = await prisma.calendarSlot.update({
      where: { id: slotId },
      data,
      include: { pitch: true },
    });

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Update calendar slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update calendar slot" },
      { status: 500 }
    );
  }
}
