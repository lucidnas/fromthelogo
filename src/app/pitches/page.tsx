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

type FilterTab = "today" | "accepted" | "all";

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
  onGenerateScript,
  generatingScript,
  showActions,
}: {
  pitch: Pitch;
  onAccept: (pitch: Pitch) => void;
  onReject: (pitch: Pitch) => void;
  onGenerateScript: (pitch: Pitch) => void;
  generatingScript: number | null;
  showActions: boolean;
}) {
  const [expandedScript, setExpandedScript] = useState(false);
  const [scriptViewMode, setScriptViewMode] = useState<"formatted" | "raw">("formatted");
  const score = pitch.performanceScore || 0;

  return (
    <div className="p-6 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
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
  const [activeTab, setActiveTab] = useState<FilterTab>("today");

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
  }, [fetchPitches]);

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

      // Save script to DB
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

  async function handleRefreshPitches() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/generate-pitches", { method: "POST" });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate pitches");
        return;
      }

      const data = await res.json();
      if (data.pitches && data.pitches.length > 0) {
        // Prepend new pitches to the list
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

  const displayPitches =
    activeTab === "today" ? todayPitches : activeTab === "accepted" ? acceptedPitches : allPitches;

  const trendingPitches = displayPitches.filter((p) => p.pitchType === "trending");
  const evergreenPitches = displayPitches.filter((p) => p.pitchType === "evergreen");
  // Pitches without pitchType (legacy) go into trending
  const untaggedPitches = displayPitches.filter(
    (p) => p.pitchType !== "trending" && p.pitchType !== "evergreen"
  );

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "today", label: "Today's Pitches", count: todayPitches.length },
    { key: "accepted", label: "Accepted", count: acceptedPitches.length },
    { key: "all", label: "All", count: allPitches.length },
  ];

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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121217] border border-[#22222b]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.key === "today" && <Filter className="w-3.5 h-3.5" />}
              {tab.key === "accepted" && <Check className="w-3.5 h-3.5" />}
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md ${
                  activeTab === tab.key
                    ? "bg-purple-500/30 text-purple-200"
                    : "bg-[#1a1a24] text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={handleRefreshPitches}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {refreshing ? "Generating 10 pitches..." : "Refresh with AI"}
        </button>
      </div>

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
                Scanning fresh Caitlin Clark news, analyzing your covered topics, and crafting 10 new narrative pitches with Opus 4.7...
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
                : "No pitches found."}
          </p>
          <button
            onClick={handleRefreshPitches}
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
                    onGenerateScript={handleGenerateScript}
                    generatingScript={generatingScript}
                    showActions={true}
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
                    onGenerateScript={handleGenerateScript}
                    generatingScript={generatingScript}
                    showActions={true}
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
