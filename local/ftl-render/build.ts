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
const flatBackgroundPath = `${videoDir}/flat-background.mp4`;
const useFlatBackground = process.env.FTL_FLAT_BACKGROUND === "1" && fs.existsSync(flatBackgroundPath);
const assetsDir = path.join(import.meta.dir, "assets");
const indexPath = path.join(import.meta.dir, "index.html");

// ── Validate ────────────────────────────────────────────────────────────────

if (!fs.existsSync(voPath)) {
  console.error(`✗ No vo.mp3 at ${voPath}`);
  process.exit(1);
}

if (!fs.existsSync(editScriptJsonPath)) {
  console.error(`✗ No edit-script-johnny.json at ${editScriptJsonPath}`);
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
  playbackRate?: number | null;
  treatment?: string;
  overlays?: string[];
  graphics?: FilmRoomGraphic[];
  freezeFrames?: FreezeFrame[];
  overlayPosition?: "default" | "scorebug-cover";
  visualMode?: "full" | "overlay";
  backgroundPath?: string;
  beat?: string;
  asset?: string;
  audioVolume?: number;
  hideOverlays?: boolean;
}

interface FilmRoomGraphic {
  type: "ring" | "arrow" | "label" | "line";
  startOffset?: number;
  duration?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  color?: string;
  size?: number;
}

interface FreezeFrame {
  startOffset: number;
  duration: number;
  frameOffset?: number;
  sourceTime?: number;
  zoomFrom?: number;
  zoomTo?: number;
  x?: number;
  y?: number;
  label?: string;
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
  playbackRate?: number | null;
  treatment?: string;
  overlays?: string[];
  graphics?: FilmRoomGraphic[];
  freezeFrames?: FreezeFrame[];
  overlayPosition?: "default" | "scorebug-cover";
  audioVolume?: number;
  hideOverlays?: boolean;
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

function ensureRenderedClip(src: string, name: string, durationSecs: number, sourceIn?: number | null, sourceOut?: number | null, playbackRate?: number | null): string {
  const dst = renderedAssetPath(name);
  if (fs.existsSync(dst)) {
    fs.unlinkSync(dst);
  }

  const start = Math.max(0, sourceIn ?? 0);
  const span = sourceOut != null ? Math.max(0.1, sourceOut - start) : durationSecs;
  const needsLoop = durationSecs > span + 0.05;
  const rate = Number.isFinite(Number(playbackRate)) ? Math.max(0.25, Math.min(2, Number(playbackRate))) : 1;
  const setPts = rate === 1 ? "setpts=PTS-STARTPTS" : `setpts=${(1 / rate).toFixed(6)}*(PTS-STARTPTS)`;
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
    `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,${setPts}`,
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

function ensureRenderedAudio(src: string, name: string, durationSecs: number, sourceIn?: number | null): string | null {
  const dst = renderedAssetPath(name);
  if (fs.existsSync(dst)) {
    const stat = fs.lstatSync(dst);
    if (!stat.isSymbolicLink()) return `assets/${name}`;
    fs.unlinkSync(dst);
  }

  const args = [
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, sourceIn ?? 0).toFixed(3),
    "-i",
    src,
    "-t",
    durationSecs.toFixed(3),
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    dst,
  ];

  const proc = Bun.spawnSync(args);
  if (!proc.success) return null;
  return `assets/${name}`;
}

function ensureRenderedFreezeFrame(src: string, name: string, sourceTime: number): string {
  const dst = renderedAssetPath(name);
  if (fs.existsSync(dst)) {
    fs.unlinkSync(dst);
  }

  const args = [
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, sourceTime).toFixed(3),
    "-i",
    src,
    "-frames:v",
    "1",
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba",
    dst,
  ];

