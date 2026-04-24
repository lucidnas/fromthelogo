import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — list all story research briefs, strongest first
export async function GET() {
  try {
    const items = await prisma.storyResearch.findMany({
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
  }
}

// POST — push a research brief from local /ftl-research
// Auth: x-cron-secret header
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, summary, sources, score } = await request.json();
    if (!title || !summary) {
      return NextResponse.json({ error: "title and summary are required" }, { status: 400 });
    }

    const item = await prisma.storyResearch.create({
      data: {
        title: title.trim(),
        summary: summary.trim(),
        sources: sources ?? [],
        score: Number(score) || 0,
      },
    });

    return NextResponse.json({ id: item.id, ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save story" },
      { status: 500 }
    );
  }
}
