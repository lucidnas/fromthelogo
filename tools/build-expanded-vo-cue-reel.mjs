#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/build-expanded-vo-cue-reel.mjs --alignment FILE --out-dir DIR

Builds numbered cue clips whose durations exactly match each VO alignment cue.
Official-highlight cues are expanded with live play + slow replay + freeze-frame hold.
Missing social cues become obvious placeholder clips so the final joined reel still matches VO length.`);
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

function escapeDrawText(text) {
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

function duration(filePath) {
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

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  usage();
  process.exit(0);
}

const alignmentPath = args.get("alignment");
const outDir = args.get("out-dir");
if (!alignmentPath || !outDir) {
  usage();
  process.exit(1);
}
if (!fs.existsSync(alignmentPath)) throw new Error(`Missing alignment JSON: ${alignmentPath}`);

const alignment = JSON.parse(fs.readFileSync(alignmentPath, "utf8"));
const cues = alignment.alignmentCues || [];
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  sourceAlignment: alignmentPath,
  slug: alignment.slug || null,
  createdAt: new Date().toISOString(),
  outputDir: outDir,
  expansionRule: "Each VO cue is made exact length. If source is shorter: live once, slow replay at 50%, then freeze last frame. If source is longer: trim to VO duration. Missing social cues become placeholders.",
  cues: [],
};

for (let i = 0; i < cues.length; i += 1) {
  const cue = cues[i];
  const seq = i + 1;
  const voDur = Number(cue.voEnd) - Number(cue.voStart);
  if (!Number.isFinite(voDur) || voDur <= 0) throw new Error(`Bad VO duration at cue ${seq}`);
  const label = cue.overlayLabel || cue.requiredVisual || `CUE ${seq}`;
  const fileName = `${String(seq).padStart(3, "0")}_expanded_${sanitize(label)}.mp4`;
  const outPath = path.join(outDir, fileName);
  const sourceIn = Number(cue.sourceIn);
  const sourceOut = Number(cue.sourceOut);
  const hasSource = cue.assetPath && fs.existsSync(cue.assetPath)
    && Number.isFinite(sourceIn)
    && Number.isFinite(sourceOut)
    && sourceOut > sourceIn
    && cue.matchStatus !== "missing_from_official_highlight";

  const baseVideoArgs = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "16",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-an",
    "-movflags", "+faststart",
  ];

  if (!hasSource) {
    const text = `NEEDS SOCIAL CLIP: ${label}`;
    console.log(`${String(seq).padStart(3, "0")} placeholder ${voDur.toFixed(3)}s ${label}`);
    run([
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi",
      "-i", `color=c=0x101010:s=1920x1080:d=${voDur.toFixed(3)}`,
      "-vf", `drawtext=text='${escapeDrawText(text)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='VO ${Number(cue.voStart).toFixed(1)}-${Number(cue.voEnd).toFixed(1)}s':fontcolor=0xFFE84D:fontsize=38:x=(w-text_w)/2:y=(h-text_h)/2+82`,
      ...baseVideoArgs,
      outPath,
    ]);
    manifest.cues.push({
      sequence: seq,
      path: outPath,
      fileName,
      voStart: cue.voStart,
      voEnd: cue.voEnd,
      targetDuration: voDur,
      actualDuration: duration(outPath),
      overlayLabel: label,
      matchStatus: cue.matchStatus,
      expansion: "placeholder-social-needed",
      neededClip: cue.ifMissingNeededClip || cue.requiredVisual || "",
    });
    continue;
  }

  const rawDur = sourceOut - sourceIn;
  const filter = rawDur >= voDur
    ? `[0:v]trim=0:${voDur.toFixed(3)},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1[vbase];[vbase]drawtext=text='${escapeDrawText(label)}':fontcolor=0xFFE84D:fontsize=44:box=1:boxcolor=black@0.72:boxborderw=18:x=36:y=36[v]`
    : `[0:v]trim=0:${rawDur.toFixed(3)},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1[live];[0:v]trim=0:${rawDur.toFixed(3)},setpts=(PTS-STARTPTS)*2,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1[slow];[live][slow]concat=n=2:v=1:a=0,tpad=stop_mode=clone:stop_duration=${Math.max(0, voDur - rawDur * 3).toFixed(3)},trim=0:${voDur.toFixed(3)},setpts=PTS-STARTPTS[vbase];[vbase]drawtext=text='${escapeDrawText(label)}':fontcolor=0xFFE84D:fontsize=44:box=1:boxcolor=black@0.72:boxborderw=18:x=36:y=36[v]`;

  const expansion = rawDur >= voDur
    ? "trim-live-to-vo"
    : `live-${rawDur.toFixed(3)}s + slow-replay-${Math.min(rawDur * 2, Math.max(0, voDur - rawDur)).toFixed(3)}s + freeze-${Math.max(0, voDur - rawDur * 3).toFixed(3)}s`;

  console.log(`${String(seq).padStart(3, "0")} ${sourceIn.toFixed(3)}-${sourceOut.toFixed(3)} raw=${rawDur.toFixed(3)} vo=${voDur.toFixed(3)} ${label}`);
  run([
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", sourceIn.toFixed(3),
    "-t", rawDur.toFixed(3),
    "-i", cue.assetPath,
    "-filter_complex", filter,
    "-map", "[v]",
    ...baseVideoArgs,
    outPath,
  ]);

  manifest.cues.push({
    sequence: seq,
    path: outPath,
    fileName,
    voStart: cue.voStart,
    voEnd: cue.voEnd,
    targetDuration: voDur,
    actualDuration: duration(outPath),
    overlayLabel: label,
    matchStatus: cue.matchStatus,
    sourcePath: cue.assetPath,
    sourceIn,
    sourceOut,
    rawSourceDuration: rawDur,
    expansion,
    voLine: cue.voLine,
  });
}

const concatPath = path.join(outDir, "concat.txt");
fs.writeFileSync(concatPath, manifest.cues.map((cue) => `file '${cue.path}'\n`).join(""));

const reelPath = path.join(outDir, "expanded-cue-reel-v1.mp4");
console.log(`Concatenating ${manifest.cues.length} expanded cues...`);
run([
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "concat",
  "-safe", "0",
  "-i", concatPath,
  "-c", "copy",
  reelPath,
]);

manifest.reelPath = reelPath;
manifest.reelDuration = duration(reelPath);
manifest.targetDuration = alignment.voDuration;
manifest.durationDelta = manifest.reelDuration != null && alignment.voDuration != null
  ? manifest.reelDuration - alignment.voDuration
  : null;

const manifestPath = path.join(outDir, "expanded-manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath}`);
console.log(`Reel: ${reelPath}`);
console.log(`Duration: ${manifest.reelDuration?.toFixed(3)}s target ${Number(alignment.voDuration).toFixed(3)}s delta ${manifest.durationDelta?.toFixed(3)}s`);
