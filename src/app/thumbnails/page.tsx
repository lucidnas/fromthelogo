"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  Wand2,
  Trash2,
  Search,
  Download,
} from "lucide-react";

interface GeneratedThumbnail {
  id: number;
  filename: string;
  url: string;
  slug: string;
  title: string;
  format: string;
  model: "openai" | "gemini";
  version: number;
  createdAt: string;
}

interface ThumbnailGroup {
  slug: string;
  title: string;
  formats: {
    a: GeneratedThumbnail[];
    b: GeneratedThumbnail[];
    c: GeneratedThumbnail[];
  };
}

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

interface StatsData {
  videos: VideoRecord[];
  totalVideos: number;
  totalViews: number;
}

interface AnalysisRecord {
  id: number;
  analysis: string;
  videoIds: string[];
  createdAt: string;
}

const formatLabels: Record<string, string> = {
  "the-day": "The Day",
  increasingly: "Increasingly",
  backfired: "Backfired",
  highlight: "Highlight",
  other: "Other",
};

const formatColors: Record<string, string> = {
  "the-day": "#8B5CF6",
  increasingly: "#10B981",
  backfired: "#F59E0B",
  highlight: "#3B82F6",
  other: "#6B7280",
};

function getTierColor(views: number) {
  if (views >= 1_000_000)
    return "text-yellow-300 bg-yellow-500/20 border-yellow-500/40";
  if (views >= 500_000)
    return "text-purple-300 bg-purple-500/20 border-purple-500/40";
  if (views >= 200_000)
    return "text-blue-300 bg-blue-500/20 border-blue-500/40";
  if (views >= 100_000)
    return "text-emerald-300 bg-emerald-500/20 border-emerald-500/40";
  return "text-gray-300 bg-gray-700/40 border-gray-500/30";
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

function thumbUrl(youtubeId: string, quality: "maxres" | "hq" = "maxres") {
  return `https://img.youtube.com/vi/${youtubeId}/${
    quality === "maxres" ? "maxresdefault" : "hqdefault"
  }.jpg`;
}

function ThumbCard({
  video,
  onClick,
  size = "md",
}: {
  video: VideoRecord;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const [src, setSrc] = useState(thumbUrl(video.youtubeId, "maxres"));
  const widthClass =
    size === "sm" ? "w-64" : size === "lg" ? "w-full" : "w-full";

  return (
    <button
      onClick={onClick}
      className={`group relative ${widthClass} shrink-0 rounded-lg overflow-hidden border border-[#22222b] bg-[#121217] transition-all duration-300 hover:border-purple-500/60 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10 text-left`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#0a0a10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={video.title}
          loading="lazy"
          onError={() => setSrc(thumbUrl(video.youtubeId, "hq"))}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />

        {/* Views badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[11px] font-bold border backdrop-blur-sm ${getTierColor(
            video.views
          )}`}
        >
          {formatNumber(video.views)}
        </div>

        {/* Format badge */}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/10"
          style={{
            backgroundColor:
              (formatColors[video.format] || "#6B7280") + "30",
            color: formatColors[video.format] || "#D1D5DB",
          }}
        >
          {formatLabels[video.format] || video.format}
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-gray-200 backdrop-blur-sm">
          {formatDuration(video.duration)}
        </div>

        {/* Title overlay on hover */}
        <div className="absolute inset-x-0 bottom-0 pt-10 pb-3 px-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-xs text-white font-medium line-clamp-2 leading-snug">
            {video.title}
          </p>
        </div>
      </div>
    </button>
  );
}

function VideoModal({
  video,
  onClose,
}: {
  video: VideoRecord;
  onClose: () => void;
}) {
  const [src, setSrc] = useState(thumbUrl(video.youtubeId, "maxres"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#121217] border border-[#22222b] rounded-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-gray-300 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="relative aspect-video w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={video.title}
            onError={() => setSrc(thumbUrl(video.youtubeId, "hq"))}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-white leading-snug mb-3">
            {video.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getTierColor(
                video.views
              )}`}
            >
              {formatNumber(video.views)} views
            </span>
            <span
              className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
              style={{
                backgroundColor:
                  (formatColors[video.format] || "#6B7280") + "20",
                color: formatColors[video.format] || "#D1D5DB",
              }}
            >
              {formatLabels[video.format] || video.format}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#1a1a24] text-xs text-gray-400 font-mono">
              {formatDuration(video.duration)}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#1a1a24] text-xs text-gray-400">
              Published {new Date(video.publishedAt).toLocaleDateString()}
            </span>
          </div>
          {video.tags && video.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {video.tags.slice(0, 10).map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded bg-[#1a1a24] text-[11px] text-gray-400"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          <a
            href={`https://youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            Watch on YouTube <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(md: string) {
  // Minimal markdown rendering: headings, bold, lists, paragraphs.
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedList = false;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = orderedList ? "ol" : "ul";
    elements.push(
      <Tag
        key={`list-${elements.length}`}
        className={`${
          orderedList ? "list-decimal" : "list-disc"
        } ml-6 mb-4 space-y-2 text-gray-300`}
      >
        {listBuffer.map((item, i) => (
          <li
            key={i}
            className="leading-relaxed"
            dangerouslySetInnerHTML={{ __html: inline(item) }}
          />
        ))}
      </Tag>
    );
    listBuffer = [];
  };

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-purple-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#1a1a24] text-purple-300 text-[13px] font-mono">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) {
      flushList();
      elements.push(
        <h3
          key={`h-${elements.length}`}
          className="text-lg font-semibold text-white mt-6 mb-3 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          {line.replace(/^##\s+/, "")}
        </h3>
      );
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushList();
      elements.push(
        <h2
          key={`h1-${elements.length}`}
          className="text-xl font-bold text-white mt-6 mb-3"
        >
          {line.replace(/^#\s+/, "")}
        </h2>
      );
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol) {
      if (!orderedList) flushList();
      orderedList = true;
      listBuffer.push(ol[1]);
      continue;
    }
    if (ul) {
      if (orderedList) flushList();
      orderedList = false;
      listBuffer.push(ul[1]);
      continue;
    }
    if (line.trim() === "") {
      flushList();
      continue;
    }
    flushList();
    elements.push(
      <p
        key={`p-${elements.length}`}
        className="text-gray-300 leading-relaxed mb-3"
        dangerouslySetInnerHTML={{ __html: inline(line) }}
      />
    );
  }
  flushList();
  return elements;
}

export default function ThumbnailsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VideoRecord | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [groups, setGroups] = useState<ThumbnailGroup[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState(true);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [thumbSearch, setThumbSearch] = useState("");

  const fetchGroups = () => {
    fetch("/api/thumbnails/generated")
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {})
      .finally(() => setGeneratedLoading(false));
  };

  useEffect(() => {
    fetch("/api/channel/stats")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/thumbnails/analyze")
      .then((r) => r.json())
      .then((d) => setAnalysis(d.analysis))
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, []);

  useEffect(() => { fetchGroups(); }, []);

  const generate = async (slug: string, title: string, format: string, model: string) => {
    const key = `${slug}-${format}-${model}`;
    setGenerating((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/thumbnails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title, format, model }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      await fetchGroups();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const generateAll = async (slug: string, title: string) => {
    const combos: Array<[string, string]> = [
      ["a", "openai"], ["a", "gemini"],
      ["b", "openai"], ["b", "gemini"],
      ["c", "openai"], ["c", "gemini"],
    ];
    await Promise.all(combos.map(([f, m]) => generate(slug, title, f, m)));
  };

  const deleteThumbnail = async (id: number) => {
    await fetch(`/api/thumbnails/generated/${id}`, { method: "DELETE" });
    setGroups((prev) => prev.map((g) => ({
      ...g,
      formats: {
        a: g.formats.a.filter((t) => t.id !== id),
        b: g.formats.b.filter((t) => t.id !== id),
        c: g.formats.c.filter((t) => t.id !== id),
      },
    })).filter((g) => g.formats.a.length > 0 || g.formats.b.length > 0 || g.formats.c.length > 0));
  };

  const tiers = useMemo(() => {
    if (!data?.videos) return null;
    const vids = data.videos;
    return {
      millionPlus: vids.filter((v) => v.views >= 1_000_000),
      topTier: vids.filter((v) => v.views >= 500_000 && v.views < 1_000_000),
      strong: vids.filter((v) => v.views >= 200_000 && v.views < 500_000),
      solid: vids.filter((v) => v.views >= 100_000 && v.views < 200_000),
      under: vids.filter((v) => v.views < 100_000),
    };
  }, [data]);

  const runAnalysis = async (force: boolean) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/thumbnails/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      setAnalysis(json.analysis);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-10 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!data || !data.videos || data.videos.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-10 text-center text-gray-400">
        No channel data found. Run the seed script or refresh stats first.
      </div>
    );
  }

  const top20 = data.videos.slice(0, 20);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <ImageIcon className="w-7 h-7 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Thumbnail Intelligence</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Visual performance library from {data.totalVideos} From The Logo videos,
          with AI-powered pattern detection.
        </p>
      </div>

      {/* Generated Thumbnails */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Wand2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Generated Thumbnails</h2>
            {groups.length > 0 && <span className="text-xs text-gray-500">{groups.length} video{groups.length !== 1 ? "s" : ""}</span>}
          </div>
          <div className="flex items-center gap-3">
            {groups.length > 1 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  value={thumbSearch}
                  onChange={(e) => setThumbSearch(e.target.value)}
                  placeholder="Filter by title..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-[#121217] border border-[#22222b] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 w-48"
                />
              </div>
            )}
            <span className="text-xs text-gray-500">gpt-image-2 vs Gemini 3.1 · 16:9</span>
          </div>
        </div>
        {generatedLoading ? (
          <div className="flex items-center gap-3 text-gray-400 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            Loading...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2a2a35] bg-[#0d0d12] p-10 text-center text-gray-500 text-sm">
            No generated thumbnails yet. Use the <code className="text-purple-400">/ftl-thumbnail</code> skill to generate your first one.
          </div>
        ) : (
          <div className="space-y-8">
            {groups
              .filter((g) => !thumbSearch || g.title.toLowerCase().includes(thumbSearch.toLowerCase()))
              .map((group) => (
                <GeneratedGroup
                  key={group.slug}
                  group={group}
                  generating={generating}
                  onGenerate={(format, model) => generate(group.slug, group.title, format, model)}
                  onGenerateAll={() => generateAll(group.slug, group.title)}
                  onDelete={deleteThumbnail}
                />
              ))}
          </div>
        )}
      </section>

      {/* Top Performers Gallery */}
      <section className="mb-12">
        <div className="flex items-end justify-between mb-5">
          <h2 className="text-xl font-semibold text-white">Top 20 Performers</h2>
          <span className="text-xs text-gray-500">sorted by views</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {top20.map((v) => (
            <ThumbCard
              key={v.youtubeId}
              video={v}
              onClick={() => setSelected(v)}
            />
          ))}
        </div>
      </section>

      {/* Tiered rows */}
      {tiers && (
        <section className="mb-12 space-y-10">
          {tiers.millionPlus.length > 0 && (
            <TierRow
              label="Million+ Views"
              emoji="🏆"
              accent="from-yellow-500/20 to-amber-500/5 border-yellow-500/30"
              videos={tiers.millionPlus}
              onSelect={setSelected}
            />
          )}
          {tiers.topTier.length > 0 && (
            <TierRow
              label="Top Performers"
              emoji="🎯"
              accent="from-purple-500/20 to-violet-500/5 border-purple-500/30"
              videos={tiers.topTier}
              onSelect={setSelected}
            />
          )}
          {tiers.strong.length > 0 && (
            <TierRow
              label="Strong"
              emoji="📈"
              accent="from-blue-500/20 to-sky-500/5 border-blue-500/30"
              videos={tiers.strong}
              onSelect={setSelected}
            />
          )}
          {tiers.solid.length > 0 && (
            <TierRow
              label="Solid"
              emoji="✓"
              accent="from-emerald-500/20 to-teal-500/5 border-emerald-500/30"
              videos={tiers.solid}
              onSelect={setSelected}
            />
          )}
          {tiers.under.length > 0 && (
            <TierRow
              label="Underperformed"
              emoji=""
              accent="from-gray-600/10 to-gray-700/5 border-gray-700/40"
              videos={tiers.under}
              onSelect={setSelected}
            />
          )}
        </section>
      )}

      {/* AI Analysis */}
      <section className="mb-12">
        <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500">
          <div className="rounded-2xl bg-[#0f0f15] p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    AI Thumbnail Pattern Analysis
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Claude Opus 4.7 examines your top 10 thumbnails and extracts
                    replicable patterns.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {analysis && (
                  <span className="text-xs text-gray-500">
                    Updated{" "}
                    {new Date(analysis.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
                <button
                  onClick={() => runAnalysis(true)}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      {analysis ? "Refresh" : "Generate"}
                    </>
                  )}
                </button>
              </div>
            </div>

            {analysisLoading ? (
              <div className="flex items-center gap-3 text-gray-400 py-10">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                Loading analysis...
              </div>
            ) : analyzing ? (
              <div className="flex items-center gap-3 text-gray-400 py-10">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                Sending top 10 thumbnails to Claude Opus 4.7 for vision analysis...
              </div>
            ) : analysisError ? (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {analysisError}
              </div>
            ) : analysis ? (
              <div className="prose prose-invert max-w-none">
                {renderMarkdown(analysis.analysis)}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-400 text-sm mb-4">
                  No analysis yet. Click Generate to have Claude Opus 4.7
                  examine your top 10 thumbnails.
                </p>
                <button
                  onClick={() => runAnalysis(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {selected && (
        <VideoModal video={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TierRow({
  label,
  emoji,
  accent,
  videos,
  onSelect,
}: {
  label: string;
  emoji: string;
  accent: string;
  videos: VideoRecord[];
  onSelect: (v: VideoRecord) => void;
}) {
  return (
    <div>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-lg bg-gradient-to-r ${accent} border`}
      >
        {emoji && <span className="text-sm">{emoji}</span>}
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-xs text-gray-400">
          {videos.length} video{videos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6 snap-x snap-mandatory scrollbar-thin">
        {videos.map((v) => (
          <div key={v.youtubeId} className="snap-start shrink-0 w-72">
            <ThumbCard video={v} size="sm" onClick={() => onSelect(v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  a: "A · Pure Close-Up",
  b: "B · Face Through Type",
  c: "C · Split Screen",
};

function ModelCard({
  thumb,
  model,
  history,
  isGenerating,
  onRegenerate,
  onDelete,
}: {
  thumb: GeneratedThumbnail | undefined;
  model: "openai" | "gemini";
  history: GeneratedThumbnail[];
  isGenerating: boolean;
  onRegenerate: () => void;
  onDelete: (id: number) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState<GeneratedThumbnail | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this thumbnail?")) return;
    setDeleting(id);
    await onDelete(id);
    if (preview?.id === id) setPreview(null);
    setDeleting(null);
  }

  function download(t: GeneratedThumbnail, e: React.MouseEvent) {
    e.stopPropagation();
    const ext = t.model === "gemini" ? "jpg" : "png";
    const filename = `${t.slug}-${t.format}-${t.model}-v${t.version}.${ext}`;
    if (t.url.startsWith("data:")) {
      const [header, b64] = t.url.split(",");
      const mime = header.split(":")[1].split(";")[0];
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } else {
      const a = document.createElement("a");
      a.href = t.url; a.download = filename; a.click();
    }
  }

  const label = model === "openai" ? "GPT-Image-2" : "Gemini 3.1";
  const badgeCls =
    model === "openai"
      ? "bg-green-500/20 border-green-500/40 text-green-300"
      : "bg-blue-500/20 border-blue-500/40 text-blue-300";

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeCls}`}>
            {label}
          </span>
          {thumb && (
            <span className="text-[10px] text-gray-500">v{thumb.version}</span>
          )}
        </div>

        {/* Thumbnail or empty */}
        <div
          className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#0a0a10] border border-[#22222b] cursor-pointer group"
          onClick={() => thumb && setPreview(thumb)}
        >
          {thumb ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.url}
                alt={thumb.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/60 px-3 py-1 rounded-full">
                  View
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
              Not generated
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a35] text-gray-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                {thumb ? "Regenerate" : "Generate"}
              </>
            )}
          </button>
          {history.length > 1 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a35] text-gray-400 text-xs transition-colors"
            >
              {history.length - 1} older
            </button>
          )}
          {thumb && (
            <>
              <button
                onClick={(e) => download(thumb, e)}
                className="p-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a35] text-gray-600 hover:text-gray-300 transition-colors"
                title="Download"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => handleDelete(thumb.id, e)}
                disabled={deleting === thumb.id}
                className="p-1.5 rounded-lg bg-[#1a1a24] hover:bg-red-500/10 border border-[#2a2a35] hover:border-red-500/30 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {deleting === thumb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>

        {/* History */}
        {showHistory && history.length > 1 && (
          <div className="space-y-2 pt-1">
            {history.slice(1).map((h) => (
              <div
                key={h.id}
                className="relative aspect-video w-full rounded overflow-hidden bg-[#0a0a10] border border-[#1a1a24] cursor-pointer opacity-60 hover:opacity-100 transition-opacity group"
                onClick={() => setPreview(h)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.url} alt={`v${h.version}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-gray-300 font-mono">
                  v{h.version}
                </span>
                <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => download(h, e)}
                    className="p-1 rounded bg-black/70 text-gray-400 hover:text-white"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(h.id, e)}
                    disabled={deleting === h.id}
                    className="p-1 rounded bg-black/70 text-gray-400 hover:text-red-400"
                    title="Delete"
                  >
                    {deleting === h.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl bg-[#121217] border border-[#22222b] rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-gray-300 hover:text-white flex items-center justify-center border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="aspect-video w-full bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.title} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded text-xs font-bold border ${badgeCls}`}>{label}</span>
              <span className="px-2.5 py-1 rounded bg-[#1a1a24] text-xs text-gray-400">
                Format {preview.format.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1a1a24] text-xs text-gray-400 font-mono">
                v{preview.version}
              </span>
              <span className="px-2.5 py-1 rounded bg-[#1a1a24] text-xs text-gray-400">
                {new Date(preview.createdAt).toLocaleDateString()}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={(e) => download(preview, e)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1a24] border border-[#2a2a35] text-gray-300 hover:text-white text-xs transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
                <button
                  onClick={(e) => handleDelete(preview.id, e)}
                  disabled={deleting === preview.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs transition-colors disabled:opacity-50"
                >
                  {deleting === preview.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GeneratedGroup({
  group,
  generating,
  onGenerate,
  onGenerateAll,
  onDelete,
}: {
  group: ThumbnailGroup;
  generating: Set<string>;
  onGenerate: (format: string, model: string) => void;
  onGenerateAll: () => void;
  onDelete: (id: number) => void;
}) {
  const [activeFormat, setActiveFormat] = useState<"a" | "b" | "c">("a");

  const fmtData = group.formats[activeFormat];
  const openaiHistory = fmtData.filter((t) => t.model === "openai");
  const geminiHistory = fmtData.filter((t) => t.model === "gemini");

  const isAnyGenerating = ["a", "b", "c"].some((f) =>
    ["openai", "gemini"].some((m) => generating.has(`${group.slug}-${f}-${m}`))
  );

  return (
    <div className="rounded-xl border border-[#22222b] bg-[#0d0d12] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1a1a24]">
        <h3 className="text-sm font-semibold text-white leading-snug">{group.title}</h3>
        <button
          onClick={onGenerateAll}
          disabled={isAnyGenerating}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-200 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isAnyGenerating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Wand2 className="w-3 h-3" />
          )}
          Generate All 6
        </button>
      </div>

      {/* Format tabs */}
      <div className="flex border-b border-[#1a1a24]">
        {(["a", "b", "c"] as const).map((f) => {
          const count = group.formats[f].length;
          return (
            <button
              key={f}
              onClick={() => setActiveFormat(f)}
              className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-colors relative ${
                activeFormat === f
                  ? "text-purple-300 bg-purple-500/10"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {FORMAT_LABELS[f]}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] text-gray-500">({count})</span>
              )}
              {activeFormat === f && (
                <span className="absolute bottom-0 inset-x-0 h-px bg-purple-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Model side-by-side */}
      <div className="grid grid-cols-2 gap-4 p-5">
        <ModelCard
          thumb={openaiHistory[0]}
          model="openai"
          history={openaiHistory}
          isGenerating={generating.has(`${group.slug}-${activeFormat}-openai`)}
          onRegenerate={() => onGenerate(activeFormat, "openai")}
          onDelete={onDelete}
        />
        <ModelCard
          thumb={geminiHistory[0]}
          model="gemini"
          history={geminiHistory}
          isGenerating={generating.has(`${group.slug}-${activeFormat}-gemini`)}
          onRegenerate={() => onGenerate(activeFormat, "gemini")}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
