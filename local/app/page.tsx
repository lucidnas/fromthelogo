import Link from "next/link";
import { listVideos, getBrollStats } from "@/lib/studio";
import type { Video } from "@/lib/studio";
import { NewIdeaButton } from "@/components/NewIdeaButton";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["idea", "researched", "scripted", "vo", "rendered"] as const;

const FORMAT_COLOR: Record<string, string> = { A: "#06b6d4", B: "#7c6af7", C: "#f59e0b" };
const FORMAT_LABEL: Record<string, string> = { A: "Close-Up", B: "Face/Type", C: "Split" };

export default function Home() {
  const videos = listVideos();
  const broll = getBrollStats();

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    videos: videos.filter((v) => v.status === status),
  }));

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>FTL Studio</span>
          <span style={{ color: "var(--sub)", fontSize: 13 }}>local</span>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <NavLink href="/" label="Studio" />
          <NavLink href="/research" label="Research" />
          <NavLink href="/broll" label="B-Roll" />
        </nav>
      </header>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32, alignItems: "center" }}>
          <StatChip label="Total" value={videos.length} />
          <StatChip label="Ideas" value={byStatus[0].videos.length} />
          {broll && <StatChip label="B-roll" value={`${broll.activeClips} clips`} />}
          {broll && <StatChip label="Library" value={`${(broll.totalSecs / 3600).toFixed(1)}h`} />}
          <div style={{ marginLeft: "auto" }}>
            <NewIdeaButton />
          </div>
        </div>

        {/* Pipeline — 5 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr 1fr 1fr", gap: 20, alignItems: "start" }}>
          {byStatus.map(({ status, videos: sv }) => (
            <div key={status}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot status={status} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--sub)" }}>
                  {status === "idea" ? "Ideas" : status}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{sv.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: status === "idea" ? 12 : 8 }}>
                {sv.map((v) =>
                  status === "idea"
                    ? <IdeaCard key={v.slug} video={v} />
                    : <PipelineCard key={v.slug} video={v} />
                )}
                {sv.length === 0 && (
                  <div style={{ color: "var(--muted)", fontSize: 12, padding: "16px 0", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    {status === "idea" ? "No ideas yet" : "—"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ── Idea Card — thumbnail-first, MrBeast style ───────────────────────────────

function IdeaCard({ video }: { video: Video }) {
  const fmt = video.thumbnailFormat;
  const word = video.thumbnailWord;

  return (
    <Link href={`/videos/${video.slug}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          cursor: "pointer",
          transition: "border-color 0.15s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Thumbnail — 16:9 */}
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#0a0a14" }}>
          {video.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(135deg, #0a0a14 0%, #12102a 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {fmt === "B" && word ? (
                <span style={{ fontSize: 32, fontWeight: 900, color: "rgba(255,255,255,0.1)", letterSpacing: -1, textTransform: "uppercase" }}>
                  {word}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                  {fmt ? `Format ${fmt}` : "No thumbnail"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Title + format badge */}
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 6 }}>
            {video.title}
          </div>
          {fmt && (
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700,
              background: `${FORMAT_COLOR[fmt]}20`,
              color: FORMAT_COLOR[fmt],
              border: `1px solid ${FORMAT_COLOR[fmt]}40`,
            }}>
              {FORMAT_LABEL[fmt]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Pipeline Card — compact text ─────────────────────────────────────────────

function PipelineCard({ video }: { video: Video }) {
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
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", lineHeight: 1.35, marginBottom: 8 }}>
          {video.title}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {dots.map(({ key, has, label }) => (
            <span key={key} title={label} style={{
              fontSize: 9, padding: "2px 5px", borderRadius: 3,
              background: has ? "rgba(124,106,247,0.15)" : "transparent",
              color: has ? "var(--accent)" : "var(--muted)",
              border: `1px solid ${has ? "rgba(124,106,247,0.3)" : "var(--border)"}`,
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, color: "var(--sub)", textDecoration: "none" }}>
      {label}
    </Link>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px" }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idea: "var(--muted)",
    researched: "var(--yellow)",
    scripted: "var(--accent)",
    vo: "#06b6d4",
    rendered: "var(--green)",
  };
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[status] ?? "var(--muted)", display: "inline-block" }} />;
}
