import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: "desc" },
      include: { audios: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, script, status, hookLine, estimatedLength, category } = await request.json();
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const video = await prisma.video.create({
      data: {
        title,
        script: script || null,
        status: status || (script ? "scripted" : "idea"),
        hookLine: hookLine || null,
        estimatedLength: estimatedLength || null,
        category: category || "analysis",
        thumbnailConcept: "",
        tags: [],
      },
    });
    return NextResponse.json({ video });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
  }
}
