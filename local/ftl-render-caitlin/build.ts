/**
 * FTL Hyperframes Builder
 *
 * Reads cue-sheet.json for a video slug, symlinks assets, and generates
 * index.html for Hyperframes to preview and render.
 *
 * Usage:
 *   bun run build.ts <slug> [broll-group]
 *
 * Then:
 *   npx hyperframes preview      ← preview in browser
 *   npx hyperframes render --output output.mp4
 */

import fs from "fs";
import path from "path";

const SSD = "/Volumes/SSK SSD";
const FTL_DIR = `${SSD}/ftl`;
const BROLL_DIR = `${SSD}/broll`;

const slug = process.argv[2];
const brollGroup = process.argv[3] ?? "broll-1";

if (!slug) {
  console.error("Usage: bun run build.ts <slug> [broll-group]");
  process.exit(1);
}

const videoDir = `${FTL_DIR}/videos/${slug}`;
const voPath = `${videoDir}/vo.mp3`;
const editScriptJsonPath = `${videoDir}/edit-script-johnny.json`;
const cueJsonPath = `${videoDir}/cue-sheet.json`;
const assetsDir = path.join(import.meta.dir, "assets");
const indexPath = path.join(import.meta.dir, "index.html");

// ── Validate ────────────────────────────────────────────────────────────────

if (!fs.existsSync(voPath)) {
  console.error(`✗ No vo.mp3 at ${voPath}`);
  process.exit(1);
}

// ── Get VO duration via ffprobe ─────────────────────────────────────────────

