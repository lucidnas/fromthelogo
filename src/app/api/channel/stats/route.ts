import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const videos = await prisma.channelStat.findMany({
      orderBy: { views: "desc" },
    });

    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const totalVideos = videos.length;

    // Format stats
    const formats = ["the-day", "increasingly", "backfired", "highlight", "other"];
    const formatStats = formats.map((format) => {
      const vids = videos.filter((v) => v.format === format);
      const fTotalViews = vids.reduce((s, v) => s + v.views, 0);
      const avgViews = vids.length > 0 ? Math.round(fTotalViews / vids.length) : 0;
      const best = vids.length > 0 ? vids[0] : null; // already sorted by views desc
      return { format, count: vids.length, totalViews: fTotalViews, avgViews, bestVideo: best };
    });

    // Duration analysis
    const durations = videos.map((v) => v.duration);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const sweetSpotVideos = videos.filter((v) => v.duration >= 450 && v.duration <= 520);
    const sweetSpotAvg = sweetSpotVideos.length > 0
      ? Math.round(sweetSpotVideos.reduce((s, v) => s + v.views, 0) / sweetSpotVideos.length)
      : 0;

    // Recent videos (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentVideos = videos.filter((v) => new Date(v.publishedAt) >= thirtyDaysAgo);

    // Performance tiers
    const tier1M = videos.filter((v) => v.views >= 1_000_000).length;
    const tier500K = videos.filter((v) => v.views >= 500_000 && v.views < 1_000_000).length;
    const tier200K = videos.filter((v) => v.views >= 200_000 && v.views < 500_000).length;
    const tier100K = videos.filter((v) => v.views >= 100_000 && v.views < 200_000).length;
    const under100K = videos.filter((v) => v.views < 100_000).length;

    return NextResponse.json({
      videos,
      totalViews,
      totalVideos,
      formatStats,
      durationAnalysis: { sweetSpot: sweetSpotAvg, avgDuration },
      recentVideos,
      performanceTiers: { tier1M, tier500K, tier200K, tier100K, under100K },
    });
  } catch (error) {
    console.error("Channel stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
