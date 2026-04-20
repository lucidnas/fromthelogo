"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Target,
  Check,
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  FileText,
  Eye,
  TrendingUp,
  Leaf,
  Filter,
  Trash2,
  Undo2,
  CheckSquare,
  Square,
} from "lucide-react";

type Pitch = {
  id: number;
  title: string;
  format: string;
  pitchType: string;
  angle: string;
  hookLine: string;
  talkingPoints: string[];
  performanceScore: number;
  status: string;
  generatedScript?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  createdAt: string;
  updatedAt: string;
};

type FilterTab = "today" | "accepted" | "all" | "trash";

function getScoreColor(score: number) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-blue-400";
  if (score >= 70) return "text-amber-400";
  return "text-gray-400";
}

function getScoreBg(score: number) {
  if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 80) return "bg-blue-500/10 border-blue-500/20";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/20";
  return "bg-gray-500/10 border-gray-500/20";
}

function PitchTypeBadge({ pitchType }: { pitchType: string }) {
  if (pitchType === "evergreen") {
    return (
      <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Leaf className="w-3 h-3" />
        Evergreen
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
      <TrendingUp className="w-3 h-3" />
      Trending
    </span>
  );
}

function PitchCard({
  pitch,
  onAccept,
  onReject,
  onRevert,
  onDelete,
  onGenerateScript,
  generatingScript,
  showActions,
  isTrash,
  isSelected,
  onToggleSelect,
}: {
  pitch: Pitch;
  onAccept: (pitch: Pitch) => void;
  onReject: (pitch: Pitch) => void;
  onRevert: (pitch: Pitch) => void;
  onDelete: (pitch: Pitch) => void;
  onGenerateScript: (pitch: Pitch) => void;
  generatingScript: number | null;
  showActions: boolean;
  isTrash?: boolean;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const [expandedScript, setExpandedScript] = useState(false);
  const [scriptViewMode, setScriptViewMode] = useState<"formatted" | "raw">("formatted");
  const score = pitch.performanceScore || 0;

  return (
    <div
      className={`p-6 rounded-xl bg-[#121217] border overflow-hidden transition-colors ${
        isSelected ? "border-purple-500/50" : "border-[#22222b]"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Checkbox */}
          <button
            onClick={() => onToggleSelect(pitch.id)}
            className="text-gray-500 hover:text-purple-400 transition-colors shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-purple-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <PitchTypeBadge pitchType={pitch.pitchType} />
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${getScoreBg(score)}`}
          >
            <Target className={`w-3.5 h-3.5 ${getScoreColor(score)}`} />
            <span className={`text-xs font-bold ${getScoreColor(score)}`}>{score}</span>
          </div>
          {pitch.status === "accepted" && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check className="w-3 h-3" /> Accepted
            </span>
          )}
          {isTrash && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <Trash2 className="w-3 h-3" /> Rejected
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-white mb-3 leading-snug">{pitch.title}</h3>

      {/* Angle */}
      <div className="mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Angle</span>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">{pitch.angle}</p>
      </div>

      {/* Hook */}
      <div className="mb-4 p-4 rounded-lg bg-[#0d0d12] border border-[#1a1a24]">
        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
          Hook Line
        </span>
        <p className="text-sm text-gray-200 mt-1 italic leading-relaxed">
          &quot;{pitch.hookLine}&quot;
        </p>
      </div>

      {/* Talking Points */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Key Talking Points
        </span>
        <ul className="mt-2 space-y-2">
          {pitch.talkingPoints.map((tp, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
              <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {tp}
            </li>
          ))}
        </ul>
      </div>

      {/* Generated Script */}
      {pitch.generatedScript && expandedScript && (
        <div className="mb-6 rounded-xl bg-[#0d0d12] border border-purple-500/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a24]">
            <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Generated Script
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScriptViewMode("formatted")}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  scriptViewMode === "formatted"
                    ? "bg-purple-500/20 text-purple-300"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                <Eye className="w-3 h-3 inline mr-1" />
                Formatted
              </button>
              <button
                onClick={() => setScriptViewMode("raw")}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  scriptViewMode === "raw"
                    ? "bg-purple-500/20 text-purple-300"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                <FileText className="w-3 h-3 inline mr-1" />
                Raw
              </button>
              <button
                onClick={() => setExpandedScript(false)}
                className="text-gray-500 hover:text-white text-xs px-2 py-1"
              >
                Collapse
              </button>
            </div>
          </div>
          <div className="p-6 max-h-[500px] overflow-y-auto">
            {scriptViewMode === "formatted" ? (
              <div>
                {pitch.generatedScript.split("\n").map((line, i) => {
                  if (line.startsWith("[") && line.includes("]")) {
                    return (
                      <h3
                        key={i}
                        className="text-purple-300 font-bold text-lg mt-6 mb-2 first:mt-0"
                      >
                        {line}
                      </h3>
                    );
                  }
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return (
                    <p key={i} className="text-gray-300 leading-relaxed mb-1.5 text-sm">
                      {line}
                    </p>
                  );
                })}
              </div>
            ) : (
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                {pitch.generatedScript}
              </pre>
            )}
          </div>
        </div>
      )}

      {pitch.generatedScript && !expandedScript && (
        <button
          onClick={() => setExpandedScript(true)}
          className="mb-6 flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View Generated Script
        </button>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-3 pt-4 border-t border-[#22222b]">
          {isTrash ? (
            <>
              <button
                onClick={() => onRevert(pitch)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/10 text-gray-300 border border-gray-500/20 text-sm font-medium hover:bg-gray-500/20 transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                Restore
              </button>
              <button
                onClick={() => onDelete(pitch)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </button>
            </>
          ) : (
            <>
              {pitch.status === "pending" && (
                <>
                  <button
                    onClick={() => onAccept(pitch)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => onReject(pitch)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {pitch.status === "accepted" && (
                <>
                  <button
                    onClick={() => onRevert(pitch)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/10 text-gray-300 border border-gray-500/20 text-sm font-medium hover:bg-gray-500/20 transition-colors"
                    title="Move back to pending"
                  >
                    <Undo2 className="w-4 h-4" />
                    Unaccept
                  </button>
                  <button
                    onClick={() => onDelete(pitch)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    title="Permanently delete this pitch"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => onGenerateScript(pitch)}
                disabled={generatingScript === pitch.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors ml-auto disabled:opacity-50"
              >
                {generatingScript === pitch.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generatingScript === pitch.id
                  ? "Generating..."
                  : pitch.generatedScript
                    ? "Regenerate Script"
                    : "Generate Script"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PitchesPage() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingScript, setGeneratingScript] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [researchCount, setResearchCount] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("today");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchPitches = useCallback(async () => {
    try {
      const res = await fetch("/api/pitches");
      if (res.ok) {
        const data = await res.json();
        setPitches(data.pitches || []);
      }
    } catch {
      console.error("Failed to fetch pitches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPitches();
    fetch("/api/research")
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setResearchCount((d.results || []).length))
      .catch(() => {});
  }, [fetchPitches]);

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: number[]) {
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  }

  async function handleAccept(pitch: Pitch) {
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      if (res.ok) {
        setPitches((prev) =>
          prev.map((p) => (p.id === pitch.id ? { ...p, status: "accepted" } : p))
        );
      }
    } catch {
      alert("Failed to accept pitch");
    }
  }

  async function handleReject(pitch: Pitch) {
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        setPitches((prev) =>
          prev.map((p) => (p.id === pitch.id ? { ...p, status: "rejected" } : p))
        );
      }
    } catch {
      alert("Failed to reject pitch");
    }
  }

  async function handleRevert(pitch: Pitch) {
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (res.ok) {
        setPitches((prev) =>
          prev.map((p) => (p.id === pitch.id ? { ...p, status: "pending" } : p))
        );
      }
    } catch {
      alert("Failed to restore pitch");
    }
  }

  async function handleDelete(pitch: Pitch) {
    if (!confirm(`Delete "${pitch.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, { method: "DELETE" });
      if (res.ok) {
        setPitches((prev) => prev.filter((p) => p.id !== pitch.id));
      } else {
        alert("Failed to delete pitch");
      }
    } catch {
      alert("Failed to delete pitch");
    }
  }

  async function handleBulkAction(action: "accept" | "reject" | "restore" | "delete") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === "delete" && !confirm(`Permanently delete ${ids.length} pitch(es)? This cannot be undone.`)) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/pitches/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });

      if (!res.ok) {
        alert("Bulk action failed");
        return;
      }

      if (action === "delete") {
        setPitches((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      } else {
        const statusMap = { accept: "accepted", reject: "rejected", restore: "pending" } as const;
        const newStatus = statusMap[action];
        setPitches((prev) =>
          prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: newStatus } : p))
        );
      }

      setSelectedIds(new Set());
    } catch {
      alert("Bulk action failed");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleGenerateScript(pitch: Pitch) {
    setGeneratingScript(pitch.id);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pitch.title,
          hookLine: pitch.hookLine,
          format: pitch.format,
          angle: pitch.angle,
          talkingPoints: pitch.talkingPoints,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate script");
        return;
      }

      const data = await res.json();
      const script = data.script;

      await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedScript: script }),
      });

      setPitches((prev) =>
        prev.map((p) => (p.id === pitch.id ? { ...p, generatedScript: script } : p))
      );
    } catch {
      alert("Failed to generate script. Check that an AI API key is configured.");
    } finally {
      setGeneratingScript(null);
    }
  }

  async function handleRefreshPitches(useResearch = false) {
    setRefreshing(true);
    try {
      let researchUrls: string[] = [];
      if (useResearch) {
        const r = await fetch("/api/research");
        if (r.ok) {
          const rd = await r.json();
          researchUrls = (rd.results || []).map((x: { url: string }) => x.url);
        }
      }

      const res = await fetch("/api/generate-pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useResearch ? { researchUrls } : {}),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate pitches");
        return;
      }

      const data = await res.json();
      if (data.pitches && data.pitches.length > 0) {
        setPitches((prev) => [...data.pitches, ...prev]);
      }
    } catch {
      alert("Failed to refresh pitches. Check that an AI API key is configured.");
    } finally {
      setRefreshing(false);
    }
  }

  // Filter logic
  const today = new Date().toISOString().split("T")[0];

  const todayPitches = pitches.filter((p) => {
    const pitchDate = p.createdAt.split("T")[0];
    return pitchDate === today && p.status !== "rejected";
  });

  const acceptedPitches = pitches.filter((p) => p.status === "accepted");
  const allPitches = pitches.filter((p) => p.status !== "rejected");
  const trashPitches = pitches.filter((p) => p.status === "rejected");

  const displayPitches =
    activeTab === "today"
      ? todayPitches
      : activeTab === "accepted"
        ? acceptedPitches
        : activeTab === "trash"
          ? trashPitches
          : allPitches;

  const trendingPitches = displayPitches.filter((p) => p.pitchType === "trending");
  const evergreenPitches = displayPitches.filter((p) => p.pitchType === "evergreen");
  const untaggedPitches = displayPitches.filter(
    (p) => p.pitchType !== "trending" && p.pitchType !== "evergreen"
  );

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "today", label: "Today's Pitches", count: todayPitches.length },
    { key: "accepted", label: "Accepted", count: acceptedPitches.length },
    { key: "all", label: "All", count: allPitches.length },
    { key: "trash", label: "Trash", count: trashPitches.length },
  ];

  const isTrash = activeTab === "trash";
  const allDisplayIds = displayPitches.map((p) => p.id);
  const allSelected = allDisplayIds.length > 0 && allDisplayIds.every((id) => selectedIds.has(id));

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Daily Pitches</h1>
        </div>
        <p className="text-gray-400 text-sm">
          AI-generated video ideas — 3 trending news + 2 evergreen stories daily
        </p>
      </div>

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121217] border border-[#22222b]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? tab.key === "trash"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.key === "today" && <Filter className="w-3.5 h-3.5" />}
              {tab.key === "accepted" && <Check className="w-3.5 h-3.5" />}
              {tab.key === "trash" && <Trash2 className="w-3.5 h-3.5" />}
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md ${
                  activeTab === tab.key
                    ? tab.key === "trash"
                      ? "bg-red-500/30 text-red-200"
                      : "bg-purple-500/30 text-purple-200"
                    : "bg-[#1a1a24] text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        {!isTrash && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRefreshPitches(false)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {refreshing ? "Generating..." : "Refresh with AI"}
            </button>
            {researchCount > 0 && (
              <button
                onClick={() => handleRefreshPitches(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Use researched summaries (Gemini) as the primary material"
              >
                <Sparkles className="w-4 h-4" />
                From research ({researchCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {displayPitches.length > 0 && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-[#121217] border border-[#22222b]">
          <button
            onClick={() => toggleSelectAll(allDisplayIds)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-purple-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
              <div className="w-px h-4 bg-[#22222b]" />
              {isTrash ? (
                <>
                  <button
                    onClick={() => handleBulkAction("restore")}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-300 border border-gray-500/20 text-xs font-medium hover:bg-gray-500/20 transition-colors disabled:opacity-50"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Restore Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction("delete")}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleBulkAction("accept")}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction("reject")}
                    disabled={bulkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject Selected
                  </button>
                </>
              )}
              {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Full-screen loading overlay when generating pitches */}
      {refreshing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#121217] border border-purple-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-purple-500/20">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">Generating Pitches</h3>
              <p className="mt-2 text-sm text-gray-400 text-center">
                Scanning fresh Caitlin Clark news, analyzing your covered topics, and crafting 10 new narrative pitches...
              </p>
              <div className="mt-4 w-full">
                <div className="h-1 bg-purple-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-violet-500 animate-pulse" style={{ width: "70%" }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">This usually takes 60-120 seconds</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <span className="ml-3 text-gray-400">Loading pitches...</span>
        </div>
      ) : displayPitches.length === 0 ? (
        <div className="p-10 rounded-xl bg-[#121217] border border-[#22222b] text-center">
          <p className="text-gray-500 text-sm mb-4">
            {activeTab === "today"
              ? "No pitches generated today yet."
              : activeTab === "accepted"
                ? "No accepted pitches yet."
                : activeTab === "trash"
                  ? "Trash is empty."
                  : "No pitches found."}
          </p>
          {!isTrash && (
            <button
              onClick={() => handleRefreshPitches(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate 5 Pitches
            </button>
          )}
        </div>
      ) : isTrash ? (
        /* Trash tab — flat list, no type grouping */
        <div className="space-y-6">
          {displayPitches.map((pitch) => (
            <PitchCard
              key={pitch.id}
              pitch={pitch}
              onAccept={handleAccept}
              onReject={handleReject}
              onRevert={handleRevert}
              onDelete={handleDelete}
              onGenerateScript={handleGenerateScript}
              generatingScript={generatingScript}
              showActions={true}
              isTrash={true}
              isSelected={selectedIds.has(pitch.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Trending News Section */}
          {(trendingPitches.length > 0 || untaggedPitches.length > 0) && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                <h2 className="text-xl font-semibold text-white">Trending News</h2>
                <span className="text-xs text-gray-500 ml-2">
                  {trendingPitches.length + untaggedPitches.length} pitches
                </span>
              </div>
              <div className="space-y-6">
                {[...trendingPitches, ...untaggedPitches].map((pitch) => (
                  <PitchCard
                    key={pitch.id}
                    pitch={pitch}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onRevert={handleRevert}
                    onDelete={handleDelete}
                    onGenerateScript={handleGenerateScript}
                    generatingScript={generatingScript}
                    showActions={true}
                    isSelected={selectedIds.has(pitch.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Evergreen Stories Section */}
          {evergreenPitches.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Leaf className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Evergreen Stories</h2>
                <span className="text-xs text-gray-500 ml-2">
                  {evergreenPitches.length} pitches
                </span>
              </div>
              <div className="space-y-6">
                {evergreenPitches.map((pitch) => (
                  <PitchCard
                    key={pitch.id}
                    pitch={pitch}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onRevert={handleRevert}
                    onDelete={handleDelete}
                    onGenerateScript={handleGenerateScript}
                    generatingScript={generatingScript}
                    showActions={true}
                    isSelected={selectedIds.has(pitch.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
