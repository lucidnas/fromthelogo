"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clock, TrendingUp, Lightbulb, Trophy, Eye, Loader2 } from "lucide-react";

type FormatKey = "the-day" | "increasingly" | "backfired" | "highlight" | "other";

interface VideoRecord {
  id: number;
  youtubeId: string;
  title: string;
  views: number;
  duration: number;
  format: string;
  tags: string[];
  publishedAt: string;
  lastChecked: string;
}

interface FormatStat {
  format: string;
  count: number;
  totalViews: number;
  avgViews: number;
  bestVideo: VideoRecord | null;
}

interface StatsData {
  videos: VideoRecord[];
  totalViews: number;
  totalVideos: number;
  formatStats: FormatStat[];
  durationAnalysis: { sweetSpot: number; avgDuration: number };
  performanceTiers: { tier1M: number; tier500K: number; tier200K: number; tier100K: number; under100K: number };
}

const formatLabels: Record<FormatKey, string> = {
  "the-day": "The Day",
  increasingly: "Increasingly",
  backfired: "Backfired",
  highlight: "Highlight",
  other: "Other",
};

const formatColors: Record<FormatKey, string> = {
  "the-day": "#8B5CF6",
  increasingly: "#10B981",
  backfired: "#F59E0B",
  highlight: "#3B82F6",
  other: "#6B7280",
};

function getTierColor(views: number) {
  if (views >= 1_000_000) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  if (views >= 500_000) return "text-purple-400 bg-purple-500/10 border-purple-500/30";
  if (views >= 200_000) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (views >= 100_000) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return "text-gray-400 bg-gray-500/10 border-gray-500/30";
}

