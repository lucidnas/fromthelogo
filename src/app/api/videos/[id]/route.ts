import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({
      where: { id: Number(id) },
      include: { audios: { orderBy: { createdAt: "desc" } } },
    });
    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ video });
  } catch {
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, script, status, hookLine, estimatedLength, category } = body;

    const video = await prisma.video.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(script !== undefined && { script }),
        ...(status !== undefined && { status }),
        ...(hookLine !== undefined && { hookLine }),
        ...(estimatedLength !== undefined && { estimatedLength }),
        ...(category !== undefined && { category }),
      },
      include: { audios: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return NextResponse.json({ video });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.video.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
