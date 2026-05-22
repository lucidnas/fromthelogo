"use client";

import Link from "next/link";
import type { Video } from "@/lib/studio";

const STATUS_COLOR: Record<string, string> = {
  idea: "var(--muted)",
  researched: "var(--yellow)",
  scripted: "var(--accent)",
  vo: "#06b6d4",
  rendered: "var(--green)",
};

export function VideoCard({ video }: { video: Video }) {
  const dots = [
    { key: "script", has: video.hasScript, label: "Script" },
    { key: "vo", has: video.hasVO, label: "VO" },
    { key: "thumb", has: video.hasThumbnail, label: "Thumb" },
    { key: "render", has: video.hasRender, label: "Render" },
  ];

  return (
    <Link href={`/videos/${video.slug}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", lineHeight: 1.35, marginBottom: 8 }}>
          {video.title}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {dots.map(({ key, has, label }) => (
            <span
              key={key}
              title={label}
              style={{
                fontSize: 9,
                padding: "2px 5px",
                borderRadius: 3,
                background: has ? "rgba(124,106,247,0.15)" : "transparent",
                color: has ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${has ? "rgba(124,106,247,0.3)" : "var(--border)"}`,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function BrollStats() {
  return null;
}
