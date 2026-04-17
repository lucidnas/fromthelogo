"use client";

import { useState, useEffect } from "react";
import { Zap, Target, Check, X, Archive, Sparkles, Loader2, RefreshCw, FileText, Eye } from "lucide-react";

type Pitch = {
  id: string | number;
  title: string;
  format: "the-day" | "increasingly" | "backfired";
  angle: string;
  hookLine: string;
  talkingPoints: string[];
  estimatedScore?: number;
  performanceScore?: number;
  date?: string;
  generatedScript?: string | null;
};

type PitchHistory = {
  id: string;
  title: string;
  format: string;
  status: "accepted" | "rejected";
  date: string;
};

const formatColors: Record<string, { bg: string; text: string; border: string }> = {
  "the-day": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  increasingly: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  backfired: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
};

const formatLabels: Record<string, string> = {
  "the-day": "The Day",
  increasingly: "Increasingly",
  backfired: "Backfired",
};

const defaultPitches: Pitch[] = [
  {
    id: "pitch-1",
    title: "The Day Caitlin Clark DESTROYED A'ja Wilson's PERFECT Record",
    format: "the-day",
    angle:
      "The Fever-Aces rivalry has reached a boiling point. CC just handed A'ja Wilson her first home loss of the season in a statement game that shifts the power dynamic in the WNBA. Perfect narrative arc for a 'The Day' video.",
    hookLine:
      "A'ja Wilson hadn't lost a home game in 14 months. Then Caitlin Clark walked into Las Vegas and ended that streak in the most dramatic way possible.",
    talkingPoints: [
      "Set the scene: Wilson's historic home streak and media crowning her as untouchable",
      "Break down the key third-quarter run where CC scored 15 straight points",
      "The crowd reaction shift from confident to stunned silence",
      "Post-game implications for playoff seeding and MVP race",
    ],
    estimatedScore: 92,
    date: "2026-04-16",
  },
  {
    id: "pitch-2",
    title: "The WNBA Just SUSPENDED Angel Reese... But It Backfired SPECTACULARLY",
    format: "backfired",
    angle:
      "The league suspended Reese for a flagrant foul on a rookie, but the backlash has been enormous. Fans are calling it a double standard, ticket sales for her return game are through the roof, and she just signed a massive new endorsement deal. Classic backfire narrative.",
    hookLine:
      "The WNBA thought suspending Angel Reese would send a message. Instead, she became the most talked-about athlete in America for a week.",
    talkingPoints: [
      "The play that led to the suspension and why the call was controversial",
      "Social media explosion: comparing to fouls that went unpunished",
      "The endorsement deal she signed DURING her suspension",
      "Return game sold out in 12 minutes, breaking a WNBA record",
    ],
    estimatedScore: 87,
    date: "2026-04-16",
  },
  {
    id: "pitch-3",
    title: "Caitlin Clark three-pointers.. but they get increasingly UNREAL",
    format: "increasingly",
    angle:
      "CC just crossed 200 career WNBA threes faster than anyone in history. Perfect time for a compilation that starts with normal corner threes and escalates to logo bombs and buzzer beaters. The 'increasingly' format with her shooting is proven to do 500K+ views.",
    hookLine:
      "We ranked every Caitlin Clark three-pointer this season from normal... to absolutely UNREAL. The last one broke the internet.",
    talkingPoints: [
      "Start with solid catch-and-shoot threes to establish baseline",
      "Escalate through pull-ups, step-backs, and contested shots",
      "Feature the half-court heave that went viral last week",
      "End with the logo three that clinched the comeback win",
    ],
    estimatedScore: 89,
    date: "2026-04-16",
  },
];

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

