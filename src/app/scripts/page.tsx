"use client";
import { useState, useEffect } from "react";
import { FileText, Download, Eye, Search, Loader2, Mic } from "lucide-react";
import Link from "next/link";

interface PitchWithScript {
  id: number;
  title: string;
  hookLine: string;
  angle: string;
  format: string;
  pitchType: string;
  status: string;
  performanceScore: number;
  generatedScript: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

function estimateMinutes(wordCount: number): string {
  const minutes = Math.round(wordCount / 150);
  return `${minutes} min`;
}

function slugify(text: string): string {
  return text.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 60);
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<PitchWithScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState<PitchWithScript | null>(null);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  useEffect(() => {
    async function fetchScripts() {
      try {
        const res = await fetch("/api/pitches?hasScript=true");
        const data = await res.json();
        const withScripts = (data.pitches || []).filter(
          (p: PitchWithScript) => p.generatedScript && p.generatedScript.length > 0
        );
        setScripts(withScripts);
      } catch {
        // Silent failure
      } finally {
        setLoading(false);
      }
    }
    fetchScripts();
  }, []);

  function downloadScript(pitch: PitchWithScript) {
    if (!pitch.generatedScript) return;
    const blob = new Blob([pitch.generatedScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(pitch.title)}_script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = scripts.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.hookLine.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Scripts Library</h1>
        <p className="text-gray-400">All generated scripts across pitches and videos.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search scripts by title or hook..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#121217] border border-[#22222b] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "accepted", "pending", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-[#121217] text-gray-400 border border-[#22222b] hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Total Scripts</span>
          </div>
          <span className="text-2xl font-bold text-white">{scripts.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">Accepted</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">
            {scripts.filter((s) => s.status === "accepted").length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-[#121217] border border-[#22222b]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">Total Words</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {scripts.reduce((sum, s) => sum + (s.generatedScript ? countWords(s.generatedScript) : 0), 0).toLocaleString()}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <span className="ml-3 text-gray-400">Loading scripts...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-[#121217] border border-[#22222b] text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">
            {scripts.length === 0 ? "No scripts generated yet." : "No scripts match your filters."}
          </p>
          {scripts.length === 0 && (
            <Link href="/pitches" className="inline-block mt-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors">
              Go to Pitches →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pitch) => {
            const wordCount = pitch.generatedScript ? countWords(pitch.generatedScript) : 0;
            return (
              <div
                key={pitch.id}
                className="p-5 rounded-xl bg-[#121217] border border-[#22222b] hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[pitch.status]}`}>
                        {pitch.status}
                      </span>
                      <span className="text-xs text-gray-500">{wordCount.toLocaleString()} words · {estimateMinutes(wordCount)}</span>
                      {pitch.aiModel && (
                        <span className="text-[10px] text-gray-600 font-mono">{pitch.aiModel}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white text-base leading-snug mb-2">{pitch.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{pitch.hookLine}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setViewingScript(pitch); setViewMode("formatted"); }}
                      className="p-2 rounded-lg bg-[#22222b] hover:bg-purple-500/10 hover:text-purple-400 text-gray-400 transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadScript(pitch)}
                      className="p-2 rounded-lg bg-[#22222b] hover:bg-purple-500/10 hover:text-purple-400 text-gray-400 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/pitches`}
                      className="p-2 rounded-lg bg-[#22222b] hover:bg-purple-500/10 hover:text-purple-400 text-gray-400 transition-colors"
                      title="Generate Voice"
                    >
                      <Mic className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  Generated {new Date(pitch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Script Viewer Modal */}
      {viewingScript && viewingScript.generatedScript && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewingScript(null)}
        >
          <div
            className="bg-[#121217] border border-[#22222b] rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#22222b]">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white truncate">{viewingScript.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {viewingScript.generatedScript ? countWords(viewingScript.generatedScript) : 0} words · {estimateMinutes(viewingScript.generatedScript ? countWords(viewingScript.generatedScript) : 0)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setViewMode("formatted")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === "formatted" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setViewMode("raw")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === "raw" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Raw
                </button>
                <button
                  onClick={() => downloadScript(viewingScript)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={() => setViewingScript(null)}
                  className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {viewMode === "formatted" ? (
                <div className="prose prose-invert max-w-none">
                  {viewingScript.generatedScript.split("\n").map((line, i) => {
                    if (line.startsWith("[") && line.endsWith("]")) {
                      return <h3 key={i} className="text-purple-300 font-bold text-lg mt-6 mb-3 first:mt-0">{line}</h3>;
                    }
                    if (line.trim() === "") return <div key={i} className="h-3" />;
                    return <p key={i} className="text-gray-300 leading-relaxed mb-3 text-[15px]">{line}</p>;
                  })}
                </div>
              ) : (
                <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                  {viewingScript.generatedScript}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
