#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slug, outputArg] = process.argv;
if (!slug) {
  console.error("Usage: node tools/render-clip-first-with-commentary-payoffs.mjs SLUG [OUTPUT_MP4]");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const videoDir = `${SSD}/ftl/videos/${slug}`;
const editPath = `${videoDir}/edit-script-johnny.json`;
const voPath = `${videoDir}/vo.mp3`;
const outPath = outputArg ?? `${videoDir}/render/${slug}-with-commentary-payoffs.mp4`;
const payoffSeconds = Number(process.env.FTL_PAYOFF_SECONDS ?? 2.8);

if (!fs.existsSync(editPath)) throw new Error(`Missing edit script: ${editPath}`);
if (!fs.existsSync(voPath)) throw new Error(`Missing VO: ${voPath}`);

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const cues = (edit.cues ?? []).filter((cue) => cue.assetPath && Number(cue.end) > Number(cue.start));
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ftl-payoff-${slug}-`));
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

function labelFilter(text, size = 76) {
  if (!text) return "";
  const safe = escapeDrawtext(text);
  return `,drawtext=text='${safe}':fontcolor=0xFFE84D:fontsize=${size}:font='Arial Black':box=1:boxcolor=black@0.72:boxborderw=22:x=44:y=h-th-72`;
}

function videoFilter(label = "", size = 76) {
  return `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p${labelFilter(label, size)}`;
}

function hasAudio(file) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=index",
      "-of", "csv=p=0",
      file,
    ], { encoding: "utf8" }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

function renderVideo({ source, start, duration, out, label = "", size = 76 }) {
  run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-ss", Math.max(0, Number(start) || 0).toFixed(3),
    "-i", source,
    "-t", Math.max(0.05, duration).toFixed(3),
    "-an",
    "-vf", videoFilter(label, size),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-r", "30", "-g", "30", "-keyint_min", "30",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out,
  ]);
}

function renderFreeze({ source, time, duration, out, label }) {
  const framePath = `${out}.png`;
  run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-ss", Math.max(0, Number(time) || 0).toFixed(3),
    "-i", source,
    "-frames:v", "1",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba",
    framePath,
  ]);
  run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-loop", "1",
    "-i", framePath,
    "-t", Math.max(0.05, duration).toFixed(3),
    "-vf", videoFilter(label, 84),
    "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-r", "30", "-g", "30", "-keyint_min", "30",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out,
  ]);
}

function concatVideo(parts, out) {
  const args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"];
  for (const part of parts) args.push("-i", part);
  const streams = parts.map((_, index) => `[${index}:v:0]`).join("");
  args.push(
    "-filter_complex", `${streams}concat=n=${parts.length}:v=1:a=0[v]`,
    "-map", "[v]",
    "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-r", "30", "-g", "30", "-keyint_min", "30",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out,
  );
  run(args);
}

function concatAv(parts, out) {
  const args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"];
  for (const part of parts) args.push("-i", part);
  const streams = parts.map((_, index) => `[${index}:v:0][${index}:a:0]`).join("");
  const filter = `${streams}concat=n=${parts.length}:v=1:a=1[v][a]`;
  args.push(
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-r", "30", "-g", "30", "-keyint_min", "30",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    out,
  );
  run(args);
}

function muxVo(video, voStart, duration, out) {
  run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-i", video,
    "-ss", Math.max(0, voStart).toFixed(3),
    "-i", voPath,
    "-t", Math.max(0.05, duration).toFixed(3),
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-shortest",
    "-movflags", "+faststart",
    out,
  ]);
}

function renderAnalysisCue(cue, index) {
  const source = cue.assetPath;
  const duration = Number(cue.end) - Number(cue.start);
  const sourceIn = Number(cue.sourceIn ?? 0);
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
  const silentPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-silent.mp4`);

  if (freeze) {
    const freezeStart = Math.max(0.8, Math.min(duration - 0.2, Number(freeze.startOffset ?? 2.8)));
    const freezeDur = Math.max(0.5, Math.min(Number(freeze.duration ?? 5), duration - freezeStart));
    const parts = [];
    const setupPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-setup.mp4`);
    renderVideo({ source, start: sourceIn, duration: freezeStart, out: setupPath });
    parts.push(setupPath);
    const freezePath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-freeze.mp4`);
    renderFreeze({ source, time: Number(freeze.sourceTime ?? sourceIn), duration: freezeDur, out: freezePath, label: freeze.label || "" });
    parts.push(freezePath);
    const fillDur = Math.max(0.05, duration - freezeStart - freezeDur);
    const fillPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-fill.mp4`);
    renderVideo({ source, start: Math.max(sourceIn, Number(freeze.sourceTime ?? sourceIn) - 1), duration: fillDur, out: fillPath });
    parts.push(fillPath);
    concatVideo(parts, silentPath);
  } else {
    const label = (cue.overlays ?? []).join("  |  ");
    renderVideo({ source, start: sourceIn, duration, out: silentPath, label, size: index === 0 ? 64 : 58 });
  }

  const withVoPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-vo.mp4`);
  muxVo(silentPath, Number(cue.start), duration, withVoPath);
  return withVoPath;
}

function renderPayoff(cue, index) {
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
  if (!freeze) return null;
  const source = cue.assetPath;
  const sourceIn = Number(cue.sourceIn ?? 0);
  const start = Math.max(sourceIn, Number(freeze.sourceTime ?? sourceIn) - 0.6);
  const out = path.join(workDir, `cue-${String(index).padStart(3, "0")}-broadcast-payoff.mp4`);
  const inputHasAudio = hasAudio(source);
  const args = [
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-ss", start.toFixed(3),
    "-i", source,
    "-t", payoffSeconds.toFixed(3),
    "-vf", videoFilter("LET IT PLAY", 62),
  ];
  if (inputHasAudio) {
    args.push("-map", "0:v:0", "-map", "0:a:0", "-af", "volume=1.15", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2");
  } else {
    args.push("-f", "lavfi", "-t", payoffSeconds.toFixed(3), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k");
  }
  args.push(
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-r", "30", "-g", "30", "-keyint_min", "30",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out,
  );
  run(args);
  return out;
}

try {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    if (!fs.existsSync(cue.assetPath)) throw new Error(`Missing asset: ${cue.assetPath}`);
    segmentPaths.push(renderAnalysisCue(cue, i));
    const payoff = renderPayoff(cue, i);
    if (payoff) segmentPaths.push(payoff);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  concatAv(segmentPaths, outPath);
  console.log(outPath);
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
