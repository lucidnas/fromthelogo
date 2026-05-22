#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slug, outputArg] = process.argv;

if (!slug) {
  console.error("Usage: node tools/precompose-edl-background.mjs SLUG [OUTPUT_MP4]");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const videoDir = `${SSD}/ftl/videos/${slug}`;
const editPath = `${videoDir}/edit-script-johnny-v2.json`;
const outputPath = outputArg ?? `${videoDir}/flat-background.mp4`;

if (!fs.existsSync(editPath)) {
  console.error(`Missing edit script: ${editPath}`);
  process.exit(1);
}

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const cues = (edit.cues ?? [])
  .filter((cue) => Number.isFinite(Number(cue.start)) && Number.isFinite(Number(cue.end)) && Number(cue.end) > Number(cue.start))
  .sort((a, b) => Number(a.start) - Number(b.start));

if (cues.length === 0) {
  console.error(`No cues in ${editPath}`);
  process.exit(1);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ftl-edl-bg-${slug}-`));
const concatPath = path.join(workDir, "concat.txt");
const segmentPaths = [];

function run(args) {
  execFileSync(args[0], args.slice(1), { stdio: "inherit" });
}

function renderVideoSegment(cue, index, duration, outPath) {
  const source = cue.assetPath;
  if (!source || !fs.existsSync(source)) {
    throw new Error(`Missing cue asset at ${cue.start}-${cue.end}: ${source}`);
  }
  const start = Math.max(0, Number(cue.sourceIn ?? 0));
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    start.toFixed(3),
    "-i",
    source,
    "-t",
    duration.toFixed(3),
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
    outPath,
  ]);
}

function renderFreezeSegment(cue, index, duration, outPath) {
  const source = cue.assetPath;
  if (!source || !fs.existsSync(source)) {
    throw new Error(`Missing freeze cue asset at ${cue.start}-${cue.end}: ${source}`);
  }
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length > 0 ? cue.freezeFrames[0] : null;
  const sourceTime = Number(freeze?.sourceTime ?? cue.sourceIn ?? 0);
  const framePath = path.join(workDir, `freeze-${String(index).padStart(3, "0")}.png`);
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, sourceTime).toFixed(3),
    "-i",
    source,
    "-frames:v",
    "1",
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba",
    framePath,
  ]);
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-loop",
    "1",
    "-i",
    framePath,
    "-t",
    duration.toFixed(3),
    "-vf",
    "fps=30,format=yuv420p",
    "-an",
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
    outPath,
  ]);
}

try {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    const duration = Number(cue.end) - Number(cue.start);
    const outPath = path.join(workDir, `seg-${String(i).padStart(3, "0")}.mp4`);
    const isStill = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length > 0;
    if (isStill) renderFreezeSegment(cue, i, duration, outPath);
    else renderVideoSegment(cue, i, duration, outPath);
    segmentPaths.push(outPath);
  }

  fs.writeFileSync(
    concatPath,
    segmentPaths.map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  console.log(JSON.stringify({ slug, outputPath, cues: cues.length }, null, 2));
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
