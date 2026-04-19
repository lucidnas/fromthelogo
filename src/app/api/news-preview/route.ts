import { NextResponse } from "next/server";
import { fetchAllNewsItems } from "@/lib/news-sources";

export async function GET() {
  try {
    const started = Date.now();
    const grouped = await fetchAllNewsItems();
    const durationMs = Date.now() - started;

    const counts = {
      journalism: grouped.journalism.length,
      twitter: grouped.twitter.length,
      outlet: grouped.outlet.length,
      gnews: grouped.gnews.length,
      competitors: grouped.competitors.length,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const youtubeCount = counts.journalism + counts.competitors;
    const youtubeShare = total > 0 ? Math.round((youtubeCount / total) * 100) : 0;

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      durationMs,
      counts,
      total,
      youtubeShare,
      items: grouped,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
