"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Loader2, Mic, Volume2, Download } from "lucide-react";
import type { Video } from "@/lib/studio";

interface Voice {
  id: string;
  name: string;
  category: string;
  previewUrl: string | null;
}

interface Take {
  name: string;
  voiceName: string;
  timestamp: number;
  src: string;
}

export function VideoActions({ video, takes }: { video: Video; takes: Take[] }) {
  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voicesOpen, setVoicesOpen] = useState(false);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Snippet test
  const [snippet, setSnippet] = useState("");
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [snippetSrc, setSnippetSrc] = useState<string | null>(null);

  // Full VO
  const [voLoading, setVoLoading] = useState(false);
  const [voLog, setVoLog] = useState("");
  const [voError, setVoError] = useState(false);

  // Playback
  const [playingTake, setPlayingTake] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Local takes state (so new ones appear without page reload)
  const [localTakes, setLocalTakes] = useState<Take[]>(takes);

  useEffect(() => {
    loadVoices();
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text) setSnippet(text);
    };
    window.addEventListener("ftl:snippet", handler);
    return () => window.removeEventListener("ftl:snippet", handler);
  }, []);

  async function loadVoices() {
    setVoicesLoading(true);
    try {
      const res = await fetch("/api/voices");
      const data = await res.json();
      const list: Voice[] = data.voices ?? [];
      setVoices(list);
      const preferred = list.find(v => v.id === "DTLT09E2cxHF0DqjKVbc");
      setSelectedVoiceId(preferred ? preferred.id : list[0]?.id ?? "");
    } catch { /* silent */ }
    setVoicesLoading(false);
  }

  function previewVoice(voice: Voice) {
    if (!voice.previewUrl) return;
    if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    const a = new Audio(voice.previewUrl);
    previewRef.current = a;
    a.play();
  }

  async function testSnippet() {
    if (!snippet.trim() || !selectedVoiceId) return;
    setSnippetLoading(true);
    setSnippetSrc(null);
    try {
      const res = await fetch("/api/run/snippet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snippet, voiceId: selectedVoiceId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setSnippetSrc(`data:audio/mpeg;base64,${data.audio}`);
    } catch (e) { alert(String(e)); }
    setSnippetLoading(false);
  }

  async function generateVO() {
    if (!selectedVoiceId || voLoading) return;
    setVoLoading(true);
    setVoLog("");
    setVoError(false);
    const voiceName = voices.find(v => v.id === selectedVoiceId)?.name ?? "Unknown";
    try {
      const res = await fetch("/api/run/vo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: video.slug, voiceId: selectedVoiceId, voiceName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoLog(data.error ?? "Failed");
        setVoError(true);
      } else {
        setVoLog(data.log ?? "Done.");
        // Add new take to local list
        const newTake: Take = {
          name: `vo-${voiceName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.mp3`,
          voiceName,
          timestamp: Date.now(),
          src: `/api/assets/${video.slug}/vo.mp3?t=${Date.now()}`,
        };
        setLocalTakes(prev => [newTake, ...prev]);
      }
    } catch (e) {
      setVoLog(String(e));
      setVoError(true);
    }
    setVoLoading(false);
  }

  function playTake(src: string, name: string) {
    if (playingTake === name) {
      audioRef.current?.pause();
      setPlayingTake(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(src);
    audioRef.current = a;
    a.onended = () => setPlayingTake(null);
    a.play();
    setPlayingTake(name);
  }

  function downloadTake(src: string, name: string) {
    fetch(src)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      });
  }

  const selectedVoice = voices.find(v => v.id === selectedVoiceId);
  const filteredVoices = voices.filter(v =>
    v.name.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Idea mode — advance to research */}
      {video.status === "idea" && <StartResearchButton slug={video.slug} />}

      {/* Voice Picker */}
      <Panel title="Voice" icon="🎙️">
        {voicesLoading ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>Loading voices...</div>
        ) : (
          <div>
            {/* Selected voice display */}
            <button
              onClick={() => setVoicesOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "10px 12px", color: "var(--text)", cursor: "pointer", fontSize: 13,
              }}
            >
              <span>{selectedVoice?.name ?? "Select a voice"}</span>
              {selectedVoice?.previewUrl && (
                <span
                  onClick={e => { e.stopPropagation(); selectedVoice && previewVoice(selectedVoice); }}
                  style={{ color: "var(--accent)", fontSize: 11, padding: "2px 6px" }}
                >
                  ▶ Preview
                </span>
              )}
            </button>

            {/* Dropdown */}
            {voicesOpen && (
              <div style={{ marginTop: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <input
                  autoFocus
                  value={voiceSearch}
                  onChange={e => setVoiceSearch(e.target.value)}
                  placeholder="Search voices..."
                  style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none" }}
                />
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {filteredVoices.map(v => (
                    <div
                      key={v.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px", cursor: "pointer",
                        background: v.id === selectedVoiceId ? "rgba(124,106,247,0.1)" : "transparent",
                        borderLeft: v.id === selectedVoiceId ? "2px solid var(--accent)" : "2px solid transparent",
                      }}
                      onClick={() => { setSelectedVoiceId(v.id); setVoicesOpen(false); setVoiceSearch(""); }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: v.id === selectedVoiceId ? 600 : 400 }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: "var(--sub)" }}>{v.category}</div>
                      </div>
                      {v.previewUrl && (
                        <button
                          onClick={e => { e.stopPropagation(); previewVoice(v); }}
                          style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: "4px 8px", fontSize: 11 }}
                        >
                          ▶
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Snippet Tester */}
      <Panel title="Test Snippet" icon="🔬">
        <textarea
          value={snippet}
          onChange={e => setSnippet(e.target.value)}
          placeholder="Paste a few lines from the script to test this voice..."
          rows={4}
          style={{
            width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--text)", fontSize: 13, padding: "10px 12px", resize: "vertical", outline: "none",
            fontFamily: "inherit", lineHeight: 1.6,
          }}
        />
        <button
          onClick={testSnippet}
          disabled={!snippet.trim() || !selectedVoiceId || snippetLoading}
          style={btnStyle("var(--accent)", !snippet.trim() || !selectedVoiceId || snippetLoading)}
        >
          {snippetLoading ? <><Loader2 size={13} style={{ display: "inline", marginRight: 6 }} />Generating...</> : "Test Voice"}
        </button>
        {snippetSrc && (
          <audio controls src={snippetSrc} style={{ width: "100%", marginTop: 8 }} />
        )}
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          Tip: select text from the script on the left to auto-fill this.
        </p>
      </Panel>

      {/* Generate Full VO */}
      <Panel title="Full Voice-Over" icon="🎬" done={video.hasVO}>
        <button
          onClick={generateVO}
          disabled={!selectedVoiceId || voLoading || !video.hasScript}
          style={btnStyle("var(--accent)", !selectedVoiceId || voLoading || !video.hasScript)}
        >
          {voLoading
            ? <><Loader2 size={13} style={{ display: "inline", marginRight: 6 }} />Generating (~3 min)...</>
            : video.hasVO ? "Regenerate VO" : "Generate Full VO"
          }
        </button>
        {!video.hasScript && (
          <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 6 }}>Add script.txt to this video folder first.</p>
        )}
        {voLog && (
          <pre style={{
            marginTop: 10, padding: "8px 10px", background: "#0d0d14", borderRadius: 6,
            fontSize: 11, color: voError ? "var(--red)" : "var(--green)", whiteSpace: "pre-wrap",
            border: `1px solid ${voError ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`, maxHeight: 100, overflow: "auto",
          }}>
            {voLog}
          </pre>
        )}
      </Panel>

      {/* Takes History */}
      {localTakes.length > 0 && (
        <Panel title="Takes" icon="📼">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {localTakes.map((take) => (
              <div
                key={take.name}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 7,
                }}
              >
                <button
                  onClick={() => playTake(take.src, take.name)}
                  style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 2 }}
                >
                  {playingTake === take.name ? <Square size={14} /> : <Play size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {take.voiceName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--sub)" }}>
                    {new Date(take.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => downloadTake(take.src, take.name)}
                  style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 2 }}
                  title="Download"
                >
                  <Download size={13} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Cue sheet trigger */}
      <CueSheetButton video={video} />
    </div>
  );
}

