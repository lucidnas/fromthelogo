"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { videos, type Video } from "@/lib/data";
import { Clock, FileText, Zap, Calendar, Target, TrendingUp, RefreshCw, Eye, Play } from "lucide-react";

const categories = ["all", "game-breakdown", "analysis", "rivalry", "controversy", "highlights", "career-story"];
const statuses = ["all", "idea", "scripted", "filmed", "published"];

const statusColors: Record<string, string> = {
  idea: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const categoryColors: Record<string, string> = {
  "game-breakdown": "bg-red-500/10 text-red-400",
  analysis: "bg-blue-500/10 text-blue-400",
  rivalry: "bg-amber-500/10 text-amber-400",
  controversy: "bg-rose-500/10 text-rose-400",
  highlights: "bg-emerald-500/10 text-emerald-400",
  "career-story": "bg-violet-500/10 text-violet-400",
};

interface CalendarSlotData {
  id: number;
  dayOfWeek: string;
  slotType: string;
  date: string;
  status: string;
  pitch: { title: string; hookLine: string } | null;
}

interface ChannelVideo {
  id: number;
  youtubeId: string;
  title: string;
  views: number;
  duration: number;
  format: string;
  publishedAt: string;
  lastChecked: string;
}

const calendarStatusColors: Record<string, string> = {
  open: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  planned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const formatLabels: Record<string, string> = {
  "the-day": "The Day",
  increasingly: "Increasingly",
  backfired: "Backfired",
  highlight: "Highlight",
  other: "Other",
};

const formatBadgeColors: Record<string, string> = {
  "the-day": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  increasingly: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  backfired: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  highlight: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

function getTierColor(views: number) {
  if (views >= 1_000_000) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  if (views >= 500_000) return "text-purple-400 bg-purple-500/10 border-purple-500/30";
  if (views >= 200_000) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (views >= 100_000) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return "text-gray-400 bg-gray-500/10 border-gray-500/30";
}

function formatViews(n: number) {
  return n.toLocaleString();
}

function formatShortViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function daysSince(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [weekSlots, setWeekSlots] = useState<CalendarSlotData[]>([]);
  const [monthlyPublished, setMonthlyPublished] = useState(0);

  // Channel performance state
  const [channelVideos, setChannelVideos] = useState<ChannelVideo[]>([]);
  const [channelTotalViews, setChannelTotalViews] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [channelLoading, setChannelLoading] = useState(true);

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const res = await fetch(
          `/api/calendar?startDate=${monday.toISOString()}&endDate=${sunday.toISOString()}`
        );
        const data = await res.json();
        setWeekSlots(data.slots || []);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthRes = await fetch(
          `/api/calendar?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
        );
        const monthData = await monthRes.json();
        setMonthlyPublished(
          (monthData.slots || []).filter((s: CalendarSlotData) => s.status === "published").length
        );
      } catch {
        // Calendar data not critical for dashboard
      }
    }

    async function fetchChannelStats() {
      try {
        const res = await fetch("/api/channel/stats");
        const data = await res.json();
        if (data.videos) {
          // Sort by publishedAt desc for the list
          const sorted = [...data.videos].sort(
            (a: ChannelVideo, b: ChannelVideo) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
          setChannelVideos(sorted);
          setChannelTotalViews(data.totalViews);
          if (sorted.length > 0) {
            setLastRefreshed(sorted[0].lastChecked);
          }
        }
      } catch {
        // Channel data not critical
      } finally {
        setChannelLoading(false);
      }
    }

    fetchCalendar();
    fetchChannelStats();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/channel/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Re-fetch stats
        const statsRes = await fetch("/api/channel/stats");
        const statsData = await statsRes.json();
        if (statsData.videos) {
          const sorted = [...statsData.videos].sort(
            (a: ChannelVideo, b: ChannelVideo) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
          setChannelVideos(sorted);
          setChannelTotalViews(statsData.totalViews);
          setLastRefreshed(new Date().toISOString());
        }
      }
    } catch {
      // Refresh failed silently
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = videos.filter((v) => {
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    return true;
  });

  const scripted = videos.filter((v) => v.script).length;
  const ideas = videos.filter((v) => !v.script).length;

  const mondaySlot = weekSlots.find((s) => s.dayOfWeek === "monday");
  const thursdaySlot = weekSlots.find((s) => s.dayOfWeek === "thursday");

  const latestVideo = channelVideos.length > 0 ? channelVideos[0] : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Channel Performance Section */}
      {!channelLoading && channelVideos.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Play className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Channel Performance</h2>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-gray-500">
                  Last updated: {formatDate(lastRefreshed)}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh Stats"}
              </button>
            </div>
          </div>

          {/* Channel Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Total Views</span>
              </div>
              <span className="text-2xl font-bold text-white">{formatShortViews(channelTotalViews)}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400">Total Videos</span>
              </div>
              <span className="text-2xl font-bold text-white">{channelVideos.length}</span>
            </div>
            {latestVideo && (
              <>
                <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Latest Video</span>
                  </div>
                  <span className="text-sm font-medium text-white truncate block">{formatShortViews(latestVideo.views)} views</span>
                  <span className="text-xs text-gray-500 truncate block">{latestVideo.title.slice(0, 40)}...</span>
                </div>
                <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Avg Views/Day</span>
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {formatShortViews(Math.round(channelTotalViews / Math.max(daysSince(channelVideos[channelVideos.length - 1].publishedAt), 1)))}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Video List */}
          <div className="rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
            <div className="p-4 border-b border-[#22222b]">
              <h3 className="text-sm font-semibold text-gray-300">All Videos (Most Recent First)</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {channelVideos.map((v) => {
                const days = daysSince(v.publishedAt);
                const viewsPerDay = days > 0 ? Math.round(v.views / days) : v.views;
                return (
                  <a
                    key={v.youtubeId}
                    href={`https://youtube.com/watch?v=${v.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#16161d] transition-colors border-b border-[#1a1a24] last:border-0"
                  >
                    {/* Tier badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${getTierColor(v.views)}`}>
                      {v.views >= 1_000_000 ? "1M+" : v.views >= 500_000 ? "500K+" : v.views >= 200_000 ? "200K+" : v.views >= 100_000 ? "100K+" : "<100K"}
                    </span>
                    {/* Title */}
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{v.title}</span>
                    {/* Format badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${formatBadgeColors[v.format] || formatBadgeColors.other}`}>
                      {formatLabels[v.format] || v.format}
                    </span>
                    {/* Views */}
                    <span className="text-xs text-gray-400 shrink-0 w-24 text-right font-mono">
                      {formatViews(v.views)}
                    </span>
                    {/* Date */}
                    <span className="text-xs text-gray-500 shrink-0 w-20 text-right">
                      {formatDate(v.publishedAt)}
                    </span>
                    {/* Views/day */}
                    <span className="text-xs text-gray-600 shrink-0 w-16 text-right">
                      {formatShortViews(viewsPerDay)}/d
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* This Week Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">This Week</h2>
          </div>
          <Link
            href="/calendar"
            className="text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            View Calendar &rarr;
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Monday Slot */}
          <div className={`p-4 rounded-xl bg-[#121217] border ${mondaySlot ? "border-orange-500/20" : "border-[#22222b]"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                Monday
              </span>
              {mondaySlot && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${calendarStatusColors[mondaySlot.status]}`}>
                  {mondaySlot.status}
                </span>
              )}
            </div>
            {mondaySlot?.pitch ? (
              <p className="text-sm text-white font-medium truncate">{mondaySlot.pitch.title}</p>
            ) : (
              <p className="text-sm text-gray-600">{mondaySlot ? "No pitch assigned" : "No slot"}</p>
            )}
          </div>

          {/* Thursday Slot */}
          <div className={`p-4 rounded-xl bg-[#121217] border ${thursdaySlot ? "border-emerald-500/20" : "border-[#22222b]"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Thursday
              </span>
              {thursdaySlot && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${calendarStatusColors[thursdaySlot.status]}`}>
                  {thursdaySlot.status}
                </span>
              )}
            </div>
            {thursdaySlot?.pitch ? (
              <p className="text-sm text-white font-medium truncate">{thursdaySlot.pitch.title}</p>
            ) : (
              <p className="text-sm text-gray-600">{thursdaySlot ? "No pitch assigned" : "No slot"}</p>
            )}
          </div>

          {/* Monthly Progress */}
          <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                This Month
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{monthlyPublished}</span>
              <span className="text-sm text-gray-500">/ 8 videos</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#22222b] mt-2">
              <div
                className="h-1.5 rounded-full bg-purple-500 transition-all"
                style={{ width: `${Math.min((monthlyPublished / 8) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-400">Total Videos</span>
          </div>
          <span className="text-3xl font-bold text-white">{videos.length}</span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-gray-400">Scripted</span>
          </div>
          <span className="text-3xl font-bold text-white">{scripted}</span>
        </div>
        <div className="p-5 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-gray-400">Ideas</span>
          </div>
          <span className="text-3xl font-bold text-white">{ideas}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${categoryFilter === c ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-[#121217] text-gray-400 border border-[#22222b] hover:text-white"}`}>
              {c === "all" ? "All Categories" : c.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-[#121217] text-gray-400 border border-[#22222b] hover:text-white"}`}>
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-500">No videos match your filters.</div>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/video/${video.id}`}
      className="group block p-6 rounded-xl bg-[#121217] border border-[#22222b] hover:border-purple-500/30 hover:bg-[#16161d] transition-all duration-300">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusColors[video.status]}`}>
          {video.status}
        </span>
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-medium capitalize ${categoryColors[video.category] || "bg-gray-500/10 text-gray-400"}`}>
          {video.category.replace("-", " ")}
        </span>
      </div>
      <h3 className="font-semibold text-white text-lg leading-snug mb-3 group-hover:text-purple-300 transition-colors">
        {video.title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
        {video.hookLine}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-600 text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>{video.estimatedLength}</span>
        </div>
        {video.script && (
          <span className="text-purple-400 text-xs font-medium">Script ready &rarr;</span>
        )}
      </div>
    </Link>
  );
}
