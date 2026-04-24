import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH — update status (new → scripted / dismissed)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!["new", "scripted", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const item = await prisma.storyResearch.update({
      where: { id: Number(id) },
      data: { status, updatedAt: new Date() },
    });

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update story" }, { status: 500 });
  }
}

// DELETE — remove a story brief
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.storyResearch.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete story" }, { status: 500 });
  }
}
