"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function NewVideoButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
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
        <Plus size={14} /> New Video
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Video title..."
        style={{
          background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8,
          color: "var(--text)", fontSize: 13, padding: "8px 12px", width: 280, outline: "none",
        }}
      />
      <button
        onClick={create}
        disabled={saving || !title.trim()}
        style={{
          padding: "8px 14px", background: "var(--accent)", color: "#fff", border: "none",
          borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          opacity: saving || !title.trim() ? 0.5 : 1,
        }}
      >
        {saving ? "Creating..." : "Create"}
      </button>
      <button
        onClick={() => setOpen(false)}
        style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", padding: 4 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
