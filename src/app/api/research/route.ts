import { NextResponse } from "next/server";
import { researchUrls, type ResearchItem } from "@/lib/research";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: ResearchItem[] = body.items || [];
    const forceRefresh: boolean = !!body.forceRefresh;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }
    if (items.length > 15) {
      return NextResponse.json({ error: "max 15 items per call" }, { status: 400 });
    }
    for (const it of items) {
      if (!it.url || !it.source || !it.title) {
        return NextResponse.json(
          { error: "each item needs url, source, title" },
          { status: 400 }
        );
      }
    }

    const results = await researchUrls(items, { forceRefresh });
    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error("Research error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const all = await prisma.researchSummary.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ results: all, count: all.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
