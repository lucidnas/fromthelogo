import { getBrollStats, BROLL_DIR } from "@/lib/studio";
import fs from "fs";
import path from "path";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getGroups() {
  const manifestPath = path.join(BROLL_DIR, "groups", "manifest.json");
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, { totalSecs: number; clips: string[] }>;
  } catch { return null; }
}

export default function BrollPage() {
  const stats = getBrollStats();
  const groups = getGroups();

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "var(--sub)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <ChevronLeft size={14} /> Videos
        </Link>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>B-Roll Library</span>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {!stats ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
              {[
                { label: "Active Clips", value: stats.activeClips },
                { label: "Total Duration", value: fmtDuration(stats.totalSecs) },
                { label: "Sources", value: stats.sources },
                { label: "Groups", value: groups ? Object.keys(groups).length : 0 },
              ].map(({ label, value }) => (
                <div key={label} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Groups */}
            {groups && (
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Groups</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(groups).sort().map(([name, info]) => (
                    <div key={name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, width: 90 }}>{name}</span>
                      <span style={{ color: "var(--sub)", fontSize: 13 }}>{info.clips.length} clips</span>
                      <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 13, color: "var(--accent)" }}>{fmtDuration(info.totalSecs)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 16 }}>
                  To reshuffle groups: <code style={{ color: "var(--accent)" }}>python3 ~/.claude/skills/broll/group.py</code>
                </p>
              </div>
            )}

            {!groups && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 24, textAlign: "center" }}>
                <p style={{ color: "var(--sub)", fontSize: 14, marginBottom: 12 }}>No groups yet. Run the grouper to organize clips into ~8-min folders.</p>
                <code style={{ color: "var(--accent)", fontSize: 13 }}>python3 ~/.claude/skills/broll/group.py</code>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", paddingTop: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
      <h2 style={{ fontWeight: 600, marginBottom: 8 }}>No B-Roll Library Yet</h2>
      <p style={{ color: "var(--sub)", fontSize: 14, marginBottom: 24 }}>Run the analyzer to build your library from YouTube videos.</p>
      <code style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 20px", fontSize: 13, color: "var(--accent)", display: "block", maxWidth: 600, margin: "0 auto" }}>
        python3 ~/.claude/skills/broll/analyze.py &quot;https://youtube.com/watch?v=...&quot;
      </code>
    </div>
  );
}
