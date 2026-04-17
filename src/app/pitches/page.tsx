"use client";

import { useState, useEffect } from "react";
import { Zap, Target, TrendingUp, Check, X, Archive, Sparkles } from "lucide-react";

type Pitch = {
  id: string;
  title: string;
  format: "the-day" | "increasingly" | "backfired";
  angle: string;
  hookLine: string;
  talkingPoints: string[];
  estimatedScore: number;
  date: string;
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

const todayPitches: Pitch[] = [
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
  const [history, setHistory] = useState<PitchHistory[]>([]);

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

  function handleGenerateScript() {
    alert("Script generation coming soon. This will connect to the AI writing pipeline.");
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
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Today&apos;s Pitches</h2>
          <span className="text-xs text-gray-500 ml-2">April 16, 2026</span>
        </div>

        <div className="space-y-6">
          {todayPitches.map((pitch) => {
            const fc = formatColors[pitch.format];
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
                      {formatLabels[pitch.format]}
                    </span>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${getScoreBg(pitch.estimatedScore)}`}>
                      <Target className={`w-3.5 h-3.5 ${getScoreColor(pitch.estimatedScore)}`} />
                      <span className={`text-xs font-bold ${getScoreColor(pitch.estimatedScore)}`}>
                        {pitch.estimatedScore}
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
                    onClick={handleGenerateScript}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium hover:bg-purple-500/20 transition-colors ml-auto"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Script
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