function CueSheetButton({ video }: { video: Video }) {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");
  const [error, setError] = useState(false);

  async function generate() {
    setLoading(true); setLog(""); setError(false);
    try {
      const res = await fetch("/api/run/cue-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: video.slug }),
      });
      const data = await res.json();
      if (!res.ok) { setLog(data.error ?? "Failed"); setError(true); }
      else { setLog(data.log ?? "Done."); }
    } catch (e) { setLog(String(e)); setError(true); }
    setLoading(false);
  }

  return (
    <Panel title="Cue Sheet" icon="📋" done={video.hasCueSheet}>
      {video.hasCueSheet ? (
        <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Generated — see script panel</span>
      ) : (
        <>
          <button
            onClick={generate}
            disabled={!video.hasScript || loading}
            style={btnStyle("#06b6d4", !video.hasScript || loading)}
          >
            {loading ? "Generating..." : "Generate Cue Sheet"}
          </button>
          {log && (
            <pre style={{ marginTop: 10, padding: "8px 10px", background: "#0d0d14", borderRadius: 6, fontSize: 11, color: error ? "var(--red)" : "var(--sub)", whiteSpace: "pre-wrap", border: "1px solid var(--border)", maxHeight: 100, overflow: "auto" }}>
              {log}
            </pre>
          )}
        </>
      )}
    </Panel>
  );
}

function Panel({ title, icon, done, children }: { title: string; icon: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${done ? "rgba(34,197,94,0.2)" : "var(--border)"}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        {done && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--green)" }}>✓</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function StartResearchButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);

  async function advance() {
    setLoading(true);
    await fetch(`/api/videos/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "researched" }),
    });
    window.location.reload();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--yellow)" }}>💡 Idea Stage</div>
      <p style={{ fontSize: 12, color: "var(--sub)", margin: "0 0 12px" }}>
        Found the story that fits this title? Move it into the research phase.
      </p>
      <button
        onClick={advance}
        disabled={loading}
        style={{ ...btnStyle("var(--yellow)"), color: "#000" }}
      >
        {loading ? "Moving..." : "Start Research →"}
      </button>
    </div>
  );
}

function btnStyle(color: string, disabled = false): React.CSSProperties {
  return {
    padding: "9px 14px", background: disabled ? "var(--muted)" : color,
    color: "#fff", border: "none", borderRadius: 7, fontSize: 13,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", width: "100%",
    opacity: disabled ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center",
  };
}