function getTierLabel(views: number) {
  if (views >= 1_000_000) return "1M+";
  if (views >= 500_000) return "500K+";
  if (views >= 200_000) return "200K+";
  if (views >= 100_000) return "100K+";
  return "<100K";
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/channel/stats")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-10 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!data || !data.videos) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-10 text-center text-gray-400">
        No channel data found. Run the seed script or refresh stats first.
      </div>
    );
  }

  const { videos, totalViews, totalVideos, formatStats, durationAnalysis } = data;
  const sortedFormatStats = [...formatStats].sort((a, b) => b.avgViews - a.avgViews);
  const maxAvg = Math.max(...sortedFormatStats.map((f) => f.avgViews));
  const topVideo = videos[0];

  // Pattern stats
  const patterns = [
    { name: '"The Day [PERSON] [DRAMATIC VERB] [TARGET]"', format: "the-day" },
    { name: '"[THING].. but they get increasingly [ADJECTIVE]"', format: "increasingly" },
    { name: '"The [ENTITY] [ACTION].. But it Backfired"', format: "backfired" },
    { name: '"This Caitlin Clark [THING] is [SUPERLATIVE]"', format: "highlight" },
    { name: "Other / Unique Formats", format: "other" },
  ];
  const patternStats = patterns
    .map((p) => {
      const fs = formatStats.find((f) => f.format === p.format);
      return { name: p.name, avgViews: fs?.avgViews || 0, count: fs?.count || 0 };
    })
    .sort((a, b) => b.avgViews - a.avgViews);

  // Duration sorted
  const sortedByDuration = [...videos].sort((a, b) => a.duration - b.duration);

  // Insights
  const bestFormat = sortedFormatStats[0];
  const sweetSpotVids = videos.filter((v) => v.duration >= 450 && v.duration <= 520);
  const outsideVids = videos.filter((v) => v.duration < 450 || v.duration > 520);
  const sweetSpotAvg = sweetSpotVids.length > 0 ? Math.round(sweetSpotVids.reduce((s, v) => s + v.views, 0) / sweetSpotVids.length) : 0;
  const outsideAvg = outsideVids.length > 0 ? Math.round(outsideVids.reduce((s, v) => s + v.views, 0) / outsideVids.length) : 0;
  const durationDiff = outsideAvg > 0 ? Math.round(((sweetSpotAvg - outsideAvg) / outsideAvg) * 100) : 0;

  const backfiredStat = formatStats.find((f) => f.format === "backfired");
  const backfiredVids = videos.filter((v) => v.format === "backfired");
  const allAbove100K = backfiredVids.every((v) => v.views >= 100_000);
  const backfiredMin = backfiredVids.length > 0 ? Math.min(...backfiredVids.map((v) => v.views)) : 0;

  const theDayStat = formatStats.find((f) => f.format === "the-day");
  const increasinglyStat = formatStats.find((f) => f.format === "increasingly");

  const insights = [
    `Your best format is "${formatLabels[bestFormat.format as FormatKey]}" narratives averaging ${formatNumber(bestFormat.avgViews)} views across ${bestFormat.count} videos.`,
    `Videos in the 7:30-8:40 sweet spot average ${formatNumber(sweetSpotAvg)} views${durationDiff !== 0 ? `, outperforming other durations by ${durationDiff}%` : ""}.`,
    allAbove100K && backfiredVids.length > 0
      ? `"Backfired" titles generate consistent ${formatNumber(backfiredMin)}+ views with a reliable floor.`
      : `"Backfired" titles are a consistent performer across your catalog.`,
    `Total channel views: ${formatNumber(totalViews)} across ${totalVideos} videos.${theDayStat ? ` "The Day" format accounts for ${Math.round((theDayStat.totalViews / totalViews) * 100)}% of all views.` : ""}`,
    increasinglyStat ? `"Increasingly" compilations average ${formatNumber(increasinglyStat.avgViews)} views with strong engagement.` : "",
  ].filter(Boolean);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-7 h-7 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Channel Analytics</h1>
        </div>
        <p className="text-gray-400 text-sm">Live performance data from all {totalVideos} From The Logo videos</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Total Views</span>
          </div>
          <span className="text-2xl font-bold text-white">{formatNumber(totalViews)}</span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Avg Views</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {formatNumber(Math.round(totalViews / totalVideos))}
          </span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Top Video</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {topVideo ? formatNumber(topVideo.views) : "N/A"}
          </span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Videos</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalVideos}</span>
        </div>
      </div>

      {/* Format Performance Grid */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Format Performance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sortedFormatStats.map((fs) => {
            const fk = fs.format as FormatKey;
            return (
              <div key={fs.format} className="p-5 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: (formatColors[fk] || "#6B7280") + "20", color: formatColors[fk] || "#6B7280" }}
                  >
                    {formatLabels[fk] || fs.format}
                  </span>
                  <span className="text-xs text-gray-500">{fs.count} videos</span>
                </div>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-white">{formatNumber(fs.avgViews)}</span>
                  <span className="text-xs text-gray-400 ml-2">avg views</span>
                </div>
                <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${maxAvg > 0 ? (fs.avgViews / maxAvg) * 100 : 0}%`,
                      backgroundColor: formatColors[fk] || "#6B7280",
                    }}
                  />
                </div>
                {fs.bestVideo && (
                  <div className="text-xs text-gray-500 truncate">
                    Best: <span className="text-gray-300">{fs.bestVideo.title}</span>{" "}
                    <span className="text-gray-400">({formatNumber(fs.bestVideo.views)})</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bar chart comparison */}
        <div className="p-6 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-300 mb-6">Average Views by Format</h3>
          <div className="space-y-4">
            {sortedFormatStats.map((fs) => {
              const fk = fs.format as FormatKey;
              return (
                <div key={fs.format} className="flex items-center gap-4">
                  <span className="text-xs text-gray-400 w-24 text-right shrink-0">
                    {formatLabels[fk] || fs.format}
                  </span>
                  <div className="flex-1 h-8 bg-[#1a1a24] rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg flex items-center transition-all duration-700"
                      style={{
                        width: `${maxAvg > 0 ? (fs.avgViews / maxAvg) * 100 : 0}%`,
                        backgroundColor: formatColors[fk] || "#6B7280",
                      }}
                    >
                      <span className="text-xs font-semibold text-white ml-3 whitespace-nowrap">
                        {formatNumber(fs.avgViews)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Duration Analysis */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          Duration Analysis
        </h2>
        <div className="p-6 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 text-xs font-semibold border border-purple-500/20">
              Sweet Spot: 7:30 - 8:40
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-[#1a1a24] text-gray-400 text-xs font-semibold">
              Avg Duration: {formatDuration(durationAnalysis.avgDuration)}
            </span>
          </div>
          <div className="space-y-2">
            {sortedByDuration.map((v) => {
              const inSweet = v.duration >= 450 && v.duration <= 520;
              return (
                <div
                  key={v.youtubeId}
                  className={`flex items-center gap-4 p-3 rounded-lg ${
                    inSweet ? "bg-purple-500/5 border border-purple-500/10" : "bg-[#0d0d12]"
                  }`}
                >
                  <span className="text-xs text-gray-500 w-12 text-right shrink-0 font-mono">
                    {formatDuration(v.duration)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getTierColor(v.views)}`}>
                    {getTierLabel(v.views)}
                  </span>
                  <span className="text-sm text-gray-300 truncate flex-1">{v.title}</span>
                  <span className="text-xs text-gray-500 shrink-0">{formatNumber(v.views)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Top Patterns */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Title Patterns Ranked
        </h2>
        <div className="space-y-3">
          {patternStats.map((p, i) => (
            <div
              key={p.name}
              className="flex items-center gap-4 p-5 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden"
            >
              <span className="text-2xl font-bold text-gray-600 w-8 text-center shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-200 font-medium">{p.name}</span>
                <div className="text-xs text-gray-500 mt-1">{p.count} videos</div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-lg font-bold text-white">{formatNumber(p.avgViews)}</span>
                <div className="text-xs text-gray-500">avg views</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Insights */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          Insights
        </h2>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-5 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
