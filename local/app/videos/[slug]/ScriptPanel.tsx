"use client";

import { useState } from "react";

export function ScriptPanel({ script }: { script: string }) {
  const wordCount = script.trim().split(/\s+/).length;
  const estSecs = Math.round((wordCount / 135) * 60);
  const estMin = Math.floor(estSecs / 60);
  const estSec = estSecs % 60;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Script</h2>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--sub)" }}>
          <span>{wordCount.toLocaleString()} words</span>
          <span>~{estMin}:{estSec.toString().padStart(2, "0")} at 135 WPM</span>
        </div>
      </div>
      <div
        style={{ userSelect: "text" }}
        onMouseUp={() => {
          const sel = window.getSelection()?.toString().trim();
          if (sel && sel.length > 10) {
            // Broadcast to VideoActions via a custom event
            window.dispatchEvent(new CustomEvent("ftl:snippet", { detail: sel }));
          }
        }}
      >
        {script.split("\n\n").map((para, i) => (
          <p key={i} style={{ margin: "0 0 16px 0", fontSize: 14, lineHeight: 1.75, color: "var(--text)" }}>
            {para.trim()}
          </p>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
        Select any text to auto-fill the snippet tester →
      </p>
    </div>
  );
}
