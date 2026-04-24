"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mic, Loader2, Plus, Search } from "lucide-react";

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
  createdAt: string;
  audios: AudioRecord[];
}

const statusColors: Record<string, string> = {
  idea: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  scripted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  filmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function countWords(text: string) {
  return text.trim().split(/\s+/).length;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ScriptsPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "scripted" | "unscripted">("all");

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = videos.filter((v) => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "scripted" && v.script) ||
      (filter === "unscripted" && !v.script);
    return matchSearch && matchFilter;
  });

  const scripted = videos.filter((v) => v.script).length;
  const withVO = videos.filter((v) => v.audios.length > 0).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scripts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {scripted} scripted · {withVO} with VO
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Video
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scripts..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#121217] border border-[#22222b] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[#121217] border border-[#22222b]">
          {(["all", "scripted", "unscripted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          {search ? "No scripts match your search." : "No videos yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => router.push(`/scripts/${v.id}`)}
              className="w-full text-left p-4 rounded-xl bg-[#121217] border border-[#22222b] hover:border-purple-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[v.status] || statusColors.idea}`}>
                      {v.status}
                    </span>
                    {v.script && (
                      <span className="text-xs text-gray-500">
                        {countWords(v.script).toLocaleString()} words · ~{Math.round(countWords(v.script) / 140)} min
                      </span>
                    )}
                    {v.audios.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Mic className="w-3 h-3" /> {v.audios.length} take{v.audios.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {!v.script && (
                      <span className="text-[10px] text-gray-600 italic">no script</span>
                    )}
                  </div>
                  <p className="font-medium text-white text-sm leading-snug truncate">{v.title}</p>
                  {v.hookLine && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{v.hookLine}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">{formatDate(v.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
