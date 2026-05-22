#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slugArg] = process.argv;
const slug = slugArg || "fever-storm-2026-05-17";
const videoDir = `/Volumes/SSK SSD/ftl/videos/${slug}`;
const editPath = `${videoDir}/edit-script-johnny.json`;

if (!fs.existsSync(editPath)) {
  console.error(`Missing edit script: ${editPath}`);
  process.exit(1);
}

function probe(filePath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,avg_frame_rate:format=duration,size,bit_rate",
    "-of", "json",
    filePath,
  ], { encoding: "utf8" });
  const data = JSON.parse(out);
  const stream = data.streams?.[0] || {};
  const format = data.format || {};
  return {
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    fps: stream.avg_frame_rate || "",
    duration: Number(format.duration || 0),
    size: Number(format.size || 0),
    bitrate: Number(format.bit_rate || 0),
  };
}

function qualityLabel(meta) {
  const pixels = meta.width * meta.height;
  if (meta.width >= 1920 && meta.height >= 1080) return "HIGH_1080";
  if (meta.width >= 1080 && meta.height >= 1350) return "HIGH_VERTICAL";
  if (pixels >= 1280 * 720) return "OK_720";
  return "LOW";
}

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const rows = [];
const seen = new Map();

for (const [index, cue] of (edit.cues || []).entries()) {
  const assetPath = cue.assetPath;
  if (!assetPath || /\.(jpe?g|png|webp)$/i.test(assetPath)) continue;
  if (!fs.existsSync(assetPath)) {
    rows.push({ index, start: cue.start, end: cue.end, beat: cue.beat, assetPath, quality: "MISSING" });
    continue;
  }
  let meta = seen.get(assetPath);
  if (!meta) {
    meta = probe(assetPath);
    seen.set(assetPath, meta);
  }
  rows.push({
    index,
    start: cue.start,
    end: cue.end,
    beat: cue.beat,
    asset: path.basename(assetPath),
    sourceIn: cue.sourceIn,
    sourceOut: cue.sourceOut,
    resolution: `${meta.width}x${meta.height}`,
    bitrateKbps: Math.round(meta.bitrate / 1000),
    duration: Number(meta.duration.toFixed(1)),
    quality: qualityLabel(meta),
  });
}

const weak = rows.filter((row) => !["HIGH_1080", "HIGH_VERTICAL"].includes(row.quality));
console.log(JSON.stringify({
  slug,
  editPath,
  totalVideoCues: rows.length,
  weakCueCount: weak.length,
  weakCues: weak,
  policy: {
    primaryGameAnalysis: "Use 1920x1080 or high-res official vertical sources whenever available.",
    socialBroll: "Allow 720p only for unique social/personality moments with no cleaner source.",
    finalRender: "Render approved chunks at high/final quality, not draft.",
  },
}, null, 2));

if (weak.some((row) => row.quality === "MISSING" || row.quality === "LOW")) {
  process.exitCode = 2;
}
