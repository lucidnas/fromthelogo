#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slug, section, startArg, endArg] = process.argv;

if (!slug || !section || startArg == null || endArg == null) {
  console.error("Usage: node tools/create-section-render-input.mjs SLUG SECTION START END");
  process.exit(1);
}

const start = Number(startArg);
const end = Number(endArg);
if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
  console.error(`Invalid section bounds: ${startArg} ${endArg}`);
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const sourceDir = `${SSD}/ftl/videos/${slug}`;
const sectionSlug = `${slug}-section-${section}`;
const sectionDir = `${SSD}/ftl/videos/${sectionSlug}`;
const duration = end - start;

const sourceEditPath = `${sourceDir}/edit-script-johnny.json`;
const sourceVoPath = `${sourceDir}/vo.mp3`;
const sourceFlatPath = `${sourceDir}/flat-background.mp4`;

for (const p of [sourceEditPath, sourceVoPath, sourceFlatPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing required source: ${p}`);
    process.exit(1);
  }
}

fs.rmSync(sectionDir, { recursive: true, force: true });
fs.mkdirSync(sectionDir, { recursive: true });

function trimMedia(input, output, extraArgs = []) {
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", start.toFixed(3),
    "-i", input,
    "-t", duration.toFixed(3),
    ...extraArgs,
    output,
  ]);
}

trimMedia(sourceVoPath, `${sectionDir}/vo.mp3`, [
  "-ar", "44100", "-ac", "2", "-b:a", "192k",
]);

trimMedia(sourceFlatPath, `${sectionDir}/flat-background.mp4`, [
  "-vf", "fps=30,setpts=PTS-STARTPTS",
  "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
  "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-keyint_min", "30",
  "-movflags", "+faststart",
]);

const edit = JSON.parse(fs.readFileSync(sourceEditPath, "utf8"));
const cues = (edit.cues ?? [])
  .filter((cue) => Number(cue.end) > start && Number(cue.start) < end)
  .map((cue) => {
    const originalStart = Number(cue.start);
    const originalEnd = Number(cue.end);
    const clippedStart = Math.max(originalStart, start);
    const clippedEnd = Math.min(originalEnd, end);
    const shifted = structuredClone(cue);
    shifted.start = +(clippedStart - start).toFixed(3);
    shifted.end = +(clippedEnd - start).toFixed(3);

    const trimDelta = clippedStart - originalStart;
    const isVideo = shifted.assetPath && !/\.(jpe?g|png|webp)$/i.test(shifted.assetPath);
    if (trimDelta > 0.001 && isVideo) {
      shifted.sourceIn = +((Number(shifted.sourceIn ?? 0)) + trimDelta).toFixed(3);
    }

    if (trimDelta > 0.001 && Array.isArray(shifted.graphics)) {
      shifted.graphics = shifted.graphics
        .map((graphic) => {
          const next = { ...graphic };
          next.startOffset = Math.max(0, Number(next.startOffset ?? 0) - trimDelta);
          return next;
        })
        .filter((graphic) => Number(graphic.startOffset ?? 0) < shifted.end - shifted.start);
    }

    if (Array.isArray(shifted.freezeFrames)) {
      const cueDuration = shifted.end - shifted.start;
      shifted.freezeFrames = shifted.freezeFrames
        .map((freeze) => {
          const next = { ...freeze };
          const originalOffset = Number(next.startOffset ?? 0);
          next.startOffset = Math.max(0, +(originalOffset - trimDelta).toFixed(3));
          const remaining = cueDuration - next.startOffset;
          next.duration = Math.min(Number(next.duration ?? 0), Math.max(0, remaining));
          return next;
        })
        .filter((freeze) => Number(freeze.duration ?? 0) > 0.05 && Number(freeze.startOffset ?? 0) < cueDuration);
    }

    return shifted;
  });

const sectionEdit = {
  ...edit,
  sourceSlug: slug,
  section,
  sectionStart: start,
  sectionEnd: end,
  voiceDuration: +duration.toFixed(3),
  cues,
};

fs.writeFileSync(`${sectionDir}/edit-script-johnny.json`, JSON.stringify(sectionEdit, null, 2) + "\n");

console.log(JSON.stringify({
  sectionSlug,
  sectionDir,
  duration: +duration.toFixed(3),
  cues: cues.length,
}, null, 2));
