#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/build-expanded-vo-cue-reel-with-freezes.mjs --alignment FILE --out-dir DIR [--freeze-plan FILE]

Builds a proof reel where every source-backed VO cue has one or two deliberate freeze frames.`);
}

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      out.set("help", "1");
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected arg: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    out.set(key, value);
    i += 1;
  }
  return out;
}

function sanitize(text) {
  return String(text || "cue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "cue";
}

function esc(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function run(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg failed with status ${result.status}`);
}

function probeDuration(filePath) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const n = Number(result.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

function renderVideoSegment({ sourcePath, start, dur, outPath, mode = "live" }) {
  if (dur <= 0.04) return;
  const setpts = mode === "slow" ? "setpts=(PTS-STARTPTS)*2" : "setpts=PTS-STARTPTS";
  const trimDur = mode === "slow" ? Math.max(0.05, dur / 2) : dur;
  run([
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", start.toFixed(3),
    "-t", trimDur.toFixed(3),
    "-i", sourcePath,
    "-vf",
    `${setpts},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
    "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart",
    outPath,
  ]);
}

function renderFreeze({ sourcePath, sourceTime, dur, outPath, label, freezeLabel }) {
  if (dur <= 0.04) return;
  run([
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", sourceTime.toFixed(3),
    "-i", sourcePath,
    "-f", "lavfi",
    "-i", `color=c=black:s=1920x1080:d=${dur.toFixed(3)}`,
    "-filter_complex",
    `[0:v]select=eq(n\\,0),scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,loop=loop=-1:size=1:start=0,trim=0:${dur.toFixed(3)},setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.18:t=fill,drawtext=text='${esc(label)}':fontcolor=0xFFE84D:fontsize=86:box=1:boxcolor=black@0.76:boxborderw=26:x=(w-text_w)/2:y=56,drawtext=text='${esc(freezeLabel)}':fontcolor=white:fontsize=64:box=1:boxcolor=black@0.68:boxborderw=22:x=(w-text_w)/2:y=h-170[v]`,
    "-map", "[v]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
    "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart",
    outPath,
  ]);
}

function renderPlaceholder({ dur, outPath, label, voStart, voEnd }) {
  run([
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=0x101010:s=1920x1080:d=${dur.toFixed(3)}`,
    "-vf",
    `drawtext=text='NEEDS SOCIAL CLIP\\: ${esc(label)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='VO ${Number(voStart).toFixed(1)}-${Number(voEnd).toFixed(1)}s':fontcolor=0xFFE84D:fontsize=38:x=(w-text_w)/2:y=(h-text_h)/2+82`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
    "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart",
    outPath,
  ]);
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  usage();
  process.exit(0);
}

const alignmentPath = args.get("alignment");
const outDir = args.get("out-dir");
const freezePlanPath = args.get("freeze-plan");
if (!alignmentPath || !outDir) {
  usage();
  process.exit(1);
}

const alignment = JSON.parse(fs.readFileSync(alignmentPath, "utf8"));
const cues = alignment.alignmentCues || [];
let freezePlanByCue = new Map();
if (freezePlanPath) {
  const freezePlan = JSON.parse(fs.readFileSync(freezePlanPath, "utf8"));
  freezePlanByCue = new Map((freezePlan.freezeFramePlan || []).map((item) => [Number(item.cueIndex), item]));
}
fs.mkdirSync(outDir, { recursive: true });
const workDir = path.join(outDir, "work");
fs.mkdirSync(workDir, { recursive: true });

const manifest = {
  sourceAlignment: alignmentPath,
  slug: alignment.slug || null,
  createdAt: new Date().toISOString(),
  rule: "Every source-backed VO cue gets at least one explicit freeze frame. Cues of 14s+ get two freezes. Remaining time is live plus slow replay.",
  freezePlanPath: freezePlanPath || null,
  cues: [],
};

for (let i = 0; i < cues.length; i += 1) {
  const cue = cues[i];
  const seq = i + 1;
  const voDur = Number(cue.voEnd) - Number(cue.voStart);
  const label = cue.overlayLabel || cue.requiredVisual || `CUE ${seq}`;
  const fileName = `${String(seq).padStart(3, "0")}_freeze-expanded_${sanitize(label)}.mp4`;
  const outPath = path.join(outDir, fileName);
  const sourceIn = Number(cue.sourceIn);
  const sourceOut = Number(cue.sourceOut);
  const hasSource = cue.assetPath && fs.existsSync(cue.assetPath)
    && Number.isFinite(sourceIn)
    && Number.isFinite(sourceOut)
    && sourceOut > sourceIn
    && cue.matchStatus !== "missing_from_official_highlight";

  console.log(`${String(seq).padStart(3, "0")} ${label}`);

  if (!hasSource) {
    renderPlaceholder({ dur: voDur, outPath, label, voStart: cue.voStart, voEnd: cue.voEnd });
    manifest.cues.push({
      sequence: seq,
      fileName,
      path: outPath,
      targetDuration: voDur,
      actualDuration: probeDuration(outPath),
      overlayLabel: label,
      expansion: "placeholder-social-needed",
      freezeCount: 0,
    });
    continue;
  }

  const rawDur = sourceOut - sourceIn;
  const freezeCount = voDur >= 14 ? 2 : 1;
  const freezeDur = voDur >= 24 ? 2.5 : voDur >= 14 ? 2.0 : 1.5;
  const totalFreeze = Math.min(voDur - 1.0, freezeCount * freezeDur);
  const remaining = Math.max(0.2, voDur - totalFreeze);
  const liveDur = Math.min(rawDur, Math.max(2.0, Math.min(remaining * 0.55, remaining)));
  const slowDur = Math.max(0, remaining - liveDur);
  const planned = freezePlanByCue.get(seq);
  const freezeSpecs = planned?.freezeFrames?.length
    ? planned.freezeFrames.map((f) => ({ sourceTime: Number(f.sourceTime), label: f.label || label, visualReason: f.visualReason, voReason: f.voReason }))
    : cue.freezeFrames?.length
      ? cue.freezeFrames.map((f) => ({ sourceTime: Number(f.sourceTime), label: f.label || label }))
      : [];
  while (freezeSpecs.length < freezeCount) {
    const t = freezeSpecs.length === 0
      ? sourceIn + rawDur * 0.45
      : sourceIn + rawDur * 0.78;
    freezeSpecs.push({ sourceTime: Math.min(sourceOut - 0.15, Math.max(sourceIn + 0.15, t)), label });
  }

  const parts = [];
  const livePath = path.join(workDir, `${String(seq).padStart(3, "0")}-a-live.mp4`);
  renderVideoSegment({ sourcePath: cue.assetPath, start: sourceIn, dur: liveDur, outPath: livePath, mode: "live" });
  parts.push(livePath);

  const freeze1Path = path.join(workDir, `${String(seq).padStart(3, "0")}-b-freeze1.mp4`);
  renderFreeze({ sourcePath: cue.assetPath, sourceTime: freezeSpecs[0].sourceTime, dur: freezeDur, outPath: freeze1Path, label, freezeLabel: freezeSpecs[0].label });
  parts.push(freeze1Path);

  if (slowDur > 0.05) {
    const slowPath = path.join(workDir, `${String(seq).padStart(3, "0")}-c-slow.mp4`);
    renderVideoSegment({ sourcePath: cue.assetPath, start: sourceIn, dur: slowDur, outPath: slowPath, mode: "slow" });
    parts.push(slowPath);
  }

  if (freezeCount > 1) {
    const used = parts.reduce((sum, p) => sum + (probeDuration(p) || 0), 0);
    const dur2 = Math.max(0.1, voDur - used);
    const freeze2Path = path.join(workDir, `${String(seq).padStart(3, "0")}-d-freeze2.mp4`);
    renderFreeze({ sourcePath: cue.assetPath, sourceTime: freezeSpecs[1].sourceTime, dur: dur2, outPath: freeze2Path, label, freezeLabel: freezeSpecs[1].label });
    parts.push(freeze2Path);
  }

  const concat = path.join(workDir, `${String(seq).padStart(3, "0")}-concat.txt`);
  fs.writeFileSync(concat, parts.map((p) => `file '${p}'\n`).join(""));
  run([
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0",
    "-i", concat,
    "-t", voDur.toFixed(3),
    "-c", "copy",
    outPath,
  ]);

  manifest.cues.push({
    sequence: seq,
    fileName,
    path: outPath,
    voStart: cue.voStart,
    voEnd: cue.voEnd,
    targetDuration: voDur,
    actualDuration: probeDuration(outPath),
    overlayLabel: label,
    matchStatus: cue.matchStatus,
    sourcePath: cue.assetPath,
    sourceIn,
    sourceOut,
    rawSourceDuration: rawDur,
    freezeCount,
    freezeFrames: freezeSpecs.slice(0, freezeCount),
    avoid: planned?.avoid || null,
    expansion: `live ${liveDur.toFixed(3)}s, freeze1 ${freezeDur.toFixed(3)}s, slow ${slowDur.toFixed(3)}s${freezeCount > 1 ? ", freeze2 fill" : ""}`,
  });
}

const concatPath = path.join(outDir, "concat.txt");
fs.writeFileSync(concatPath, manifest.cues.map((cue) => `file '${cue.path}'\n`).join(""));
const reelPath = path.join(outDir, "expanded-freeze-cue-reel-v2.mp4");
run([
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "concat", "-safe", "0",
  "-i", concatPath,
  "-c", "copy",
  reelPath,
]);

manifest.reelPath = reelPath;
manifest.reelDuration = probeDuration(reelPath);
manifest.targetDuration = alignment.voDuration;
manifest.durationDelta = manifest.reelDuration - alignment.voDuration;
const manifestPath = path.join(outDir, "expanded-freeze-manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath}`);
console.log(`Reel: ${reelPath}`);
console.log(`Duration: ${manifest.reelDuration.toFixed(3)} target ${Number(alignment.voDuration).toFixed(3)} delta ${manifest.durationDelta.toFixed(3)}`);
