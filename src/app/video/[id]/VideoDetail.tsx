"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Video } from "@/lib/data";
import { ArrowLeft, Clock, Tag, Download, FileText, Eye, Mic, Play, Loader2, Trash2 } from "lucide-react";

type AudioEntry = {
  audio: string;
  voiceId: string;
  voiceName: string;
  isTest: boolean;
  generatedAt: string;
};

type Voice = {
  id: string;
  name: string;
  category: string;
  previewUrl: string;
};

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

export default function VideoDetail({ video }: { video: Video }) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testingAudio, setTestingAudio] = useState(false);
  const [audioHistory, setAudioHistory] = useState<AudioEntry[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  // Load voices on mount
  useEffect(() => {
    loadVoices();
    // Load audio history from localStorage
    const saved = localStorage.getItem(`ftl_audio_${video.id}`);
    if (saved) setAudioHistory(JSON.parse(saved));
  }, [video.id]);

  async function loadVoices() {
    setLoadingVoices(true);
    try {
      const res = await fetch("/api/voices");
      const data = await res.json();
      setVoices(data.voices || []);
      if (data.voices?.length > 0) setSelectedVoice(data.voices[0].id);
    } catch (e) {
      console.error("Failed to load voices", e);
    }
    setLoadingVoices(false);
  }

  function saveAudioHistory(entries: AudioEntry[]) {
    setAudioHistory(entries);
    localStorage.setItem(`ftl_audio_${video.id}`, JSON.stringify(entries));
  }

  async function generateAudio(isTest: boolean) {
    if (!video.script || !selectedVoice) return;

    const text = isTest
      ? video.script.split("\n\n").slice(0, 2).join("\n\n")
      : video.script;

    const voiceName = voices.find((v) => v.id === selectedVoice)?.name || "Unknown";

    if (isTest) setTestingAudio(true);
    else setGenerating(true);

    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: selectedVoice, voiceName, videoId: video.id, isTest }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate audio");
        return;
      }

      const entry: AudioEntry = await res.json();
      const updated = [entry, ...audioHistory];
      saveAudioHistory(updated);

      // Auto-play
      setCurrentAudio(`data:audio/mpeg;base64,${entry.audio}`);
    } catch (e) {
      alert("Failed to generate audio");
    } finally {
      setGenerating(false);
      setTestingAudio(false);
    }
  }

  async function handleGenerateScript() {
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: video.title,
          hookLine: video.hookLine,
          format: video.category,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate script");
        return;
      }
      const data = await res.json();
      setGeneratedScript(data.script);
    } catch {
      alert("Failed to generate script. Check that an AI API key is configured.");
    } finally {
      setGeneratingScript(false);
    }
  }

  function downloadScript() {
    if (!video.script) return;
    const blob = new Blob([video.script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${video.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAudio(entry: AudioEntry) {
    const a = document.createElement("a");
    a.href = `data:audio/mpeg;base64,${entry.audio}`;
    a.download = `${video.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_${entry.voiceName}_${entry.isTest ? "test" : "full"}.mp3`;
    a.click();
  }

  function deleteAudio(index: number) {
    const updated = audioHistory.filter((_, i) => i !== index);
    saveAudioHistory(updated);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${statusColors[video.status]}`}>{video.status}</span>
          <span className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${categoryColors[video.category] || "bg-gray-500/10 text-gray-400"}`}>{video.category.replace("-", " ")}</span>
          <span className="flex items-center gap-1.5 text-gray-500 text-xs"><Clock className="w-3.5 h-3.5" />{video.estimatedLength}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">{video.title}</h1>
        <p className="text-lg text-gray-400 leading-relaxed mb-6">{video.hookLine}</p>
        <div className="flex flex-wrap gap-2">
          {video.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#121217] border border-[#22222b] text-gray-400 text-xs">
              <Tag className="w-3 h-3" />{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Thumbnail Concept */}
      <div className="p-6 rounded-xl bg-[#121217] border border-[#22222b] mb-6">
        <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Thumbnail Concept</h2>
        <p className="text-gray-300 leading-relaxed">{video.thumbnailConcept}</p>
      </div>

      {/* Script Section */}
      {video.script ? (
        <div className="rounded-xl bg-[#121217] border border-[#22222b] mb-6 overflow-hidden">
          {/* Script toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#22222b]">
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Script</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode("formatted")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "formatted" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}>
                <Eye className="w-3.5 h-3.5" /> Formatted
              </button>
              <button onClick={() => setViewMode("raw")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "raw" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}>
                <FileText className="w-3.5 h-3.5" /> Raw
              </button>
              <button onClick={downloadScript}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>

          {/* Script content */}
          <div className="p-6 md:p-8 max-h-[600px] overflow-y-auto">
            {viewMode === "formatted" ? (
              <div>
                {video.script.split("\n").map((line, i) => {
                  if (line.startsWith("[") && line.endsWith("]")) {
                    return <h3 key={i} className="text-purple-300 font-bold text-lg mt-8 mb-3 first:mt-0">{line}</h3>;
                  }
                  if (line.trim() === "") return <div key={i} className="h-3" />;
                  return <p key={i} className="text-gray-300 leading-relaxed mb-2 text-[15px]">{line}</p>;
                })}
              </div>
            ) : (
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">{video.script}</pre>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[#121217] border border-[#22222b] mb-6 overflow-hidden">
          {!generatedScript ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-lg">No script written yet.</p>
              <p className="text-gray-600 text-sm mt-2 mb-6">This video is still in the idea phase.</p>
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-violet-500 transition-all disabled:opacity-50"
              >
                {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {generatingScript ? "Generating Script..." : "Generate Script with AI"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#22222b]">
                <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">AI Generated Script</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setViewMode("formatted")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "formatted" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}>
                    <Eye className="w-3.5 h-3.5" /> Formatted
                  </button>
                  <button onClick={() => setViewMode("raw")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "raw" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}>
                    <FileText className="w-3.5 h-3.5" /> Raw
                  </button>
                  <button
                    onClick={handleGenerateScript}
                    disabled={generatingScript}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {generatingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="p-6 md:p-8 max-h-[600px] overflow-y-auto">
                {viewMode === "formatted" ? (
                  <div>
                    {generatedScript.split("\n").map((line, i) => {
                      if (line.startsWith("[") && line.includes("]")) {
                        return <h3 key={i} className="text-purple-300 font-bold text-lg mt-8 mb-3 first:mt-0">{line}</h3>;
                      }
                      if (line.trim() === "") return <div key={i} className="h-3" />;
                      return <p key={i} className="text-gray-300 leading-relaxed mb-2 text-[15px]">{line}</p>;
                    })}
                  </div>
                ) : (
                  <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">{generatedScript}</pre>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Voice Generation */}
      {video.script && (
        <div className="rounded-xl bg-[#121217] border border-[#22222b] mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#22222b]">
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Mic className="w-4 h-4" /> Voice Generation
            </h2>
          </div>
          <div className="p-6">
            {loadingVoices ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading voices...</div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-white text-sm focus:outline-none focus:border-purple-500/50"
                  >
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                  <div className="flex gap-3">
                    <button
                      onClick={() => generateAudio(true)}
                      disabled={testingAudio || generating}
                      className="flex-1 py-2.5 rounded-lg bg-[#22222b] text-gray-300 text-sm font-medium hover:bg-[#2a2a35] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {testingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Test Voice
                    </button>
                    <button
                      onClick={() => generateAudio(false)}
                      disabled={generating || testingAudio}
                      className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-violet-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      Generate Full Audio
                    </button>
                  </div>
                </div>

                {/* Preview voice */}
                {selectedVoice && voices.find((v) => v.id === selectedVoice)?.previewUrl && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs mb-1">Voice preview:</p>
                    <audio controls src={voices.find((v) => v.id === selectedVoice)?.previewUrl} className="w-full h-8 opacity-70" />
                  </div>
                )}
              </>
            )}

            {/* Current playback */}
            {currentAudio && (
              <div className="mt-4 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="text-purple-300 text-xs font-medium mb-2">Now Playing</p>
                <audio controls src={currentAudio} autoPlay className="w-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio History */}
      {audioHistory.length > 0 && (
        <div className="rounded-xl bg-[#121217] border border-[#22222b] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#22222b]">
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
              Audio History ({audioHistory.length})
            </h2>
          </div>
          <div className="divide-y divide-[#22222b]">
            {audioHistory.map((entry, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{entry.voiceName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${entry.isTest ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                      {entry.isTest ? "Test" : "Full"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">{new Date(entry.generatedAt).toLocaleString()}</p>
                </div>
                <button onClick={() => setCurrentAudio(`data:audio/mpeg;base64,${entry.audio}`)}
                  className="p-2 rounded-lg hover:bg-[#22222b] text-gray-400 hover:text-white transition-colors" title="Play">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => downloadAudio(entry)}
                  className="p-2 rounded-lg hover:bg-[#22222b] text-gray-400 hover:text-white transition-colors" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => deleteAudio(i)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
