"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, Zap, Play, Plus, Mic, Loader2, RefreshCw, Eye, TrendingUp, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface AudioRecord {
  id: number;
  voiceId: string;
  voiceName: string;
  audioUrl: string | null;
  createdAt: string;
}

interface Video {
  id: number;
  title: string;
  hookLine: string | null;
  script: string | null;
  status: string;
  category: string;
  estimatedLength: string | null;
  createdAt: string;
  audios: AudioRecord[];
}

interface Voice {
  id: string;
  name: string;
  category: string;
  previewUrl: string | null;
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

// ── Constants ───────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  idea: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const STATUS_FLOW = ["idea", "scripted", "filmed", "published"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function countWords(text: string) {
  return text.trim().split(/\s+/).length;
}

function slugify(text: string) {
  return text.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 60);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getTierColor(views: number) {
  if (views >= 1_000_000) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  if (views >= 500_000) return "text-purple-400 bg-purple-500/10 border-purple-500/30";
  if (views >= 200_000) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (views >= 100_000) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  return "text-gray-400 bg-gray-500/10 border-gray-500/30";
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  // Channel stats
  const [channelVideos, setChannelVideos] = useState<ChannelVideo[]>([]);
  const [channelTotalViews, setChannelTotalViews] = useState(0);
  const [channelLoading, setChannelLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
    fetchChannelStats();
  }, []);

  async function fetchVideos() {
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      setVideos(data.videos || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchChannelStats() {
    try {
      const res = await fetch("/api/channel/stats");
      const data = await res.json();
      if (data.videos) {
        const sorted = [...data.videos].sort(
          (a: ChannelVideo, b: ChannelVideo) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setChannelVideos(sorted);
        setChannelTotalViews(data.totalViews);
        if (sorted.length > 0) setLastRefreshed(sorted[0].lastChecked);
      }
    } catch {
      // silent
    } finally {
      setChannelLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/channel/refresh", { method: "POST" });
      await fetchChannelStats();
      setLastRefreshed(new Date().toISOString());
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  function onVideoCreated(v: Video) {
    setShowNewModal(false);
    router.push(`/scripts/${v.id}`);
  }

  const scripted = videos.filter((v) => v.script).length;
  const ideas = videos.filter((v) => !v.script).length;
  const latestChannel = channelVideos[0] ?? null;

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">

      {/* ── Channel Stats ─────────────────────────────────────────── */}
      {!channelLoading && channelVideos.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Channel Performance</h2>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-gray-500">Updated {formatDate(lastRefreshed)}</span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
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
                <span className="text-xs text-gray-400">Published</span>
              </div>
              <span className="text-2xl font-bold text-white">{channelVideos.length}</span>
            </div>
            {latestChannel && (
              <>
                <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Latest</span>
                  </div>
                  <span className="text-sm font-medium text-white">{formatShortViews(latestChannel.views)} views</span>
                  <span className="text-xs text-gray-500 block truncate">{latestChannel.title.slice(0, 38)}…</span>
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

          <div className="rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
            <div className="p-4 border-b border-[#22222b]">
              <h3 className="text-sm font-semibold text-gray-300">Published Videos</h3>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {channelVideos.map((v) => {
                const days = daysSince(v.publishedAt);
                const vpd = days > 0 ? Math.round(v.views / days) : v.views;
                return (
                  <a
                    key={v.youtubeId}
                    href={`https://youtube.com/watch?v=${v.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#16161d] transition-colors border-b border-[#1a1a24] last:border-0"
                  >
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${getTierColor(v.views)}`}>
                      {v.views >= 1_000_000 ? "1M+" : v.views >= 500_000 ? "500K+" : v.views >= 200_000 ? "200K+" : v.views >= 100_000 ? "100K+" : "<100K"}
                    </span>
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{v.title}</span>
                    <span className="text-xs text-gray-400 shrink-0 font-mono">{v.views.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 shrink-0 w-20 text-right">{formatDate(v.publishedAt)}</span>
                    <span className="text-xs text-gray-600 shrink-0 w-14 text-right">{formatShortViews(vpd)}/d</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Production Hub ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Production Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Scripts, VO, and video pipeline</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Video
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <span className="text-2xl font-bold text-white">{videos.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Scripted</span>
          </div>
          <span className="text-2xl font-bold text-white">{scripted}</span>
        </div>
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400">Ideas</span>
          </div>
          <span className="text-2xl font-bold text-white">{ideas}</span>
        </div>
      </div>

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
        </div>
      ) : videos.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#121217] border border-[#22222b] text-center">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No videos yet. Add your first one.</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Video
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div
              key={v.id}
              onClick={() => router.push(`/scripts/${v.id}`)}
              className="p-5 rounded-xl bg-[#121217] border border-[#22222b] hover:border-purple-500/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[v.status] || statusColors.idea}`}>
                      {v.status}
                    </span>
                    {v.script && (
                      <span className="text-xs text-gray-500">{countWords(v.script).toLocaleString()} words</span>
                    )}
                    {v.audios.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Mic className="w-3 h-3" /> VO ready
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white text-base leading-snug">{v.title}</h3>
                  {v.hookLine && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-1">{v.hookLine}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">{formatDate(v.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {showNewModal && (
        <NewVideoModal
          onClose={() => setShowNewModal(false)}
          onCreated={onVideoCreated}
        />
      )}
    </div>
  );
}

// ── New Video Modal ──────────────────────────────────────────────────────────

function NewVideoModal({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Video) => void }) {
  const [title, setTitle] = useState("");
  const [hookLine, setHookLine] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), hookLine: hookLine.trim() || null }),
      });
      const data = await res.json();
      onCreated(data.video);
    } catch {
      alert("Failed to create video");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#121217] border border-[#22222b] rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New Video</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">Title *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "The Indiana Fever Just Sent The WNBA A Message"'
              className="w-full px-3 py-2.5 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleCreate(); }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">Hook Line</label>
            <input
              value={hookLine}
              onChange={(e) => setHookLine(e.target.value)}
              placeholder="One-line hook / angle..."
              className="w-full px-3 py-2.5 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}


