import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { getVideo, readFile, VIDEOS_DIR } from "@/lib/studio";
import { VideoActions } from "./VideoActions";
import { ScriptPanel } from "./ScriptPanel";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function getTakes(slug: string) {
  const dir = path.join(VIDEOS_DIR, slug);
  try {
    return fs.readdirSync(dir)
      .filter(f => f.startsWith("vo-") && f.endsWith(".mp3"))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        // Extract voice name from filename: vo-{voice-name}-{timestamp}.mp3
        const parts = f.replace(".mp3", "").split("-");
        const ts = parseInt(parts[parts.length - 1]);
        const voiceName = parts.slice(1, -1).join(" ");
        return {
          name: f,
          voiceName: voiceName || "Unknown",
          timestamp: isNaN(ts) ? stat.mtimeMs : ts,
          src: `/api/assets/${slug}/${f}`,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch { return []; }
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = getVideo(slug);
  if (!video) notFound();

  const script = readFile(slug, "script.txt");
  const brief = readFile(slug, "brief.txt");
  const cueSheet = readFile(slug, "cue-sheet.txt");
  const takes = getTakes(slug);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ color: "var(--sub)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <ChevronLeft size={14} /> Videos
        </Link>
        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{video.title}</span>
        <StatusBadge status={video.status} />
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Left — content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Idea mode — thumbnail + concept front and center */}
          {video.status === "idea" && <IdeaConceptPanel video={video} />}

          {/* Pipeline checklist */}
          {video.status !== "idea" && <PipelineChecklist video={video} />}

          {/* Script */}
          {script && <ScriptPanel script={script} />}

          {/* Thumbnail brief */}
          {brief && (
            <Section title="Thumbnail Brief">
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--sub)", margin: 0 }}>
                {brief}
              </pre>
            </Section>
          )}

          {/* Cue sheet */}
          {cueSheet && (
            <Section title="Cue Sheet">
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, color: "var(--sub)", margin: 0 }}>
                {cueSheet}
              </pre>
            </Section>
          )}
        </div>

        {/* Right — actions */}
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          <VideoActions video={video} takes={takes} />
        </div>
      </main>
    </div>
  );
}

function Section({ title, wordCount, children }: { title: string; wordCount?: number; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
        {wordCount && <span style={{ fontSize: 12, color: "var(--sub)" }}>{wordCount.toLocaleString()} words</span>}
      </div>
      {children}
    </div>
  );
}

function PipelineChecklist({ video }: { video: NonNullable<ReturnType<typeof getVideo>> }) {
  const steps = [
    { label: "Script", done: video.hasScript },
    { label: "Brief", done: video.hasBrief },
    { label: "VO", done: video.hasVO },
    { label: "Thumbnail", done: video.hasThumbnail },
    { label: "Cue Sheet", done: video.hasCueSheet },
    { label: "Render", done: video.hasRender },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {steps.map(({ label, done }) => (
        <div key={label} style={{ flex: 1, padding: "10px 12px", background: "var(--surface)", border: `1px solid ${done ? "rgba(34,197,94,0.3)" : "var(--border)"}`, borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 2 }}>{done ? "✓" : "○"}</div>
          <div style={{ fontSize: 10, color: done ? "var(--green)" : "var(--sub)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

const FORMAT_LABEL: Record<string, string> = { A: "Format A — Pure Close-Up", B: "Format B — Face Through Type", C: "Format C — Split Screen" };
const FORMAT_HINT: Record<string, string> = {
  A: "Clark's face fills frame. No text. Expression carries the curiosity.",
  B: "One massive word overlapping Clark's face. She peeks through the letters.",
  C: "Villain left (angry), Clark right (unbothered), ripped divider, speech bubble.",
};

function IdeaConceptPanel({ video }: { video: NonNullable<ReturnType<typeof getVideo>> }) {
  const fmt = video.thumbnailFormat;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Thumbnail — large */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "linear-gradient(135deg, #0a0a14, #12102a)" }}>
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt={video.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {fmt === "B" && video.thumbnailWord && (
                <div style={{ fontSize: 80, fontWeight: 900, color: "rgba(255,255,255,0.06)", letterSpacing: -2, textTransform: "uppercase", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {video.thumbnailWord}
                </div>
              )}
              {fmt === "C" && video.thumbnailBubble && (
                <div style={{ background: "#fff", color: "#000", padding: "8px 16px", borderRadius: 6, fontSize: 14, fontWeight: 700, maxWidth: "60%", textAlign: "center" }}>
                  {video.thumbnailBubble}
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", position: "relative", zIndex: 1 }}>
                {fmt ? FORMAT_LABEL[fmt] : "No thumbnail yet"}
              </div>
            </div>
          )}
        </div>
        {fmt && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sub)", marginBottom: 2 }}>{FORMAT_LABEL[fmt]}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{FORMAT_HINT[fmt]}</div>
            {video.thumbnailWord && <div style={{ marginTop: 6, fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>KEY WORD: {video.thumbnailWord}</div>}
            {video.thumbnailBubble && <div style={{ marginTop: 6, fontSize: 12, color: "var(--yellow)" }}>BUBBLE: "{video.thumbnailBubble}"</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idea: "var(--muted)", researched: "var(--yellow)", scripted: "var(--accent)", vo: "#06b6d4", rendered: "var(--green)",
  };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: colors[status] ?? "var(--muted)", background: "var(--surface)", border: `1px solid ${colors[status] ?? "var(--border)"}`, borderRadius: 4, padding: "2px 8px" }}>
      {status.toUpperCase()}
    </span>
  );
}
