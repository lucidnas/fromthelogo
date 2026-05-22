"use client";

import { useState } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import type { ThumbnailFormat } from "@/lib/studio";

const FORMAT_LABEL: Record<ThumbnailFormat, string> = {
  A: "A — Close-Up",
  B: "B — Face / Type",
  C: "C — Split Screen",
};

const FORMAT_HINT: Record<ThumbnailFormat, string> = {
  A: "Pure close-up, expression carries it. Best for narrative/story titles.",
  B: "One big word overlapping Clark's face. Best for dominance/fear titles.",
  C: "Villain left, Clark right, speech bubble. Best for villain/karma titles.",
};

// Auto-detect format from title keywords
function detectFormat(title: string): { format: ThumbnailFormat; word?: string } {
  const t = title.toLowerCase();
  if (
    t.includes("exposed") || t.includes("liar") || t.includes("backfired") ||
    t.includes("karma") || t.includes("humbled") || t.includes("called out")
  ) return { format: "C" };

  if (
    t.includes("afraid") || t.includes("problem") || t.includes("nightmare") ||
    t.includes("scariest") || t.includes("terrified") || t.includes("isn't ready") ||
    t.includes("worst nightmare") || t.includes("changes everything")
  ) {
    // Extract the key word
    const wordMap: Record<string, string> = {
      afraid: "AFRAID", problem: "PROBLEM", nightmare: "NIGHTMARE",
      scariest: "SCARIEST", terrified: "TERRIFIED", "everything": "EVERYTHING",
    };
    const matched = Object.entries(wordMap).find(([k]) => t.includes(k));
    return { format: "B", word: matched?.[1] };
  }

  return { format: "A" };
}

export function NewIdeaButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<ThumbnailFormat>("A");
  const [word, setWord] = useState("");
  const [bubble, setBubble] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);

  function onTitleChange(v: string) {
    setTitle(v);
    if (v.length > 10) {
      const { format: f, word: w } = detectFormat(v);
      setFormat(f);
      if (w) setWord(w);
    }
  }

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        status: "idea",
        thumbnailFormat: format,
        thumbnailWord: word.trim() || undefined,
        thumbnailBubble: bubble.trim() || undefined,
      }),
    });
    if (res.ok) {
      const { slug } = await res.json();
      window.location.href = `/videos/${slug}`;
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
          background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Plus size={14} /> New Idea
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          padding: 28, width: 480, display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>New Idea</span>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <div>
          <label style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Title
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setOpen(false); }}
            placeholder="This Is Not The Same Caitlin Clark..."
            style={{
              width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--text)", fontSize: 14, padding: "10px 12px", outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Thumbnail format */}
        <div>
          <label style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Thumbnail Format <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none" }}>(auto-detected)</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["A", "B", "C"] as ThumbnailFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 8, border: "1px solid",
                  borderColor: format === f ? "var(--accent)" : "var(--border)",
                  background: format === f ? "rgba(124,106,247,0.12)" : "var(--bg)",
                  color: format === f ? "var(--accent)" : "var(--sub)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                {FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0" }}>{FORMAT_HINT[format]}</p>
        </div>

        {/* Format B — key word */}
        {format === "B" && (
          <div>
            <label style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Big Word (overlaps face)
            </label>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value.toUpperCase())}
              placeholder="AFRAID"
              style={{
                width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--text)", fontSize: 14, padding: "10px 12px", outline: "none",
                fontWeight: 700, letterSpacing: 1,
              }}
            />
          </div>
        )}

        {/* Format C — speech bubble */}
        {format === "C" && (
          <div>
            <label style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Villain Speech Bubble
            </label>
            <input
              value={bubble}
              onChange={(e) => setBubble(e.target.value)}
              placeholder={`SHE SHOULDN'T BE IN THE LEAGUE`}
              style={{
                width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--text)", fontSize: 13, padding: "10px 12px", outline: "none",
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={() => setOpen(false)}
            style={{
              padding: "9px 16px", background: "none", color: "var(--sub)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={saving || !title.trim()}
            style={{
              padding: "9px 20px", background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: saving || !title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Creating..." : "Add to Ideas Bank"}
          </button>
        </div>
      </div>
    </div>
  );
}
