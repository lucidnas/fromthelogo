import { NextResponse } from "next/server";
import { fetchAllNewsItems } from "@/lib/news-sources";

export async function GET() {
  try {
    const started = Date.now();
    const grouped = await fetchAllNewsItems();
    const durationMs = Date.now() - started;

    const counts = {
      youtube: grouped.youtube.length,
      athlon: grouped.athlon.length,
    };
    const total = counts.youtube + counts.athlon;
    const youtubeShare = total > 0 ? Math.round((counts.youtube / total) * 100) : 0;

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