async function getAudioDuration(p: string): Promise<number> {
  const proc = Bun.spawn(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", p]);
  const text = await new Response(proc.stdout).text();
  return parseFloat(JSON.parse(text).format.duration);
}

// ── Load or generate cues ───────────────────────────────────────────────────

interface Cue {
  startSecs: number;
  endSecs: number;
  type: "broll" | "stat_card" | "headline" | "tweet" | "illustrated_scene" | "edl_clip" | "split_montage";
  clipPath?: string;
  imagePath?: string;
  imageCaption?: string;
  sourceIn?: number | null;
  sourceOut?: number | null;
  treatment?: string;
  overlays?: string[];
  beat?: string;
  asset?: string;
  audioVolume?: number;
}

interface EdlCue {
  start: number;
  end: number;
  beat?: string;
  vo?: string;
  asset: string;
  assetPath?: string | null;
  sourceIn?: number | null;
  sourceOut?: number | null;
  treatment?: string;
  overlays?: string[];
  audioVolume?: number;
}

function buildSequentialBrollCues(durationSecs: number): Cue[] {
  const manifestPath = `${BROLL_DIR}/groups/manifest.json`;
  if (!fs.existsSync(manifestPath)) return [];

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const group = manifest[brollGroup];
  if (!group) return [];

  const cues: Cue[] = [];
  let t = 0;
  for (const clipName of group.clips) {
    if (t >= durationSecs) break;
    const clipPath = `${BROLL_DIR}/groups/${brollGroup}/${clipName}`;
    // Use real clip duration from library if possible, else 8s chunks
    const dur = Math.min(8, durationSecs - t);
    cues.push({ startSecs: t, endSecs: t + dur, type: "broll", clipPath });
    t += dur;
  }
  return cues;
}

// ── Symlink assets ──────────────────────────────────────────────────────────

function symlinkAsset(src: string, name: string): string {
  const dst = path.join(assetsDir, name);
  try { fs.unlinkSync(dst); } catch {}
  fs.symlinkSync(src, dst);
  return `assets/${name}`;
}

function renderedAssetPath(name: string): string {
  return path.join(assetsDir, name);
}

function ensureRenderedClip(src: string, name: string, durationSecs: number, sourceIn?: number | null, sourceOut?: number | null): string {
  const dst = renderedAssetPath(name);
  if (fs.existsSync(dst)) {
    const stat = fs.lstatSync(dst);
    if (!stat.isSymbolicLink()) return `assets/${name}`;
    fs.unlinkSync(dst);
  }

  const start = Math.max(0, sourceIn ?? 0);
  const span = sourceOut != null ? Math.max(0.1, sourceOut - start) : durationSecs;
  const needsLoop = durationSecs > span + 0.05;
  const args = [
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
  ];
  if (needsLoop) args.push("-stream_loop", "-1");
  args.push(
    "-ss",
    start.toFixed(3),
    "-i",
    src,
    "-t",
    durationSecs.toFixed(3),
    "-an",
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setpts=PTS-STARTPTS",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-r",
    "30",
    "-g",
    "30",
    "-keyint_min",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    dst,
  );

  const proc = Bun.spawnSync(args);
  if (!proc.success) {
    const err = new TextDecoder().decode(proc.stderr);
    throw new Error(`ffmpeg failed for ${path.basename(src)}: ${err}`);
  }
  return `assets/${name}`;
}

// ── Generate HTML ───────────────────────────────────────────────────────────

// Hyperframes uses seconds (not ms) for data-start / data-duration.
function toSecs(s: number) { return s.toFixed(3); }

function esc(s: string | undefined | null): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderEdlOverlay(cue: Cue, index: number, start: string, dur: string, trackIndex: number): string {
  const overlays = cue.overlays ?? [];
  if (overlays.length === 0 && !cue.beat) return "";
  const primary = overlays[0] ?? cue.beat ?? "";
  const secondary = overlays.slice(1);
  return `
    <div id="edl-overlay-${index}" class="clip edl-overlay"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1000}">
      <div class="edl-kicker">FTL FILM ROOM</div>
      <div class="edl-title">${esc(primary)}</div>
      ${secondary.length ? `<div class="edl-stack">${secondary.map((o) => `<span>${esc(o)}</span>`).join("")}</div>` : ""}
    </div>`;
}

const montageAssetMap: Record<string, string> = {
  "DRIVE": "first-layup-live.mp4",
  "RANGE": "first-three-live.mp4",
  "LOGO PRESSURE": "twenty-nine-three-live.mp4",
  "PASS": "boston-assist-live.mp4",
  "DOWNHILL": "first-layup-live.mp4",
  "26 FEET": "first-three-live.mp4",
  "29 FEET": "twenty-nine-three-live.mp4",
  "BOSTON": "boston-assist-live.mp4",
  "FOUR FEET": "thousand-replay-slow.mp4",
};

function renderSplitMontageHTML(cue: Cue, index: number): string {
  const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
  const totalDur = cue.endSecs - cue.startSecs;
  const itemDur = totalDur / labels.length;
  const cutsDir = `${BROLL_DIR}/aroll/${slug}/cuts`;
  return labels.map((label, itemIndex) => {
    const assetName = montageAssetMap[label] ?? montageAssetMap[label.toUpperCase()] ?? "thousand-live-official.mp4";
    const clipPath = `${cutsDir}/${assetName}`;
    const assetRef = ensureRenderedClip(clipPath, `edl-${index}-${itemIndex}-${assetName}`, itemDur, 0, null);
    const start = toSecs(cue.startSecs + itemDur * itemIndex);
    const dur = toSecs(itemDur);
    const trackIndex = index * 10 + itemIndex + 1;
    return `
    <!-- EDL split montage ${index}.${itemIndex}: ${esc(label)} -->
    <div style="position:absolute;inset:0;overflow:hidden;background:#000;">
      <video id="edl-video-${index}-${itemIndex}" class="clip broll-video edl-video montage-video"
             data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
             data-volume="0"
             src="${assetRef}" muted playsinline
             style="width:100%;height:100%;object-fit:cover;"></video>
      <div id="edl-overlay-${index}-${itemIndex}" class="clip edl-overlay montage-overlay"
           data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1000}">
        <div class="edl-kicker">RAPID READ</div>
        <div class="edl-title">${esc(label)}</div>
      </div>
    </div>`;
  }).join("\n");
}

function renderEdlClipHTML(cue: Cue, index: number): string {
  if (!cue.clipPath) return "";
  const start = toSecs(cue.startSecs);
  const dur = toSecs(cue.endSecs - cue.startSecs);
  const trackIndex = index + 1;
  const cueDur = cue.endSecs - cue.startSecs;
  const audioVolume = cue.audioVolume ?? 0;
  const assetName = `edl-${index}-${path.basename(cue.clipPath)}`;
  const assetRef = audioVolume > 0
    ? symlinkAsset(cue.clipPath, assetName)
    : ensureRenderedClip(cue.clipPath, assetName, cueDur, cue.sourceIn, cue.sourceOut);
  const src = assetRef;
  const mutedAttr = audioVolume > 0 ? "" : "muted";
  const audioAttr = audioVolume > 0 ? 'data-has-audio="true"' : "";

  return `
    <!-- EDL clip ${index}: ${esc(cue.beat ?? cue.asset ?? "")} -->
    <div style="position:absolute;inset:0;overflow:hidden;background:#000;">
      <video id="edl-video-${index}" class="clip broll-video edl-video"
             data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
             data-volume="${audioVolume}"
             ${audioAttr}
             src="${src}" ${mutedAttr} playsinline
             style="width:100%;height:100%;object-fit:cover;"></video>
      ${renderEdlOverlay(cue, index, start, dur, trackIndex)}
    </div>`;
}

function loadEditScriptCues(): Cue[] {
  const data = JSON.parse(fs.readFileSync(editScriptJsonPath, "utf8"));
  return (data.cues as EdlCue[]).map((cue) => ({
    startSecs: cue.start,
    endSecs: cue.end,
    type: cue.asset === "split-montage" ? "split_montage" : "edl_clip",
    clipPath: cue.assetPath ?? undefined,
    sourceIn: cue.sourceIn,
    sourceOut: cue.sourceOut,
    treatment: cue.treatment,
    overlays: cue.overlays ?? [],
    beat: cue.beat,
    asset: cue.asset,
    audioVolume: cue.audioVolume,
  }));
}

function renderCueHTML(cue: Cue, index: number): string {
  const start = toSecs(cue.startSecs);
  const dur   = toSecs(cue.endSecs - cue.startSecs);
  const trackIndex = index + 1;

  if (cue.type === "edl_clip") {
    return renderEdlClipHTML(cue, index);
  }

  if (cue.type === "split_montage") {
    return renderSplitMontageHTML(cue, index);
  }

  if (cue.type === "broll" && cue.clipPath) {
    const assetName = `clip-${index}-${path.basename(cue.clipPath)}`;
    const assetRef = symlinkAsset(cue.clipPath, assetName);
    // Timing attrs go on the <video> element directly so Hyperframes can play/pause it.
    // Wrapper div is positioning-only (no data attrs, no class="clip").
    return `
    <!-- B-roll clip ${index} -->
    <div style="position:absolute;inset:0;overflow:hidden;">
      <video id="broll-${index}" class="clip broll-video"
             data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
             data-volume="0"
             src="${assetRef}" muted playsinline
             style="width:100%;height:100%;object-fit:cover;"></video>
    </div>`;
  }

  // When an AI-generated image exists, always prefer it over the CSS card.
  // This covers stat_card, headline, tweet, and illustrated_scene.
  if (cue.imagePath && fs.existsSync(cue.imagePath)) {
    const assetName = `image-${index}-${path.basename(cue.imagePath)}`;
    const assetRef = symlinkAsset(cue.imagePath, assetName);
    return `
    <!-- AI image ${index} (${cue.type}) -->
    <div class="clip" id="img-cue-${index}" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
         style="position:absolute;inset:0;background:#010b1f;opacity:0;">
      <img src="${assetRef}" style="width:100%;height:100%;object-fit:contain;" />
    </div>`;
  }

  if (cue.type === "stat_card") {
    const parts = (cue.imageCaption ?? "").split("—");
    const stat = parts[0]?.trim() ?? "";
    const label = parts[1]?.trim() ?? "";
    return `
    <!-- Stat card ${index} (CSS fallback) -->
    <div class="clip stat-card-wrap" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
         style="position:absolute;inset:0;opacity:0;">
      <div class="stat-bg"></div>
      <div class="stat-content">
        <div class="stat-accent" id="stat-accent-${index}"></div>
        <div class="stat-number" id="stat-number-${index}">${stat}</div>
        <div class="stat-label" id="stat-label-${index}">${label}</div>
      </div>
      <div class="stat-bar-bottom"></div>
    </div>`;
  }

  if (cue.type === "headline") {
    const raw = cue.imageCaption ?? "";
    const colonIdx = raw.indexOf(":");
    const source = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : "ESPN";
    const text = colonIdx > 0 ? raw.slice(colonIdx + 1).trim() : raw;
    return `
    <!-- Headline ${index} (CSS fallback) -->
    <div class="clip headline-wrap" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
         style="position:absolute;inset:0;background:#010b1f;opacity:0;">
      <div class="hl-panel"></div>
      <div class="hl-content">
        <div class="hl-source" id="hl-source-${index}">${source}</div>
        <div class="hl-text" id="hl-text-${index}">${text}</div>
        <div class="hl-line" id="hl-line-${index}"></div>
      </div>
      <div class="hl-bar-bottom"></div>
    </div>`;
  }

  if (cue.type === "tweet") {
    return `
    <!-- Tweet ${index} (CSS fallback) -->
    <div class="clip tweet-wrap" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
         style="position:absolute;inset:0;background:#000;opacity:0;">
      <div class="tweet-card" id="tweet-card-${index}" style="opacity:0;">
        <div class="tweet-header">
          <div class="tweet-avatar"></div>
          <div><div class="tweet-name">Reporter</div></div>
          <div class="tweet-x">𝕏</div>
        </div>
        <div class="tweet-body">"${cue.imageCaption ?? ""}"</div>
        <div class="tweet-footer">🔁 Retweets &nbsp; ❤️ Likes</div>
      </div>
    </div>`;
  }

  return "";
}

// ── GSAP timeline builder ───────────────────────────────────────────────────

function renderGSAP(cues: Cue[]): string {
  const lines: string[] = [];
  cues.forEach((cue, i) => {
    const at = cue.startSecs;
    // AI-generated image: simple fade-in (no CSS card animations needed)
    if (cue.imagePath && fs.existsSync(cue.imagePath) && cue.type !== "broll") {
      lines.push(`  tl.fromTo("#img-cue-${i}", { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: 0.4, ease: "expo.out" }, ${at});`);
      return;
    }
    if (cue.type === "stat_card") {
      // Scene fade in
      lines.push(`  tl.to(".stat-card-wrap:nth-of-type(${i + 1})", { opacity: 1, duration: 0.2 }, ${at});`);
      // Gold bar sweeps from left (scaleX 0→1) — power4.out snaps it in
      lines.push(`  tl.to("#stat-accent-${i}", { scaleX: 1, duration: 0.35, ease: "power4.out" }, ${at + 0.12});`);
      // Number: gravity entrance (scale + opacity) — expo.out
      lines.push(`  tl.fromTo("#stat-number-${i}", { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.45, ease: "expo.out" }, ${at + 0.28});`);
      // Label: slides up — different ease from number
      lines.push(`  tl.fromTo("#stat-label-${i}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.32, ease: "power3.out" }, ${at + 0.58});`);
    } else if (cue.type === "headline") {
      // Scene fade in
      lines.push(`  tl.to(".headline-wrap:nth-of-type(${i + 1})", { opacity: 1, duration: 0.2 }, ${at});`);
      // Source badge snaps in from left — power4.out
      lines.push(`  tl.fromTo("#hl-source-${i}", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.28, ease: "power4.out" }, ${at + 0.12});`);
      // Headline text slides up — expo.out (different from badge)
      lines.push(`  tl.fromTo("#hl-text-${i}", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.42, ease: "expo.out" }, ${at + 0.28});`);
      // Rule sweeps across — structural reveal last
      lines.push(`  tl.to("#hl-line-${i}", { width: "100%", duration: 0.5, ease: "power3.out" }, ${at + 0.62});`);
    } else if (cue.type === "tweet") {
      lines.push(`  tl.to(".tweet-wrap:nth-of-type(${i + 1})", { opacity: 1, duration: 0.2 }, ${at});`);
      lines.push(`  tl.to("#tweet-card-${i}", { opacity: 1, duration: 0.3 }, ${at});`);
      lines.push(`  tl.from("#tweet-card-${i}", { y: 28, duration: 0.45, ease: "power2.out" }, ${at});`);
    } else if (cue.type === "edl_clip") {
      const dur = cue.endSecs - cue.startSecs;
      const zoom = cue.treatment?.includes("112%") ? 1.12 : cue.treatment?.includes("108%") ? 1.08 : cue.treatment?.includes("106") ? 1.06 : cue.treatment?.includes("104") ? 1.04 : 1.035;
      lines.push(`  tl.fromTo("#edl-video-${i}", { scale: 1 }, { scale: ${zoom}, duration: ${Math.max(0.5, dur)}, ease: "none" }, ${at});`);
      lines.push(`  tl.fromTo("#edl-overlay-${i}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, ${at + 0.15});`);
      lines.push(`  tl.to("#edl-overlay-${i}", { opacity: 0, duration: 0.25, ease: "power2.in" }, ${Math.max(at + 0.5, cue.endSecs - 0.45)});`);
    } else if (cue.type === "split_montage") {
      const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
      const itemDur = (cue.endSecs - cue.startSecs) / labels.length;
      labels.forEach((_, itemIndex) => {
        const itemAt = cue.startSecs + itemDur * itemIndex;
        lines.push(`  tl.fromTo("#edl-video-${i}-${itemIndex}", { scale: 1.02 }, { scale: 1.09, duration: ${Math.max(0.2, itemDur)}, ease: "none" }, ${itemAt});`);
        lines.push(`  tl.fromTo("#edl-overlay-${i}-${itemIndex}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, ${itemAt + 0.05});`);
      });
    }
  });
  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(assetsDir, { recursive: true });

  const durationSecs = await getAudioDuration(voPath);
  console.log(`✓ VO duration: ${Math.floor(durationSecs / 60)}:${Math.round(durationSecs % 60).toString().padStart(2, "0")}`);

  // Symlink VO
  const voAsset = symlinkAsset(voPath, "vo.mp3");

  // Load or generate cues
  let cues: Cue[];
  if (fs.existsSync(editScriptJsonPath)) {
    cues = loadEditScriptCues();
    console.log(`✓ Loaded ${cues.length} cues from edit-script-johnny.json`);
  } else if (fs.existsSync(cueJsonPath)) {
    cues = JSON.parse(fs.readFileSync(cueJsonPath, "utf8"));
    console.log(`✓ Loaded ${cues.length} cues from cue-sheet.json`);
  } else {
    cues = buildSequentialBrollCues(durationSecs);
    console.log(`⚠ No cue-sheet.json — built ${cues.length} sequential broll cues from ${brollGroup}`);
  }

  const totalSecs = durationSecs.toFixed(3);
  const cueHTML = cues.map((c, i) => renderCueHTML(c, i)).join("\n");
  const gsapCode = renderGSAP(cues);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #000; }

      /* B-roll */
      .broll-video { width: 100%; height: 100%; object-fit: cover; transform-origin: center center; }
      .edl-video { will-change: transform; }
      .edl-overlay { position: absolute; left: 56px; top: 50px; width: 900px; opacity: 0; pointer-events: none; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; z-index: 20; }
      .edl-kicker { display: inline-block; background: #c8102e; color: #fff; font-size: 18px; font-weight: 900; letter-spacing: 0.08em; padding: 8px 14px; border-radius: 4px; margin-bottom: 10px; box-shadow: 0 10px 26px rgba(0,0,0,0.45); }
      .edl-title { display: block; width: fit-content; max-width: 900px; background: rgba(1,11,31,0.82); color: #ffe000; font-size: 46px; font-weight: 950; line-height: 1.02; letter-spacing: 0; padding: 14px 18px 16px; border-left: 7px solid #ffe000; text-transform: uppercase; box-shadow: 0 18px 42px rgba(0,0,0,0.5); }
      .edl-stack { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; max-width: 1120px; }
      .edl-stack span { display: inline-block; background: rgba(255,255,255,0.92); color: #010b1f; font-size: 24px; font-weight: 900; letter-spacing: 0; padding: 8px 12px; border-radius: 4px; box-shadow: 0 10px 22px rgba(0,0,0,0.32); }
      .montage-overlay { left: 48px; top: auto; bottom: 62px; }
      .montage-overlay .edl-kicker { background: #010b1f; color: #fff; }
      .montage-overlay .edl-title { font-size: 54px; background: rgba(200,16,46,0.9); color: #fff; border-left-color: #ffe000; }

      /* ── FTL Palette: Indiana Fever (gold #ffe000, red #c8102e, navy #010b1f) ── */

      /* Stat card */
      .stat-bg { position: absolute; inset: 0; background: linear-gradient(160deg, #010b1f 0%, #021530 100%); }
      /* Gold accent bar — swept in via scaleX in GSAP */
      .stat-accent { width: 100px; height: 6px; background: #ffe000; border-radius: 3px; transform-origin: left center; transform: scaleX(0); margin-bottom: 36px; }
      /* Content zone — flex, left-anchored, proper padding */
      .stat-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 200px; box-sizing: border-box; }
      .stat-number { font-size: 148px; font-weight: 900; color: #fff; letter-spacing: -5px; font-family: system-ui; line-height: 1; opacity: 0; margin-bottom: 28px; }
      .stat-label { font-size: 32px; font-weight: 700; color: #ffe000; letter-spacing: 0.14em; text-transform: uppercase; font-family: system-ui; opacity: 0; }
      .stat-bar-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #c8102e 0%, #ffe000 50%, #002d62 100%); }

      /* Headline */
      /* Content zone — flex, left-anchored */
      .hl-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 200px 0 160px; box-sizing: border-box; }
      .hl-source { display: inline-block; background: #c8102e; color: #fff; font-size: 20px; font-weight: 800; letter-spacing: 0.1em; padding: 8px 24px; border-radius: 4px; text-transform: uppercase; font-family: system-ui; opacity: 0; margin-bottom: 28px; }
      .hl-text { font-size: 68px; font-weight: 800; color: #fff; line-height: 1.18; letter-spacing: -1px; font-family: system-ui; opacity: 0; max-width: 1400px; margin-bottom: 40px; }
      .hl-line { height: 4px; width: 0; background: linear-gradient(90deg, #c8102e 0%, #ffe000 60%, transparent 100%); border-radius: 2px; max-width: 1400px; }
      .hl-panel { position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: linear-gradient(180deg, #c8102e 0%, #ffe000 100%); }
      .hl-bar-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #c8102e 0%, #ffe000 50%, #002d62 100%); }

      /* Tweet */
      .tweet-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 860px; background: #16181c; border-radius: 20px; padding: 36px 40px; box-shadow: 0 0 100px rgba(0,0,0,0.9); }
      .tweet-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
      .tweet-avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1d9bf0, #0a4f8a); flex-shrink: 0; }
      .tweet-name { font-size: 20px; font-weight: 700; color: #e7e9ea; font-family: system-ui; }
      .tweet-x { margin-left: auto; font-size: 26px; color: #e7e9ea; }
      .tweet-body { font-size: 30px; color: #e7e9ea; line-height: 1.55; font-family: system-ui; }
      .tweet-footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #2f3336; font-size: 16px; color: #71767b; font-family: system-ui; }
    </style>
  </head>
  <body>
    <div id="root"
         data-composition-id="ftl-${slug}"
         data-start="0"
         data-duration="${totalSecs}"
         data-width="1920"
         data-height="1080">

      <!-- VO Audio -->
      <audio id="vo-audio" class="clip" src="${voAsset}"
             data-start="0" data-duration="${totalSecs}" data-track-index="0"></audio>

      ${cueHTML}

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

${gsapCode}

      window.__timelines["ftl-${slug}"] = tl;
    </script>
  </body>
</html>`;

  fs.writeFileSync(indexPath, html);
  console.log(`\n✓ index.html generated (${cues.length} cues, ${Math.round(durationSecs / 60)}min)`);
  console.log(`\nNext steps:`);
  console.log(`  npx hyperframes preview          ← preview in browser`);
  console.log(`  npx hyperframes render --output /Volumes/SSK\\ SSD/ftl/videos/${slug}/render/final.mp4`);
}

main().catch(err => { console.error("✗", err.message); process.exit(1); });
