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

function normalizeCardLine(text, index) {
  const value = String(text ?? "");
  if (/FEVER 90,\s*VALKYRIES 82/i.test(value)) return "FEVER 90-82  |  CLARK: 22 PTS, 9 AST, 4 3s";
  if (/22 PTS/i.test(value) && /9 AST/i.test(value)) return "22 PTS  |  9 AST  |  4 3s";
  return value;
}

function labelFilter(text, size = 76) {
  if (!text) return "";
  const parts = String(text).split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const cardW = 690;
    const cardH = parts.length >= 3 ? 230 : 185;
    const cardX = 58;
    const cardY = 62;
    const yBase = cardY + 54;
    const filters = [
      `drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=black@0.78:t=fill`,
      `drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=0xFFE84D@0.95:t=5`,
      `drawbox=x=${cardX + 28}:y=${cardY + 24}:w=106:h=7:color=0xFFE84D@1:t=fill`,
    ];
    parts.slice(0, 3).forEach((part, index) => {
      const normalized = normalizeCardLine(part, index);
      const safe = escapeDrawtext(normalized);
      const fontSize = index === 0 ? 44 : index === 1 ? 42 : 28;
      const color = index === 2 ? "white" : "0xFFE84D";
      filters.push(`drawtext=text='${safe}':fontcolor=${color}:fontsize=${fontSize}:font='Arial Black':box=0:x=${cardX + 30}:y=${yBase + index * 52}`);
    });
    return `,${filters.join(",")}`;
  }
  const safe = escapeDrawtext(text);
  return `,drawtext=text='${safe}':fontcolor=0xFFE84D:fontsize=${size}:font='Arial Black':box=1:boxcolor=black@0.72:boxborderw=28:x=44:y=h-th-78`;
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

function sentenceBreaksRelSecs(text, duration) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const matches = [...clean.matchAll(/[^.!?]+[.!?]+/g)];
  if (!matches.length) return [];
  const totalChars = clean.length;
  return matches
    .map((match) => {
      const end = (match.index ?? 0) + match[0].length;
      return (end / totalChars) * duration;
    })
    .filter((time) => time > 0.5 && time < duration - 0.5);
}

function naturalBreakRelSec(cue, duration, target) {
  const breaks = sentenceBreaksRelSecs(cue.vo, duration);
  const candidates = breaks.filter((time) => time >= target - 1.4 && time <= target + 3.2);
  if (candidates.length) {
    return candidates.reduce((best, time) => Math.abs(time - target) < Math.abs(best - target) ? time : best, candidates[0]);
  }
  const nextBreak = breaks.find((time) => time > target);
  if (nextBreak && nextBreak <= target + 5) return nextBreak;
  return target;
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

function renderAnalysisCue(cue, index, { relStart = 0, durationOverride = null, suffix = "vo" } = {}) {
  const source = cue.assetPath;
  const cueDuration = Number(cue.end) - Number(cue.start);
  const duration = Math.max(0.05, Number(durationOverride ?? cueDuration));
  const sourceIn = Number(cue.sourceIn ?? 0);
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
  const silentPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-${suffix}-silent.mp4`);

  if (freeze && relStart === 0) {
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
    const visualStart = freeze
      ? Math.max(sourceIn, Number(freeze.sourceTime ?? sourceIn) - 0.35)
      : sourceIn + Math.max(0, relStart * 0.6);
    renderVideo({ source, start: visualStart, duration, out: silentPath, label, size: index === 0 ? 82 : 58 });
  }

  const withVoPath = path.join(workDir, `cue-${String(index).padStart(3, "0")}-${suffix}-vo.mp4`);
  muxVo(silentPath, Number(cue.start) + Math.max(0, relStart), duration, withVoPath);
  return withVoPath;
}

function renderPayoff(cue, index, { suffix = "broadcast-payoff", label = "LET IT PLAY", start = null, duration = null } = {}) {
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
  if (!freeze) return null;
  const source = cue.assetPath;
  const sourceIn = Number(cue.sourceIn ?? 0);
  const sourceOut = Number(cue.sourceOut ?? sourceIn + payoffSeconds);
  const clipStart = Number.isFinite(Number(start)) ? Number(start) : Math.max(sourceIn, Number(freeze.sourceTime ?? sourceIn) - 0.6);
  const clipDuration = Number.isFinite(Number(duration))
    ? Math.max(0.5, Number(duration))
    : Math.max(4.5, Math.min(7, sourceOut - clipStart + 0.9));
  const out = path.join(workDir, `cue-${String(index).padStart(3, "0")}-${suffix}.mp4`);
  const inputHasAudio = hasAudio(source);
  if (inputHasAudio) {
    run([
      "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
      "-ss", clipStart.toFixed(3),
      "-i", source,
      "-t", clipDuration.toFixed(3),
      "-vf", videoFilter(label, 62),
      "-map", "0:v:0", "-map", "0:a:0",
      "-af", "volume=1.15",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
      "-r", "30", "-g", "30", "-keyint_min", "30",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart",
      out,
    ]);
  } else {
    run([
      "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
      "-ss", clipStart.toFixed(3),
      "-i", source,
      "-f", "lavfi", "-t", clipDuration.toFixed(3),
      "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-t", clipDuration.toFixed(3),
      "-vf", videoFilter(label, 62),
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
      "-r", "30", "-g", "30", "-keyint_min", "30",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart",
      out,
    ]);
  }
  return out;
}

function renderCueSegments(cue, index) {
  const duration = Number(cue.end) - Number(cue.start);
  const freeze = Array.isArray(cue.freezeFrames) && cue.freezeFrames.length ? cue.freezeFrames[0] : null;
  if (!freeze) return [renderAnalysisCue(cue, index)];

  const freezeStart = Math.max(0.8, Math.min(duration - 0.2, Number(freeze.startOffset ?? 2.8)));
  const freezeDur = Math.max(0.5, Math.min(Number(freeze.duration ?? 5), duration - freezeStart));
  const targetReadDuration = Math.min(duration, freezeStart + freezeDur);
  const readDuration = Math.min(duration, naturalBreakRelSec(cue, duration, targetReadDuration));
  const segments = [renderAnalysisCue(cue, index, {
    durationOverride: readDuration,
    suffix: "read",
  })];

  const sourceIn = Number(cue.sourceIn ?? 0);
  const sourceOut = Number(cue.sourceOut ?? sourceIn + payoffSeconds);
  const payoffStart = sourceIn;
  const payoffDuration = Math.max(5.2, Math.min(8.5, sourceOut - payoffStart));
  const payoff = renderPayoff(cue, index, {
    start: payoffStart,
    duration: payoffDuration,
    suffix: "inbeat-broadcast-payoff",
    label: "LET IT PLAY",
  });
  if (payoff) segments.push(payoff);

  const remaining = duration - readDuration;
  if (remaining > 0.1) {
    segments.push(renderAnalysisCue(cue, index, {
      relStart: readDuration,
      durationOverride: remaining,
      suffix: "tail",
    }));
  }
  return segments;
}

try {
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    if (!fs.existsSync(cue.assetPath)) throw new Error(`Missing asset: ${cue.assetPath}`);
    segmentPaths.push(...renderCueSegments(cue, i));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  concatAv(segmentPaths, outPath);
  console.log(outPath);
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
