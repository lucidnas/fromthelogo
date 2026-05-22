#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slug] = process.argv;
if (!slug) {
  console.error("Usage: node tools/build-flat-background.mjs SLUG");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const videoDir = `${SSD}/ftl/videos/${slug}`;
const scriptPath = `${videoDir}/edit-script-johnny-v2.json`;
const outPath = `${videoDir}/flat-background.mp4`;
const workDir = `${videoDir}/flat-background-work`;
const brollDir = `${SSD}/broll/aroll/${slug.replace(/-part[123]$/, "")}`;

const montageAssetMap = {
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
  "EVERY MOVE BEFORE IT": "first-layup-live.mp4",
  "THE PERFECT ENDING": "thousand-live-official.mp4",
  "THE MENU": "first-layup-live.mp4",
  "TOO MANY VERSIONS": "twenty-nine-three-live.mp4",
};

fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const duration = data.voiceDuration;
const segments = [];
let lastMedia = null;

function renderBlackSegment(durationSecs) {
  const out = path.join(workDir, `segment-${String(segments.length).padStart(3, "0")}-black.mp4`);
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=black:s=1920x1080:r=30",
    "-t", durationSecs.toFixed(3),
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", out,
  ]);
  segments.push(out);
}

function renderMediaSegment(input, durationSecs, sourceIn = 0, options = {}) {
  const out = path.join(workDir, `segment-${String(segments.length).padStart(3, "0")}-${path.basename(input).replace(/\W+/g, "-")}.mp4`);
  const isImage = /\.(jpe?g|png|webp)$/i.test(input);
  const imageMode = options.imageMode ?? "full";
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (isImage) {
    args.push("-loop", "1", "-i", input);
  } else {
    args.push("-stream_loop", "-1", "-ss", Math.max(0, sourceIn).toFixed(3), "-i", input);
  }
  args.push(
    "-t", durationSecs.toFixed(3),
    "-an",
    "-vf",
    isImage && imageMode === "ken-burns"
      ? "scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,zoompan=z='min(zoom+0.0007,1.08)':x='iw/2-(iw/zoom/2)-24*on/(30*10)':y='ih/2-(ih/zoom/2)-10*on/(30*10)':d=1:s=1920x1080:fps=30,setpts=PTS-STARTPTS"
      : "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setpts=PTS-STARTPTS",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-keyint_min", "30",
    "-movflags", "+faststart",
    out,
  );
  execFileSync("ffmpeg", args);
  segments.push(out);
  lastMedia = { input, sourceIn };
}

function renderFreezeHoldSegment(input, durationSecs, sourceTime = 0) {
  const framePath = path.join(workDir, `freeze-${String(segments.length).padStart(3, "0")}-${path.basename(input).replace(/\W+/g, "-")}.png`);
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", Math.max(0, sourceTime).toFixed(3),
    "-i", input,
    "-frames:v", "1",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=rgba",
    framePath,
  ]);
  renderMediaSegment(framePath, durationSecs, 0);
}

let cursor = 0;
for (const cue of data.cues) {
  if (cue.start > cursor + 0.02) {
    const gapDuration = cue.start - cursor;
    if (lastMedia) {
      renderMediaSegment(lastMedia.input, gapDuration, lastMedia.sourceIn);
    } else {
      renderBlackSegment(gapDuration);
    }
  }
  const cueDur = cue.end - cue.start;
  if (cue.asset === "split-montage") {
    const labels = cue.overlays?.length ? cue.overlays : ["DRIVE", "RANGE", "LOGO PRESSURE", "PASS"];
    const itemDur = cueDur / labels.length;
    for (const rawLabel of labels) {
      const label = rawLabel.toUpperCase();
      const assetName = montageAssetMap[rawLabel] ?? montageAssetMap[label] ?? "thousand-live-official.mp4";
      const src = `${brollDir}/cuts/${assetName}`;
      renderMediaSegment(src, itemDur, 0);
    }
  } else if (cue.assetPath) {
    const isImage = /\.(jpe?g|png|webp)$/i.test(cue.assetPath);
    const wantsOverlay = cue.visualMode === "overlay" || cue.treatment?.toLowerCase().includes("overlay");
    if (!isImage && cue.backgroundMode === "freeze") {
      renderFreezeHoldSegment(cue.assetPath, cueDur, (cue.sourceIn ?? 0) + (cue.holdFrameTime ?? 0));
    } else if (isImage && wantsOverlay) {
      if (lastMedia) {
        renderMediaSegment(lastMedia.input, cueDur, lastMedia.sourceIn);
      } else {
        renderBlackSegment(cueDur);
      }
    } else {
      renderMediaSegment(cue.assetPath, cueDur, cue.sourceIn ?? 0, { imageMode: isImage ? "ken-burns" : "full" });
    }
  } else {
    renderBlackSegment(cueDur);
  }
  cursor = cue.end;
}
if (duration > cursor + 0.02) renderBlackSegment(duration - cursor);

const listPath = path.join(workDir, "concat.txt");
fs.writeFileSync(listPath, segments.map((file) => `file '${file.replaceAll("'", "'\\\\''")}'`).join("\n") + "\n");
execFileSync("ffmpeg", [
  "-y", "-hide_banner", "-loglevel", "error",
  "-f", "concat", "-safe", "0", "-i", listPath,
  "-c", "copy", outPath,
]);

console.log(`Wrote ${outPath}`);