export default function PitchesPage() {
  const [pitches, setPitches] = useState<Pitch[]>(defaultPitches);
  const [history, setHistory] = useState<PitchHistory[]>([]);
  const [generatingScript, setGeneratingScript] = useState<string | number | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scriptViewMode, setScriptViewMode] = useState<"formatted" | "raw">("formatted");

  useEffect(() => {
    const stored = localStorage.getItem("ftl-pitch-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  function saveHistory(newHistory: PitchHistory[]) {
    setHistory(newHistory);
    localStorage.setItem("ftl-pitch-history", JSON.stringify(newHistory));
  }

  function handleAccept(pitch: Pitch) {
    const entry: PitchHistory = {
      id: pitch.id + "-" + Date.now(),
      title: pitch.title,
      format: pitch.format,
      status: "accepted",
      date: new Date().toISOString().split("T")[0],
    };
    saveHistory([entry, ...history]);
  }

  function handleReject(pitch: Pitch) {
    const entry: PitchHistory = {
      id: pitch.id + "-" + Date.now(),
      title: pitch.title,
      format: pitch.format,
      status: "rejected",
      date: new Date().toISOString().split("T")[0],
    };
    saveHistory([entry, ...history]);
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
      setPitches((prev) =>
        prev.map((p) =>
          p.id === pitch.id ? { ...p, generatedScript: data.script } : p
        )
      );
      setExpandedScript(pitch.id);
    } catch (e) {
      alert("Failed to generate script. Check that an AI API key is configured.");
    } finally {
      setGeneratingScript(null);
    }
  }

  async function handleRefreshPitches() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/generate-pitches", {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate pitches");
        return;
      }

      const data = await res.json();
      if (data.pitches && data.pitches.length > 0) {
        setPitches(
          data.pitches.map((p: Pitch, i: number) => ({
            ...p,
            id: `ai-pitch-${Date.now()}-${i}`,
            estimatedScore: p.performanceScore || p.estimatedScore || 75,
            date: new Date().toISOString().split("T")[0],
          }))
        );
      }
    } catch {
      alert("Failed to refresh pitches. Check that an AI API key is configured.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-purple-400" />
          <h1 className="text-3xl font-bold text-white">Daily Pitches</h1>
        </div>
        <p className="text-gray-400 text-sm">
          AI-generated video ideas based on proven formats and current WNBA trends
        </p>
      </div>

      {/* Today's Pitches */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Today&apos;s Pitches</h2>
            <span className="text-xs text-gray-500 ml-2">
              {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
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
            {refreshing ? "Generating..." : "Refresh with AI"}
          </button>
        </div>

        <div className="space-y-6">
          {pitches.map((pitch) => {
            const fc = formatColors[pitch.format] || formatColors["the-day"];
            const score = pitch.estimatedScore || pitch.performanceScore || 0;
            return (
              <div
                key={pitch.id}
                className="p-6 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${fc.bg} ${fc.text} border ${fc.border}`}
                    >
                      {formatLabels[pitch.format] || pitch.format}
                    </span>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${getScoreBg(score)}`}>
                      <Target className={`w-3.5 h-3.5 ${getScoreColor(score)}`} />
                      <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                        {score}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
                  {pitch.title}
                </h3>

                {/* Angle */}
                <div className="mb-4">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Angle
                  </span>
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
                {pitch.generatedScript && expandedScript === pitch.id && (
                  <div className="mb-6 rounded-xl bg-[#0d0d12] border border-purple-500/20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a24]">
                      <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Generated Script
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setScriptViewMode("formatted")}
                          className={`px-2 py-1 rounded text-xs font-medium ${scriptViewMode === "formatted" ? "bg-purple-500/20 text-purple-300" : "text-gray-500 hover:text-white"}`}
                        >
                          <Eye className="w-3 h-3 inline mr-1" />Formatted
                        </button>
                        <button
                          onClick={() => setScriptViewMode("raw")}
                          className={`px-2 py-1 rounded text-xs font-medium ${scriptViewMode === "raw" ? "bg-purple-500/20 text-purple-300" : "text-gray-500 hover:text-white"}`}
                        >
                          <FileText className="w-3 h-3 inline mr-1" />Raw
                        </button>
                        <button
                          onClick={() => setExpandedScript(null)}
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
                              return <h3 key={i} className="text-purple-300 font-bold text-lg mt-6 mb-2 first:mt-0">{line}</h3>;
                            }
                            if (line.trim() === "") return <div key={i} className="h-2" />;
                            return <p key={i} className="text-gray-300 leading-relaxed mb-1.5 text-sm">{line}</p>;
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

                {pitch.generatedScript && expandedScript !== pitch.id && (
                  <button
                    onClick={() => setExpandedScript(pitch.id)}
                    className="mb-6 flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    View Generated Script
                  </button>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-[#22222b]">
                  <button
                    onClick={() => handleAccept(pitch)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(pitch)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleGenerateScript(pitch)}
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
              </div>
            );
          })}
        </div>
      </section>

      {/* Pitch History */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Archive className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Pitch History</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-10 rounded-xl bg-[#121217] border border-[#22222b] text-center overflow-hidden">
            <p className="text-gray-500 text-sm">
              No pitch history yet. Accept or reject pitches above to start tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    h.status === "accepted"
                      ? "bg-emerald-500/10"
                      : "bg-red-500/10"
                  }`}
                >
                  {h.status === "accepted" ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{h.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        formatColors[h.format]?.text || "text-gray-400"
                      }`}
                    >
                      {formatLabels[h.format] || h.format}
                    </span>
                    <span className="text-[10px] text-gray-600">{h.date}</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium ${
                    h.status === "accepted" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
