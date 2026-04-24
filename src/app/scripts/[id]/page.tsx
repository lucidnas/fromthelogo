"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Sparkles, Download, Loader2, Mic, Play,
  ChevronDown, FileText, Scissors, Trash2,
} from "lucide-react";

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

// ── Page component ───────────────────────────────────────────────────────────

export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");

  // Script generation
  const [generating, setGenerating] = useState(false);
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [showSource, setShowSource] = useState(false);

  // Status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [voicesOpen, setVoicesOpen] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Full VO + background job
  const [generatingVo, setGeneratingVo] = useState(false);
  const [newAudioSrc, setNewAudioSrc] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Snippet tester
  const [snippet, setSnippet] = useState("");
  const [testingSnippet, setTestingSnippet] = useState(false);
  const [snippetAudioSrc, setSnippetAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    fetchVideo();
    fetchVoices();
    checkForActiveJobs();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll when we have an active job
  useEffect(() => {
    if (activeJobId === null) {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      return;
    }
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/audio-jobs/${activeJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJobStatus(data.job.status);
        if (data.job.status === "done") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setActiveJobId(null);
          setJobStatus(null);
          if (data.audio?.audioUrl) setNewAudioSrc(data.audio.audioUrl);
          refreshVideo();
        } else if (data.job.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setActiveJobId(null);
          setJobStatus(null);
          alert(`VO generation failed: ${data.job.error || "unknown error"}`);
        }
      } catch {
        // silent poll failure
      }
    }, 4000);
  }, [activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkForActiveJobs() {
    try {
      const res = await fetch(`/api/audio-jobs?videoId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.jobs?.length > 0) {
        setActiveJobId(data.jobs[0].id);
        setJobStatus(data.jobs[0].status);
      }
    } catch {
      // silent
    }
  }

  async function fetchVideo() {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) { router.push("/"); return; }
      const data = await res.json();
      setVideo(data.video);
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  // Silent refresh — doesn't trigger loading state, used after VO generation
  async function refreshVideo() {
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setVideo(data.video);
    } catch {
      // silent
    }
  }

  async function fetchVoices() {
    setVoicesLoading(true);
    try {
      const res = await fetch("/api/voices");
      const data = await res.json();
      setVoices(data.voices || []);
      if (data.voices?.length > 0) setVoiceId(data.voices[0].id);
    } catch {
      // silent
    } finally {
      setVoicesLoading(false);
    }
  }

  function previewVoice(voice: Voice) {
    if (!voice.previewUrl) return;
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
    const audio = new Audio(voice.previewUrl);
    previewAudioRef.current = audio;
    audio.play();
  }

  async function patchVideo(patch: Record<string, unknown>): Promise<Video | null> {
    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.video;
    } catch {
      return null;
    }
  }

  async function generateScript() {
    if (!video) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: video.title,
          hookLine: video.hookLine || "",
          format: "evergreen",
          angle: video.hookLine || "",
          talkingPoints: [],
          sourceMaterial: sourceMaterial.trim() || undefined,
        }),
      });
      if (!res.ok) { alert("Script generation failed"); return; }
      const data = await res.json();
      const updated = await patchVideo({ script: data.script, status: "scripted" });
      if (updated) setVideo(updated);
    } catch {
      alert("Script generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function generateFullVO() {
    if (!video?.script || !voiceId || activeJobId) return;
    setGeneratingVo(true);
    setNewAudioSrc(null);
    try {
      const selectedVoice = voices.find((v) => v.id === voiceId);
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: video.script, voiceId, voiceName: selectedVoice?.name, videoId: video.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`VO generation failed: ${err.error || res.status}`);
        return;
      }
      const data = await res.json();
      // Server returns jobId — start polling
      setActiveJobId(data.jobId);
      setJobStatus("pending");
    } catch (e) {
      alert(`VO generation failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setGeneratingVo(false);
    }
  }

  async function testSnippet() {
    if (!snippet.trim() || !voiceId) return;
    setTestingSnippet(true);
    setSnippetAudioSrc(null);
    try {
      const selectedVoice = voices.find((v) => v.id === voiceId);
      // No videoId → not saved to DB, just returns base64
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snippet, voiceId, voiceName: selectedVoice?.name }),
      });
      if (!res.ok) { alert("Snippet test failed"); return; }
      const data = await res.json();
      setSnippetAudioSrc(`data:audio/mpeg;base64,${data.audio}`);
    } catch {
      alert("Snippet test failed");
    } finally {
      setTestingSnippet(false);
    }
  }

  async function advanceStatus() {
    if (!video) return;
    const idx = STATUS_FLOW.indexOf(video.status);
    if (idx >= STATUS_FLOW.length - 1) return;
    setUpdatingStatus(true);
    const updated = await patchVideo({ status: STATUS_FLOW[idx + 1] });
    if (updated) setVideo(updated);
    setUpdatingStatus(false);
  }

  function downloadScript() {
    if (!video?.script) return;
    const blob = new Blob([video.script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(video.title)}_script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Capture text selection from script pane
  function handleScriptMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (text.length > 10) setSnippet(text);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!video) return null;

  const wordCount = video.script ? countWords(video.script) : 0;
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(video.status) + 1];
  const selectedVoiceName = voices.find((v) => v.id === voiceId)?.name || "Select voice";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#22222b] bg-[#0d0d12] shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#22222b] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[video.status] || statusColors.idea}`}>
                {video.status}
              </span>
              {video.script && (
                <span className="text-xs text-gray-500">{wordCount.toLocaleString()} words · ~{Math.round(wordCount / 140)} min</span>
              )}
              {video.audios.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <Mic className="w-3 h-3" /> {video.audios.length} take{video.audios.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h1 className="text-sm font-semibold text-white truncate max-w-xl">{video.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {nextStatus && (
            <button
              onClick={advanceStatus}
              disabled={updatingStatus}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#22222b] text-gray-300 hover:text-white transition-colors capitalize flex items-center gap-1"
            >
              {updatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Mark {nextStatus}
            </button>
          )}
          {video.script && (
            <>
              <button
                onClick={() => setViewMode("formatted")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "formatted" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}
              >
                Formatted
              </button>
              <button
                onClick={() => setViewMode("raw")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "raw" ? "bg-purple-500/20 text-purple-300" : "text-gray-400 hover:text-white"}`}
              >
                Raw
              </button>
            </>
          )}
          <button
            onClick={generateScript}
            disabled={generating}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating..." : video.script ? "Regenerate" : "Generate Script"}
          </button>
          {video.script && (
            <button
              onClick={downloadScript}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Script
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Script pane */}
        <div
          className="flex-1 overflow-y-auto p-8 select-text"
          onMouseUp={handleScriptMouseUp}
        >
          {!video.script ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <FileText className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-500 mb-2">No script yet.</p>
              {showSource && (
                <textarea
                  value={sourceMaterial}
                  onChange={(e) => setSourceMaterial(e.target.value)}
                  placeholder="Paste transcript excerpts or research notes here..."
                  className="w-full max-w-lg h-40 px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-gray-300 text-sm font-mono placeholder-gray-700 focus:outline-none focus:border-purple-500/30 resize-none mb-4"
                />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSource((s) => !s)}
                  className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 border border-[#22222b] transition-colors"
                >
                  {showSource ? "Hide" : "Add"} source material
                </button>
                <button
                  onClick={generateScript}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating..." : "Generate Script"}
                </button>
              </div>
            </div>
          ) : viewMode === "formatted" ? (
            <div className="prose prose-invert max-w-3xl mx-auto">
              {video.script.split("\n").map((line, i) => {
                if (line.startsWith("[") && line.endsWith("]"))
                  return <h3 key={i} className="text-purple-300 font-bold text-base mt-8 mb-2 first:mt-0 uppercase tracking-wider text-xs">{line}</h3>;
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return <p key={i} className="text-gray-300 leading-relaxed mb-2 text-[15px]">{line}</p>;
              })}
            </div>
          ) : (
            <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap leading-relaxed max-w-3xl mx-auto">{video.script}</pre>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-[#22222b] flex flex-col shrink-0 bg-[#0d0d12]">

          {/* Voice selector */}
          <div className="p-5 border-b border-[#22222b]">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">Voice</h3>
            {voicesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading voices...
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setVoicesOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-sm text-white hover:border-purple-500/30 transition-colors"
                >
                  <span className="truncate">{selectedVoiceName}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${voicesOpen ? "rotate-180" : ""}`} />
                </button>
                {voicesOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d12] border border-[#22222b] rounded-lg overflow-hidden z-20 max-h-56 overflow-y-auto shadow-xl">
                    {voices.map((v) => (
                      <div key={v.id} className={`flex items-center gap-1 px-2 py-1.5 hover:bg-[#16161d] transition-colors ${voiceId === v.id ? "bg-purple-500/10" : ""}`}>
                        <button
                          onClick={() => { setVoiceId(v.id); setVoicesOpen(false); }}
                          className={`flex-1 text-left text-sm ${voiceId === v.id ? "text-purple-300" : "text-gray-300"}`}
                        >
                          {v.name}
                          {v.category && <span className="text-xs text-gray-600 ml-2">{v.category}</span>}
                        </button>
                        {v.previewUrl && (
                          <button
                            onClick={(e) => { e.stopPropagation(); previewVoice(v); }}
                            className="p-1 rounded text-gray-500 hover:text-emerald-400 transition-colors shrink-0"
                            title="Preview voice"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Snippet tester */}
          <div className="p-5 border-b border-[#22222b]">
            <div className="flex items-center gap-2 mb-3">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Snippet Test</h3>
            </div>
            <div className="relative mb-3">
              <textarea
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                placeholder="Select text in the script, or paste a snippet here..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-gray-300 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-amber-500/30 resize-none"
              />
              {snippet && (
                <button
                  onClick={() => { setSnippet(""); setSnippetAudioSrc(null); }}
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={testSnippet}
              disabled={!snippet.trim() || !voiceId || testingSnippet}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-xs font-medium disabled:opacity-50"
            >
              {testingSnippet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {testingSnippet ? "Generating..." : "Test Snippet"}
            </button>
            {!video.script && !snippet && (
              <p className="text-[10px] text-gray-600 text-center mt-2">Highlight any line in the script to test it</p>
            )}
            {snippetAudioSrc && (
              <div className="mt-3 p-2 rounded-lg bg-[#0b0b0f] border border-amber-500/20">
                <p className="text-[10px] text-amber-400 mb-1.5 font-medium">Snippet preview</p>
                <audio src={snippetAudioSrc} controls autoPlay className="w-full h-8" style={{ colorScheme: "dark" }} />
              </div>
            )}
          </div>

          {/* Generate full VO */}
          <div className="p-5 border-b border-[#22222b]">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">Full VO</h3>
            {activeJobId ? (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-center">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 mx-auto mb-1.5" />
                <p className="text-xs text-emerald-400 font-medium">
                  {jobStatus === "processing" ? "Generating audio..." : "Queued..."}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">You can navigate away — it runs in the background</p>
              </div>
            ) : (
              <button
                onClick={generateFullVO}
                disabled={!video.script || !voiceId || generatingVo}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {generatingVo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {generatingVo ? "Starting..." : "Generate Full VO"}
              </button>
            )}
            {!video.script && !activeJobId && (
              <p className="text-[10px] text-gray-600 text-center mt-2">Generate a script first</p>
            )}
            {newAudioSrc && !activeJobId && (
              <div className="mt-3 p-2 rounded-lg bg-[#0b0b0f] border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 mb-1.5 font-medium">Just generated</p>
                <audio src={newAudioSrc} controls autoPlay className="w-full h-8" style={{ colorScheme: "dark" }} />
              </div>
            )}
          </div>

          {/* Source material */}
          <div className="px-5 py-3 border-b border-[#22222b]">
            <button
              onClick={() => setShowSource((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSource ? "rotate-180" : ""}`} />
              Source material for script
            </button>
            {showSource && (
              <div className="mt-2">
                <textarea
                  value={sourceMaterial}
                  onChange={(e) => setSourceMaterial(e.target.value)}
                  placeholder="Paste transcript excerpts or notes here..."
                  className="w-full h-32 px-3 py-2 rounded-lg bg-[#0b0b0f] border border-[#22222b] text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-purple-500/30 resize-none"
                />
                <p className="text-[10px] text-gray-600 mt-1">Hit &quot;Regenerate&quot; in the header after pasting.</p>
              </div>
            )}
          </div>

          {/* VO History */}
          <div className="flex-1 overflow-y-auto p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">
              VO History {video.audios.length > 0 && `(${video.audios.length})`}
            </h3>
            {video.audios.length === 0 ? (
              <p className="text-xs text-gray-600 text-center pt-2">No takes yet.</p>
            ) : (
              <div className="space-y-3">
                {video.audios.map((a, idx) =>
                  a.audioUrl ? (
                    <AudioTake
                      key={a.id}
                      id={a.id}
                      label={`Take ${video.audios.length - idx} — ${a.voiceName}`}
                      sublabel={formatDate(a.createdAt)}
                      src={a.audioUrl}
                      filename={`${slugify(video.title)}_take${video.audios.length - idx}.mp3`}
                      onDelete={(id) => setVideo((v) => v ? { ...v, audios: v.audios.filter((a) => a.id !== id) } : v)}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Audio Take ──────────────────────────────────────────────────────────────

function AudioTake({ id, label, sublabel, src, filename, onDelete }: {
  id: number;
  label: string;
  sublabel?: string;
  src: string;
  filename: string;
  onDelete: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  function download() {
    if (src.startsWith("data:")) {
      const [header, b64] = src.split(",");
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
      a.href = src; a.download = filename; a.click();
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this take?")) return;
    setDeleting(true);
    await fetch(`/api/audio/${id}`, { method: "DELETE" });
    onDelete(id);
  }

  const isDeadPath = !src.startsWith("data:") && src.startsWith("/audio/");

  if (isDeadPath) {
    return (
      <div className="rounded-xl border border-[#22222b] bg-[#0b0b0f] p-3 opacity-50 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          {sublabel && <p className="text-[10px] text-gray-600">{sublabel}</p>}
          <p className="text-[10px] text-gray-700 mt-1">File lost on redeploy — regenerate</p>
        </div>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-md text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#22222b] bg-[#0b0b0f] p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-medium text-gray-300">{label}</p>
          {sublabel && <p className="text-[10px] text-gray-600">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={download} className="p-1.5 rounded-md text-gray-500 hover:text-white transition-colors" title="Download">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <audio src={src} controls className="w-full h-8" style={{ colorScheme: "dark" }} />
    </div>
  );
}
