#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/cut-gemini-aligned-clips.mjs --alignment FILE --out-dir DIR [--with-audio]

Cuts numbered clips from a Gemini VO/highlight alignment JSON into a clean isolated folder.
Exact and partial official-highlight matches are cut. Missing/social-needed cues are recorded in the manifest.`);
}

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--with-audio") {
      out.set("with-audio", "1");
      continue;
    }
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
  return String(text || "clip")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "clip";
}

function ffprobeDuration(filePath) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const value = Number(result.stdout.trim());
  return Number.isFinite(value) ? value : null;
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with status ${result.status}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  usage();
  process.exit(0);
}

const alignmentPath = args.get("alignment");
const outDir = args.get("out-dir");
const withAudio = args.has("with-audio");
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
  withAudio,
  clips: [],
  missingFromOfficialHighlight: [],
};

let cutNumber = 0;
for (let i = 0; i < cues.length; i += 1) {
  const cue = cues[i];
  const status = cue.matchStatus || "unknown";
  const sourcePath = cue.assetPath;
  const sourceIn = cue.sourceIn;
  const sourceOut = cue.sourceOut;
  const canCut = (status === "exact" || status === "partial" || status === "non_play_context")
    && sourcePath
    && fs.existsSync(sourcePath)
    && Number.isFinite(Number(sourceIn))
    && Number.isFinite(Number(sourceOut))
    && Number(sourceOut) > Number(sourceIn);

  if (!canCut) {
    manifest.missingFromOfficialHighlight.push({
      alignmentIndex: i,
      sequence: i + 1,
      voStart: cue.voStart,
      voEnd: cue.voEnd,
      voLine: cue.voLine,
      overlayLabel: cue.overlayLabel,
      matchStatus: status,
      neededClip: cue.ifMissingNeededClip || cue.requiredVisual || "",
    });
    continue;
  }

  cutNumber += 1;
  const label = sanitize(cue.overlayLabel || cue.requiredVisual || cue.voLine);
  const fileName = `${String(cutNumber).padStart(3, "0")}_cue-${String(i + 1).padStart(2, "0")}_${label}.mp4`;
  const outPath = path.join(outDir, fileName);
  const duration = Math.max(0.1, Number(sourceOut) - Number(sourceIn));

  const ffmpegArgs = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Number(sourceIn).toFixed(3),
    "-i",
    sourcePath,
    "-t",
    duration.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  ];
  if (withAudio) {
    ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
  } else {
    ffmpegArgs.push("-an");
  }
  ffmpegArgs.push(outPath);

  console.log(`${String(cutNumber).padStart(3, "0")} cue ${i + 1}: ${Number(sourceIn).toFixed(3)}-${Number(sourceOut).toFixed(3)} ${cue.overlayLabel || ""}`);
  runFfmpeg(ffmpegArgs);

  manifest.clips.push({
    clipNumber: cutNumber,
    alignmentIndex: i,
    sequence: i + 1,
    fileName,
    path: outPath,
    duration: ffprobeDuration(outPath),
    voStart: cue.voStart,
    voEnd: cue.voEnd,
    voLine: cue.voLine,
    overlayLabel: cue.overlayLabel,
    matchStatus: status,
    confidence: cue.confidence,
    sourceAsset: cue.asset || path.basename(sourcePath),
    sourcePath,
    sourceIn: Number(sourceIn),
    sourceOut: Number(sourceOut),
    treatment: cue.treatment,
    requiredVisual: cue.requiredVisual,
    whyThisMatches: cue.whyThisMatches,
    freezeFrames: cue.freezeFrames || [],
  });
}

const manifestPath = path.join(outDir, "manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "README.md"), [
  `# Gemini VO Alignment Clips`,
  ``,
  `Source alignment: \`${alignmentPath}\``,
  `Official source: \`${alignment.officialHighlight?.assetPath || ""}\``,
  `Cut clips: ${manifest.clips.length}`,
  `Missing/social-needed cues: ${manifest.missingFromOfficialHighlight.length}`,
  ``,
  `Files are numbered in VO sequence order and should stay isolated from older generated clips.`,
  ``,
].join("\n"));

console.log(`Wrote ${manifestPath}`);
console.log(`Cut clips: ${manifest.clips.length}`);
console.log(`Missing/social-needed cues: ${manifest.missingFromOfficialHighlight.length}`);
