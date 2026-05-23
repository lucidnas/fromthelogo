#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slug, outputArg] = process.argv;
if (!slug) {
  console.error("Usage: node tools/render-clip-first-ffmpeg-preview.mjs SLUG [OUTPUT_MP4]");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const videoDir = `${SSD}/ftl/videos/${slug}`;
const editPath = `${videoDir}/edit-script-johnny.json`;
const voPath = `${videoDir}/vo.mp3`;
const outPath = outputArg ?? `${videoDir}/render/${slug}-ffmpeg-live-freeze-payoff-preview.mp4`;

if (!fs.existsSync(editPath)) throw new Error(`Missing edit script: ${editPath}`);
if (!fs.existsSync(voPath)) throw new Error(`Missing VO: ${voPath}`);

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const cues = (edit.cues ?? []).filter((cue) => cue.assetPath && Number(cue.end) > Number(cue.start));
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ftl-ffmpeg-${slug}-`));
const concatPath = path.join(workDir, "concat.txt");
const segmentPaths = [];

function run(args) {
  execFileSync(args[0], args.slice(1), { stdio: "inherit" });
}

function escapeDrawtext(text) {
  return String(text ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%");
}

function textFilter(text, size = 72) {
  const safe = escapeDrawtext(text);
  return `drawtext=text='${safe}':fontcolor=0xFFE84D:fontsize=${size}:font='Arial Black':box=1:boxcolor=black@0.72:boxborderw=22:x=44:y=h-th-72`;
}

function videoFilter(label = "", size = 72) {
  const base = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p";
  return label ? `${base},${textFilter(label, size)}` : base;
}

function renderVideo({ source, start, duration, out, label = "", size = 72 }) {
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, Number(start) || 0).toFixed(3),
    "-i",
    source,
    "-t",
    Math.max(0.05, duration).toFixed(3),
    "-an",
    "-vf",
    videoFilter(label, size),
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
    out,
  ]);
}

function renderFreeze({ source, time, duration, out, label }) {
  const framePath = `${out}.png`;
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, Number(time) || 0).toFixed(3),
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
    Math.max(0.05, duration).toFixed(3),
    "-vf",
    videoFilter(label, 82),
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
    out,
  ]);
}

function concatSegments(parts, out) {
  const listPath = `${out}.txt`;
  fs.writeFileSync(listPath, parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
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
    listPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    out,
  ]);
}

try {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    const source = cue.assetPath;
    if (!fs.existsSync(source)) throw new Error(`Missing asset: ${source}`);
    const duration = Number(cue.end) - Number(cue.start);
    const sourceIn = Number(cue.sourceIn ?? 0);
    const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
    const segmentPath = path.join(workDir, `cue-${String(i).padStart(3, "0")}.mp4`);

    if (freeze) {
      const freezeStart = Math.max(0.8, Math.min(duration - 0.2, Number(freeze.startOffset ?? 2.8)));
      const freezeDur = Math.max(0.5, Math.min(Number(freeze.duration ?? 5), duration - freezeStart));
      const freezeEnd = Math.min(duration, freezeStart + freezeDur);
      const payoffDur = Math.max(0, duration - freezeEnd);
      const parts = [];
      const setupPath = path.join(workDir, `cue-${String(i).padStart(3, "0")}-a-setup.mp4`);
      renderVideo({ source, start: sourceIn, duration: freezeStart, out: setupPath });
      parts.push(setupPath);
      const freezePath = path.join(workDir, `cue-${String(i).padStart(3, "0")}-b-freeze.mp4`);
      renderFreeze({ source, time: Number(freeze.sourceTime ?? sourceIn), duration: freezeDur, out: freezePath, label: freeze.label || "" });
      parts.push(freezePath);
      if (payoffDur > 0.05) {
        const payoffPath = path.join(workDir, `cue-${String(i).padStart(3, "0")}-c-payoff.mp4`);
        renderVideo({ source, start: Math.max(sourceIn, Number(freeze.sourceTime ?? sourceIn) - 1), duration: payoffDur, out: payoffPath });
        parts.push(payoffPath);
      }
      concatSegments(parts, segmentPath);
    } else {
      const label = (cue.overlays ?? []).join("  |  ");
      renderVideo({ source, start: sourceIn, duration, out: segmentPath, label, size: i === 0 ? 64 : 58 });
    }
    segmentPaths.push(segmentPath);
  }

  fs.writeFileSync(concatPath, segmentPaths.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
  const silentPath = path.join(workDir, "silent.mp4");
  run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", "-movflags", "+faststart", silentPath]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  run([
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    silentPath,
    "-i",
    voPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  console.log(outPath);
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
