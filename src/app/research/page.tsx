"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, Trash2, CheckCircle, FileText,
  ExternalLink, ChevronDown, ChevronUp, Zap,
} from "lucide-react";

interface StoryResearch {
  id: number;
  title: string;
  summary: string;
  sources: string[];
  score: number;
  status: "new" | "scripted" | "dismissed";
  createdAt: string;
}

const statusConfig = {
  new: { label: "New", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  scripted: { label: "Scripted", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  dismissed: { label: "Dismissed", cls: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-gray-500";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Minimal markdown → React (headings, bold, lists, paragraphs)
function renderMarkdown(md: string) {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h4 key={i} className="text-purple-300 font-semibold text-sm mt-4 mb-1 first:mt-0">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="text-white font-bold text-sm mt-5 mb-2 first:mt-0">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={i} className="text-white font-bold text-base mt-5 mb-2 first:mt-0">{line.slice(2)}</h2>;
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-gray-300 text-sm ml-4 mb-0.5 list-disc">{line.slice(2)}</li>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    return <p key={i} className="text-gray-300 text-sm leading-relaxed mb-1" dangerouslySetInnerHTML={{ __html: bold }} />;
  });
}

function StoryCard({ story, onStatusChange, onDelete }: {
  story: StoryResearch;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const cfg = statusConfig[story.status];
  const isNew = story.status === "new";

  async function writeScript() {
    // Create a new video in the DB pre-filled with title from research
    setActing(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: story.title, status: "idea" }),
      });
      const data = await res.json();
      // Mark story as scripted
      await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scripted" }),
      });
      onStatusChange(story.id, "scripted");
      router.push(`/scripts/${data.video.id}`);
    } catch {
      alert("Failed to create video");
    } finally {
      setActing(false);
    }
  }

  async function dismiss() {
    setActing(true);
    await fetch(`/api/stories/${story.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    onStatusChange(story.id, "dismissed");
    setActing(false);
  }

  async function del() {
    if (!confirm("Delete this story?")) return;
    await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
    onDelete(story.id);
  }

  return (
    <div className={`rounded-xl border bg-[#0d0d12] transition-colors ${story.status === "dismissed" ? "border-[#1a1a20] opacity-50" : "border-[#22222b]"}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Score */}
        <div className="shrink-0 w-10 text-center pt-0.5">
          <span className={`text-lg font-bold tabular-nums ${scoreColor(story.score)}`}>{story.score}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${cfg.cls}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-gray-600">{formatDate(story.createdAt)}</span>
          </div>
          <p className="font-semibold text-white text-sm leading-snug">{story.title}</p>
          {story.sources.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {story.sources.map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] text-gray-500 bg-[#1a1a24] px-2 py-0.5 rounded">
                  {s.startsWith("http") ? <ExternalLink className="w-2.5 h-2.5" /> : null}
                  {s.startsWith("http") ? new URL(s).hostname.replace("www.", "") : s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isNew && (
            <>
              <button
                onClick={writeScript}
                disabled={acting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-xs font-semibold disabled:opacity-50"
              >
                {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Write Script
              </button>
              <button
                onClick={dismiss}
                disabled={acting}
                title="Dismiss"
                className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#22222b] transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={del}
            title="Delete"
            className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#22222b] transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1a1a24] pt-4">
          <div className="prose prose-invert max-w-none">
            {renderMarkdown(story.summary)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResearchPage() {
  const [items, setItems] = useState<StoryResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "scripted" | "dismissed">("new");

  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleStatusChange(id: number, status: string) {
    setItems((prev) => prev.map((s) => s.id === id ? { ...s, status: status as StoryResearch["status"] } : s));
  }

  function handleDelete(id: number) {
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = items.filter((s) => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.summary.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    new: items.filter((s) => s.status === "new").length,
    scripted: items.filter((s) => s.status === "scripted").length,
    dismissed: items.filter((s) => s.status === "dismissed").length,
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Research</h1>
        </div>
        <p className="text-sm text-gray-500">
          Stories pushed from local <code className="text-purple-400 text-xs">/ftl-research</code> runs · {counts.new} new · {counts.scripted} scripted
        </p>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#121217] border border-[#22222b] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[#121217] border border-[#22222b]">
          {(["all", "new", "scripted", "dismissed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"
              }`}
            >
              {f}
              {f !== "all" && counts[f] > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({counts[f]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Empty push instructions */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#2a2a35] bg-[#0d0d12] p-10 text-center">
          <Zap className="w-10 h-10 text-amber-400/40 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-4">No research yet.</p>
          <p className="text-gray-600 text-xs mb-3">Run <code className="text-purple-400">/ftl-research</code> locally, then push with:</p>
          <pre className="text-left inline-block bg-[#121217] border border-[#22222b] rounded-lg px-4 py-3 text-xs text-gray-400 font-mono">{`curl -X POST https://fromthelogo-production.up.railway.app/api/stories \\
  -H "Content-Type: application/json" \\
  -H "x-cron-secret: ftl_cron_959ea34b1facfbeb" \\
  -d '{"title": "...", "summary": "...", "sources": [...], "score": 85}'`}</pre>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : filtered.length === 0 && items.length > 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">No stories match.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
