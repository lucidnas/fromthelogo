import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, action } = body as { ids: number[]; action: "accept" | "reject" | "restore" | "delete" };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No pitch IDs provided" }, { status: 400 });
    }

    if (action === "delete") {
      await prisma.calendarSlot.updateMany({
        where: { pitchId: { in: ids } },
        data: { pitchId: null, status: "open" },
      });
      await prisma.pitch.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    const statusMap = { accept: "accepted", reject: "rejected", restore: "pending" } as const;
    const status = statusMap[action];

    await prisma.pitch.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return NextResponse.json({ ok: true, updated: ids.length, status });
  } catch (error) {
    console.error("Bulk pitch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk action failed" },
      { status: 500 }
    );
  }
}