  const proc = Bun.spawnSync(args);
  if (!proc.success) {
    const err = new TextDecoder().decode(proc.stderr);
    throw new Error(`ffmpeg freeze frame failed for ${path.basename(src)}: ${err}`);
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
  if (cue.hideOverlays) return "";
  const overlays = cue.overlays ?? [];
  if (overlays.length === 0) return "";
  const primary = overlays[0] ?? "";
  const secondary = overlays.slice(1);
  const positionClass = cue.overlayPosition === "scorebug-cover" ? " scorebug-cover" : "";
  return `
    <div id="edl-overlay-${index}" class="clip edl-overlay${positionClass}"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1000}">
      <div class="edl-kicker">FTL FILM ROOM</div>
      <div class="edl-title">${esc(primary)}</div>
      ${secondary.length ? `<div class="edl-stack">${secondary.map((o) => `<span>${esc(o)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function renderAudioCue(cue: Cue, index: number, start: string, dur: string, trackIndex: number): string {
  if (!cue.clipPath || !cue.audioVolume || cue.audioVolume <= 0) return "";
  const audioName = `audio-${index}-${path.basename(cue.clipPath).replace(/\.[^.]+$/, "")}.m4a`;
  const assetRef = ensureRenderedAudio(cue.clipPath, audioName, cue.endSecs - cue.startSecs, cue.sourceIn);
  if (!assetRef) return "";
  return `
    <audio id="cue-audio-${index}" class="clip"
           data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 5000}"
           data-volume="${cue.audioVolume}"
           src="${assetRef}"></audio>`;
}

function renderImageOverlay(cue: Cue, index: number, start: string, dur: string, trackIndex: number): string {
  if (!cue.imagePath || !fs.existsSync(cue.imagePath)) return "";
  const assetName = `image-${index}-${path.basename(cue.imagePath)}`;
  const assetRef = symlinkAsset(cue.imagePath, assetName);
  const mode = cue.visualMode ?? (cue.treatment?.toLowerCase().includes("overlay") ? "overlay" : "full");

  if (mode === "overlay") {
    return `
    <!-- Full-screen image overlay ${index} -->
    <div class="clip image-overlay-wrap image-fullscreen-overlay" id="img-cue-${index}"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1500}">
      <img class="ken-burns-image" src="${assetRef}" />
    </div>`;
  }

  return `
    <!-- Full-frame image ${index} -->
    <div class="clip image-full-wrap" id="img-cue-${index}"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}">
      <img class="ken-burns-image" src="${assetRef}" />
    </div>`;
}

function pct(n: number | undefined, fallback: number): string {
  return `${(n ?? fallback).toFixed(2)}%`;
}

function renderFilmRoomGraphic(cue: Cue, index: number, graphic: FilmRoomGraphic, graphicIndex: number, trackIndex: number): string {
  const start = toSecs(cue.startSecs + (graphic.startOffset ?? 0));
  const duration = toSecs(graphic.duration ?? Math.max(0.8, cue.endSecs - cue.startSecs - (graphic.startOffset ?? 0)));
  const color = esc(graphic.color ?? "#ffe000");
  const id = `film-graphic-${index}-${graphicIndex}`;
  const label = graphic.text ? `<div class="film-label-inline">${esc(graphic.text)}</div>` : "";

  if (graphic.type === "ring") {
    return `
      <div id="${id}" class="clip film-graphic film-ring"
           data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}"
           style="left:${pct(graphic.x, 50)};top:${pct(graphic.y, 50)};width:${pct(graphic.w, 12)};height:${pct(graphic.h, 18)};--film-color:${color};">
        ${label}
      </div>`;
  }

  if (graphic.type === "label") {
    const size = graphic.size ? `font-size:${Number(graphic.size)}px;` : "";
    return `
      <div id="${id}" class="clip film-graphic film-callout"
           data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}"
           style="left:${pct(graphic.x, 50)};top:${pct(graphic.y, 50)};--film-color:${color};${size}">
        ${esc(graphic.text ?? "")}
      </div>`;
  }

  if (graphic.type === "line") {
    const x1 = graphic.x1 ?? 20;
    const y1 = graphic.y1 ?? 50;
    const x2 = graphic.x2 ?? 80;
    const y2 = graphic.y2 ?? 50;
    return `
      <svg id="${id}" class="clip film-graphic film-svg"
           data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}"
           viewBox="0 0 100 100" preserveAspectRatio="none">
        <line class="film-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" />
      </svg>`;
  }

  const x1 = graphic.x1 ?? 20;
  const y1 = graphic.y1 ?? 50;
  const x2 = graphic.x2 ?? 80;
  const y2 = graphic.y2 ?? 50;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const length = Math.sqrt(dx * dx + dy * dy);
  return `
      <div id="${id}" class="clip film-graphic film-arrow-wrap"
           data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}"
           style="left:${x1}%;top:${y1}%;width:${length}%;transform:rotate(${angle}deg);--film-color:${color};--arrow-label-rotation:${-angle}deg;">
        <div class="film-arrow-line"></div>
        <div class="film-arrow-head"></div>
        ${graphic.text ? `<div class="film-arrow-label">${esc(graphic.text)}</div>` : ""}
      </div>`;
}

function renderFilmRoomGraphics(cue: Cue, index: number, trackIndex: number): string {
  return (cue.graphics ?? [])
    .map((graphic, graphicIndex) => renderFilmRoomGraphic(cue, index, graphic, graphicIndex, trackIndex + 2000 + graphicIndex))
    .join("");
}

function renderFreezeFrames(cue: Cue, index: number, trackIndex: number): string {
  if (!cue.clipPath) return "";
  const clipPath = cue.clipPath;
  return (cue.freezeFrames ?? []).map((freeze, freezeIndex) => {
    const sourceTime = freeze.sourceTime ?? ((cue.sourceIn ?? 0) + (freeze.frameOffset ?? freeze.startOffset));
    const assetName = `freeze-${index}-${freezeIndex}-${path.basename(clipPath)}.png`;
    const assetRef = ensureRenderedFreezeFrame(clipPath, assetName, sourceTime);
    const start = toSecs(cue.startSecs + freeze.startOffset);
    const dur = toSecs(freeze.duration);
    const transformOrigin = `${pct(freeze.x, 50)} ${pct(freeze.y, 50)}`;
    return `
    <div id="freeze-frame-${index}-${freezeIndex}" class="clip freeze-frame-wrap"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 700 + freezeIndex}">
      <img class="freeze-frame-image" src="${assetRef}" style="transform-origin:${transformOrigin};" />
      ${freeze.label ? `<div class="freeze-frame-label">${esc(freeze.label)}</div>` : ""}
    </div>`;
  }).join("");
}

const montageAssetMap: Record<string, string> = {
  "DRIVE": "first-layup-live.mp4",
  "RANGE": "first-three-live.mp4",
  "LOGO PRESSURE": "twenty-nine-three-live.mp4",
  "PASS": "boston-assist-live.mp4",
  "PASS = LAYUP": "boston-assist-live.mp4",
  "DOWNHILL": "first-layup-live.mp4",
  "26 FEET": "first-three-live.mp4",
  "29 FEET": "twenty-nine-three-live.mp4",
  "HINES-ALLEN": "boston-assist-live.mp4",
  "BOSTON": "boston-assist-live.mp4",
  "FOUR FEET": "thousand-live-official.mp4",
  "THE MENU": "first-layup-live.mp4",
  "TOO MANY VERSIONS": "twenty-nine-three-live.mp4",
};

function renderSplitMontageHTML(cue: Cue, index: number): string {
  if (cue.hideOverlays) return renderFilmRoomGraphics(cue, index, index + 1);
  const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
  const totalDur = cue.endSecs - cue.startSecs;
  const itemDur = totalDur / labels.length;
  const cutsDir = `${BROLL_DIR}/aroll/${slug}/cuts`;
  const clips = labels.map((label, itemIndex) => {
    const assetName = montageAssetMap[label] ?? montageAssetMap[label.toUpperCase()] ?? "thousand-live-official.mp4";
    const clipPath = `${cutsDir}/${assetName}`;
    const assetRef = ensureRenderedClip(clipPath, `edl-${index}-${itemIndex}-${assetName}`, itemDur, 0, null);
    const start = toSecs(cue.startSecs + itemDur * itemIndex);
    const dur = toSecs(itemDur);
    const trackIndex = index * 10 + itemIndex + 1;
    return `
    <!-- EDL split montage ${index}.${itemIndex}: ${esc(label)} -->
    <div data-layout-allow-overflow style="position:absolute;inset:0;overflow:hidden;">
      <video id="edl-video-${index}-${itemIndex}" class="clip broll-video edl-video montage-video"
             data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
             data-volume="0"
             src="${assetRef}" muted playsinline
             style="width:100%;height:100%;object-fit:cover;"></video>
    </div>
    <div id="edl-overlay-${index}-${itemIndex}" class="clip edl-overlay montage-overlay"
         data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1000}">
      <div class="edl-kicker">RAPID READ</div>
      <div class="edl-title">${esc(label)}</div>
    </div>`;
  }).join("\n");
  return `${clips}\n${renderFilmRoomGraphics(cue, index, index + 1)}`;
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
    : ensureRenderedClip(cue.clipPath, assetName, cueDur, cue.sourceIn, cue.sourceOut, cue.playbackRate);
  const src = assetRef;
  const mutedAttr = audioVolume > 0 ? "" : "muted";
  const audioAttr = audioVolume > 0 ? 'data-has-audio="true"' : "";

  return `
    <!-- EDL clip ${index}: ${esc(cue.beat ?? cue.asset ?? "")} -->
    <div data-layout-allow-overflow style="position:absolute;inset:0;overflow:hidden;">
      <video id="edl-video-${index}" class="clip broll-video edl-video"
             data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"
             data-volume="${audioVolume}"
             ${audioAttr}
             src="${src}" ${mutedAttr} playsinline
             style="width:100%;height:100%;object-fit:cover;"></video>
    </div>
    ${renderEdlOverlay(cue, index, start, dur, trackIndex)}
    ${renderFreezeFrames(cue, index, trackIndex)}
    ${renderFilmRoomGraphics(cue, index, trackIndex)}`;
}

function loadEditScriptCues(): Cue[] {
  const data = JSON.parse(fs.readFileSync(editScriptJsonPath, "utf8"));
  return (data.cues as EdlCue[]).map((cue) => ({
    startSecs: cue.start,
    endSecs: cue.end,
    type: cue.asset === "split-montage"
      ? "split_montage"
      : cue.assetPath && /\.(jpe?g|png|webp)$/i.test(cue.assetPath)
        ? "illustrated_scene"
        : "edl_clip",
    clipPath: cue.assetPath && !/\.(jpe?g|png|webp)$/i.test(cue.assetPath) ? cue.assetPath : undefined,
    imagePath: cue.assetPath && /\.(jpe?g|png|webp)$/i.test(cue.assetPath) ? cue.assetPath : undefined,
    sourceIn: cue.sourceIn,
    sourceOut: cue.sourceOut,
    playbackRate: cue.playbackRate,
    treatment: cue.treatment,
    overlays: cue.overlays ?? [],
    graphics: cue.graphics ?? [],
    freezeFrames: cue.freezeFrames ?? [],
    overlayPosition: (cue as EdlCue).overlayPosition ?? "default",
    visualMode: (cue as EdlCue & { visualMode?: "full" | "overlay" }).visualMode,
    backgroundPath: (cue as EdlCue & { backgroundPath?: string }).backgroundPath,
    beat: cue.beat,
    asset: cue.asset,
    audioVolume: cue.audioVolume,
    hideOverlays: cue.hideOverlays,
  }));
}

function renderCueHTML(cue: Cue, index: number): string {
  const start = toSecs(cue.startSecs);
  const dur   = toSecs(cue.endSecs - cue.startSecs);
  const trackIndex = index + 1;

  if (useFlatBackground && (cue.type === "edl_clip" || cue.type === "illustrated_scene")) {
    return `
    <!-- Flat-background overlay cue ${index}: ${esc(cue.beat ?? cue.asset ?? "")} -->
    ${renderAudioCue(cue, index, start, dur, trackIndex)}
    ${cue.type === "illustrated_scene" ? renderImageOverlay(cue, index, start, dur, trackIndex) : ""}
    ${renderFreezeFrames(cue, index, trackIndex)}
    ${renderEdlOverlay(cue, index, start, dur, trackIndex)}
    ${renderFilmRoomGraphics(cue, index, trackIndex)}`;
  }

  if (useFlatBackground && cue.type === "split_montage") {
    if (cue.hideOverlays) return renderFilmRoomGraphics(cue, index, index + 1);
    const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
    const totalDur = cue.endSecs - cue.startSecs;
    const itemDur = totalDur / labels.length;
    const overlays = labels.map((label, itemIndex) => {
      const itemStart = toSecs(cue.startSecs + itemDur * itemIndex);
      const itemDuration = toSecs(itemDur);
      const itemTrackIndex = index * 10 + itemIndex + 1;
      return `
    <div id="edl-overlay-${index}-${itemIndex}" class="clip edl-overlay montage-overlay"
         data-start="${itemStart}" data-duration="${itemDuration}" data-track-index="${itemTrackIndex + 1000}">
      <div class="edl-kicker">RAPID READ</div>
      <div class="edl-title">${esc(label)}</div>
    </div>`;
    }).join("\n");
    return `${overlays}\n${renderFilmRoomGraphics(cue, index, index + 1)}`;
  }

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
    return `
    ${renderImageOverlay(cue, index, start, dur, trackIndex)}
    ${renderEdlOverlay(cue, index, start, dur, trackIndex)}
    ${renderFilmRoomGraphics(cue, index, trackIndex)}`;
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
      const dur = cue.endSecs - cue.startSecs;
      const imageSel = `#img-cue-${i}`;
      const imageInnerSel = `#img-cue-${i} .ken-burns-image`;
      const mode = cue.visualMode ?? (cue.treatment?.toLowerCase().includes("overlay") ? "overlay" : "full");
      if (mode === "overlay") {
        lines.push(`  tl.fromTo("${imageSel}", { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" }, ${at});`);
        lines.push(`  tl.fromTo("${imageInnerSel}", { scale: 1, x: 0, y: 0 }, { scale: 1.08, x: -16, y: 0, duration: ${Math.max(0.5, dur)}, ease: "none" }, ${at});`);
        lines.push(`  tl.to("${imageSel}", { opacity: 0, duration: 0.25, ease: "power2.in" }, ${Math.max(at + 0.5, cue.endSecs - 0.35)});`);
      } else {
        lines.push(`  tl.fromTo("${imageSel}", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, ${at});`);
        lines.push(`  tl.fromTo("${imageInnerSel}", { scale: 1, x: 0, y: 0 }, { scale: 1.08, x: -16, y: 0, duration: ${Math.max(0.5, dur)}, ease: "none" }, ${at});`);
      }
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
      if (!useFlatBackground) {
        lines.push(`  tl.fromTo("#edl-video-${i}", { scale: 1 }, { scale: ${zoom}, duration: ${Math.max(0.5, dur)}, ease: "none" }, ${at});`);
      }
      if (!cue.hideOverlays && (cue.overlays ?? []).length > 0) {
        const overlayFrom = i % 3 === 1
          ? `{ opacity: 0, x: -160, scale: 0.94 }`
          : i % 3 === 2
            ? `{ opacity: 0, x: 120, y: 24, scale: 0.96 }`
            : `{ opacity: 0, y: 86, scale: 0.92 }`;
        const overlayEase = i % 3 === 1 ? "expo.out" : i % 3 === 2 ? "power4.out" : "back.out(1.45)";
        const overlayDur = i % 3 === 1 ? 0.42 : i % 3 === 2 ? 0.28 : 0.34;
        lines.push(`  tl.fromTo("#edl-overlay-${i}", ${overlayFrom}, { opacity: 1, x: 0, y: 0, scale: 1, duration: ${overlayDur}, ease: "${overlayEase}" }, ${at + 0.04});`);
        lines.push(`  tl.to("#edl-overlay-${i}", { opacity: 0, y: -18, duration: 0.18, ease: "power2.in" }, ${Math.max(at + 0.65, cue.endSecs - 0.22)});`);
        lines.push(`  tl.set("#edl-overlay-${i}", { opacity: 0 }, ${cue.endSecs});`);
      }
      (cue.graphics ?? []).forEach((graphic, graphicIndex) => {
        const graphicAt = at + (graphic.startOffset ?? 0);
        const graphicDur = graphic.duration ?? Math.max(0.8, dur - (graphic.startOffset ?? 0));
        const id = `#film-graphic-${i}-${graphicIndex}`;
        if (graphic.type === "ring") {
          lines.push(`  tl.fromTo("${id}", { opacity: 0, scale: 0.78 }, { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(2.2)" }, ${graphicAt});`);
        } else if (graphic.type === "arrow" || graphic.type === "line") {
          lines.push(`  tl.fromTo("${id}", { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power3.out" }, ${graphicAt});`);
        } else {
          lines.push(`  tl.fromTo("${id}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, ${graphicAt});`);
        }
        const exitAt = graphicAt + Math.max(0.25, graphicDur - 0.18);
        lines.push(`  tl.to("${id}", { opacity: 0, duration: 0.18, ease: "power2.in" }, ${exitAt});`);
        lines.push(`  tl.set("${id}", { opacity: 0 }, ${exitAt + 0.18});`);
      });
      (cue.freezeFrames ?? []).forEach((freeze, freezeIndex) => {
        const freezeAt = at + freeze.startOffset;
        const freezeDur = Math.max(0.25, freeze.duration);
        const id = `#freeze-frame-${i}-${freezeIndex}`;
        const imageId = `${id} .freeze-frame-image`;
        lines.push(`  tl.fromTo("${id}", { opacity: 0 }, { opacity: 1, duration: 0.08, ease: "none" }, ${freezeAt});`);
        lines.push(`  tl.fromTo("${imageId}", { scale: ${freeze.zoomFrom ?? 1.02} }, { scale: ${freeze.zoomTo ?? 1.12}, duration: ${freezeDur}, ease: "none" }, ${freezeAt});`);
        lines.push(`  tl.fromTo("${id} .freeze-frame-label", { opacity: 0, y: 92, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: "back.out(1.55)" }, ${freezeAt + 0.08});`);
        lines.push(`  tl.to("${id}", { opacity: 0, duration: 0.12, ease: "power2.in" }, ${freezeAt + Math.max(0.15, freezeDur - 0.12)});`);
        lines.push(`  tl.set("${id}", { opacity: 0 }, ${freezeAt + freezeDur});`);
      });
    } else if (cue.type === "split_montage") {
      const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
      const itemDur = (cue.endSecs - cue.startSecs) / labels.length;
      labels.forEach((_, itemIndex) => {
        const itemAt = cue.startSecs + itemDur * itemIndex;
        if (!useFlatBackground) {
          lines.push(`  tl.fromTo("#edl-video-${i}-${itemIndex}", { scale: 1.02 }, { scale: 1.09, duration: ${Math.max(0.2, itemDur)}, ease: "none" }, ${itemAt});`);
        }
        lines.push(`  tl.fromTo("#edl-overlay-${i}-${itemIndex}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, ${itemAt + 0.05});`);
      });
      (cue.graphics ?? []).forEach((graphic, graphicIndex) => {
        const graphicAt = cue.startSecs + (graphic.startOffset ?? 0);
        const graphicDur = graphic.duration ?? Math.max(0.8, cue.endSecs - cue.startSecs - (graphic.startOffset ?? 0));
        const id = `#film-graphic-${i}-${graphicIndex}`;
        if (graphic.type === "ring") {
          lines.push(`  tl.fromTo("${id}", { opacity: 0, scale: 0.78 }, { opacity: 1, scale: 1, duration: 0.18, ease: "back.out(2.2)" }, ${graphicAt});`);
        } else if (graphic.type === "arrow" || graphic.type === "line") {
          lines.push(`  tl.fromTo("${id}", { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power3.out" }, ${graphicAt});`);
        } else {
          lines.push(`  tl.fromTo("${id}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, ${graphicAt});`);
        }
        const exitAt = graphicAt + Math.max(0.25, graphicDur - 0.18);
        lines.push(`  tl.to("${id}", { opacity: 0, duration: 0.18, ease: "power2.in" }, ${exitAt});`);
        lines.push(`  tl.set("${id}", { opacity: 0 }, ${exitAt + 0.18});`);
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
  const flatBackgroundAsset = useFlatBackground ? symlinkAsset(flatBackgroundPath, "flat-background.mp4") : null;
  if (flatBackgroundAsset) {
    console.log("✓ Using flat-background.mp4 for base visuals");
  }

  // Load or generate cues
  let cues: Cue[];
  if (fs.existsSync(editScriptJsonPath)) {
    cues = loadEditScriptCues();
    console.log(`✓ Loaded ${cues.length} cues from ${path.basename(editScriptJsonPath)}`);
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
      .edl-overlay { position: absolute; left: 74px; top: auto; bottom: 72px; width: 1280px; opacity: 0; pointer-events: none; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; z-index: 20; transform-origin: left bottom; }
      .edl-overlay.scorebug-cover { left: 420px; top: auto; bottom: 18px; width: 1080px; min-height: 148px; padding: 16px 42px 20px; box-sizing: border-box; text-align: center; background: linear-gradient(90deg, rgba(1,11,31,0) 0%, rgba(1,11,31,0.98) 12%, rgba(1,11,31,0.98) 88%, rgba(1,11,31,0) 100%); }
      .edl-overlay.scorebug-cover .edl-kicker { margin-bottom: 8px; font-size: 20px; }
      .edl-overlay.scorebug-cover .edl-title { margin: 0 auto; max-width: 930px; font-size: 50px; padding: 14px 20px 16px; border-left-width: 0; border-bottom: 6px solid #ffe000; }
      .edl-overlay.scorebug-cover .edl-stack { justify-content: center; margin: 9px auto 0; max-width: 930px; }
      .edl-overlay.scorebug-cover .edl-stack span { font-size: 24px; padding: 8px 12px; }
      .edl-kicker { display: inline-block; background: #c8102e; color: #fff; font-size: 24px; font-weight: 950; letter-spacing: 0.08em; padding: 10px 18px; border-radius: 5px 5px 0 0; margin-bottom: 0; box-shadow: 0 14px 34px rgba(0,0,0,0.5); text-transform: uppercase; }
      .edl-title { display: block; width: fit-content; max-width: 1260px; background: linear-gradient(90deg, rgba(1,11,31,0.96), rgba(1,11,31,0.78)); color: #ffe000; font-family: "Archivo Black", "League Gothic", system-ui, -apple-system, sans-serif; font-size: 82px; font-weight: 950; line-height: 0.94; letter-spacing: 0; padding: 20px 28px 24px; border-left: 12px solid #ffe000; border-bottom: 8px solid rgba(255,224,0,0.95); text-transform: uppercase; text-shadow: 0 5px 0 rgba(0,0,0,0.55); box-shadow: 0 24px 58px rgba(0,0,0,0.58); }
      .edl-stack { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; max-width: 1260px; }
      .edl-stack span { display: inline-block; background: rgba(255,255,255,0.94); color: #010b1f; font-size: 34px; font-weight: 950; letter-spacing: 0; padding: 10px 16px; border-radius: 5px; box-shadow: 0 14px 30px rgba(0,0,0,0.36); text-transform: uppercase; }
      .image-full-wrap,
      .image-overlay-wrap {
        position: absolute;
        inset: 0;
        background: #010b1f;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 25;
      }
      .image-full-wrap img,
      .image-overlay-wrap img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: top center;
        transform-origin: top center;
        will-change: transform;
      }
      .freeze-frame-wrap {
        position: absolute;
        inset: 0;
        background: #000;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 16;
      }
      .freeze-frame-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        will-change: transform;
      }
      .freeze-frame-label {
        position: absolute;
        left: 74px;
        bottom: 78px;
        min-width: 760px;
        max-width: 1320px;
        text-align: center;
        background: linear-gradient(90deg, rgba(1,11,31,0.95), rgba(1,11,31,0.82));
        color: #ffe000;
        font-family: "Archivo Black", "League Gothic", system-ui, -apple-system, sans-serif;
        border-bottom: 10px solid #ffe000;
        font-size: 92px;
        line-height: 0.95;
        font-weight: 950;
        padding: 20px 30px 25px;
        text-transform: uppercase;
        text-shadow: 0 5px 0 rgba(0,0,0,0.58);
        box-shadow: 0 24px 58px rgba(0,0,0,0.6);
        opacity: 0;
        transform-origin: left bottom;
      }
      .montage-overlay { left: 300px; top: auto; bottom: 52px; width: 1320px; min-width: 1320px; text-align: center; }
      .montage-overlay .edl-kicker { background: #010b1f; color: #fff; font-size: 26px; padding: 10px 18px; }
      .montage-overlay .edl-title { margin: 0 auto; max-width: 1320px; font-size: 108px; background: rgba(200,16,46,0.94); color: #fff; border-left-width: 0; border-bottom: 11px solid #ffe000; padding: 22px 34px 26px; }
      .film-graphic { position: absolute; z-index: 18; opacity: 0; pointer-events: none; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .film-ring { border: 8px solid var(--film-color); border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 4px rgba(0,0,0,0.45), 0 0 28px rgba(255,224,0,0.35); }
      .film-label-inline { position: absolute; left: 50%; top: calc(100% + 10px); transform: translateX(-50%); white-space: nowrap; background: rgba(1,11,31,0.9); color: #fff; border-left: 5px solid var(--film-color); font-size: 22px; font-weight: 950; padding: 8px 12px; text-transform: uppercase; box-shadow: 0 10px 24px rgba(0,0,0,0.42); }
      .film-callout { transform: translate(-50%, -50%); background: rgba(1,11,31,0.88); color: #fff; border: 3px solid var(--film-color); border-left-width: 9px; font-size: 32px; line-height: 1; font-weight: 950; padding: 12px 16px; text-transform: uppercase; box-shadow: 0 14px 34px rgba(0,0,0,0.5); white-space: nowrap; }
      .film-arrow-wrap { height: 0; transform-origin: 0 0; }
      .film-arrow-line { height: 8px; width: 100%; background: var(--film-color); border-radius: 999px; box-shadow: 0 0 0 3px rgba(0,0,0,0.42); transform-origin: 0 50%; }
      .film-arrow-head { position: absolute; right: -2px; top: -12px; width: 0; height: 0; border-top: 16px solid transparent; border-bottom: 16px solid transparent; border-left: 28px solid var(--film-color); filter: drop-shadow(0 0 3px rgba(0,0,0,0.6)); }
      .film-arrow-label { position: absolute; left: 50%; top: -54px; transform: translateX(-50%) rotate(var(--arrow-label-rotation)); transform-origin: center center; background: rgba(200,16,46,0.92); color: #fff; font-size: 22px; font-weight: 950; padding: 8px 12px; text-transform: uppercase; white-space: nowrap; box-shadow: 0 10px 24px rgba(0,0,0,0.42); }
      .film-svg { inset: 0; width: 100%; height: 100%; }
      .film-line { stroke-width: 0.6; stroke-dasharray: 2.2 1.4; filter: drop-shadow(0 0 0.3px rgba(0,0,0,0.9)); }

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

      ${flatBackgroundAsset ? `
      <!-- Precomposited base visuals -->
      <video id="flat-background" class="clip broll-video"
             data-start="0" data-duration="${totalSecs}" data-track-index="-1"
             data-volume="0"
             src="${flatBackgroundAsset}" muted playsinline
             style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>
      ` : ""}

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
