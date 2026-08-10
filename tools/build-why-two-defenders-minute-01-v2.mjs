#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/minute-01-v2-josh";
const VOICE = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/josh-section-01";
const SOURCES = {
  conDeep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-yFs4tjhvJ58.mp4",
  phxDeep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-lo7foKnQ1Ao.mp4",
  atlRoll: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/atl-1m21-normalized.mp4",
  conSlow: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/con-release-slow.mp4",
  phxSlow: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/phx-release-slow.mp4",
  atlSlow: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/atl-read-slow.mp4",
};
const STILLS = {
  conFreeze: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/con-freeze.jpg",
  phxFreeze: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/phx-freeze.jpg",
  atlHighFreeze: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/atl-high-freeze.jpg",
  atlWindowFreeze: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/atl-window-freeze.jpg",
};

function duration(file) {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return Number(result.stdout.trim());
}

function link(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.unlinkSync(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
  fs.symlinkSync(source, target);
}

function attrs(start, span, track = 0) {
  return `data-start="${start.toFixed(3)}" data-duration="${span.toFixed(3)}" data-track-index="${track}"`;
}

function video(id, src, start, span, trimStart, trimEnd, cls = "") {
  return `<video id="${id}" class="clip footage ${cls}" ${attrs(start, span)} src="assets/${src}.mp4" data-media-start="${trimStart.toFixed(3)}" muted playsinline></video>`;
}

function freeze(id, src, start, span) {
  return `<img id="${id}" class="clip footage freeze" ${attrs(start, span)} src="assets/${src}.jpg" alt="">`;
}

fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
for (const [name, source] of Object.entries(SOURCES)) {
  link(source, path.join(ROOT, "assets", `${name}.mp4`));
}
for (const [name, source] of Object.entries(STILLS)) {
  link(source, path.join(ROOT, "assets", `${name}.jpg`));
}

const voiceFiles = Array.from({ length: 4 }, (_, index) => path.join(VOICE, `continuous-${String(index).padStart(2, "0")}.mp3`));
const voiceDurations = voiceFiles.map(duration);
voiceFiles.forEach((source, index) => link(source, path.join(ROOT, "assets", `vo-${index}.mp3`)));
const starts = [];
let cursor = 0;
for (const span of voiceDurations) {
  starts.push(cursor);
  cursor += span;
}
const total = cursor + 0.35;

const visuals = [
  // Possession 1: run into the shooting pocket, hold the decision point, then finish in slow motion.
  video("con-setup", "conDeep", 0, 4.2, 28.2, 32.4),
  freeze("con-decision-freeze", "conFreeze", 4.2, 4.5),
  video("con-release-slow", "conSlow", 8.7, starts[1] - 8.7, 0, 6.42, "slow"),

  // Possession 2: a different official 31.2-foot make. No loop; freeze once, then resume the same play.
  video("phx-setup", "phxDeep", starts[1], 2.9, 5.0, 6.55),
  freeze("phx-distance-freeze", "phxFreeze", starts[1] + 2.9, 3.5),
  video("phx-release-slow", "phxSlow", starts[1] + 6.4, voiceDurations[1] - 6.4, 0, 4.32, "slow"),

  // Possession 3: full Atlanta buildup, freeze the high show, resume slowly to the pass,
  // freeze the open lane, then play the finish and the official replay exactly once.
  video("atl-buildup", "atlRoll", starts[2], 1.4, 19.0, 20.4),
  freeze("atl-high-show-freeze", "atlHighFreeze", starts[2] + 1.4, 4.0),
  video("atl-read-slow", "atlSlow", starts[2] + 5.4, voiceDurations[2] - 5.4, 0, 7.0, "slow"),
  freeze("atl-window-freeze", "atlWindowFreeze", starts[3], 3.0),
  video("atl-payoff", "atlRoll", starts[3] + 3.0, 3.6, 22.5, 24.5),
  video("atl-replay", "atlRoll", starts[3] + 6.6, voiceDurations[3] - 6.6, 25.0, 33.36),
];

const audios = voiceFiles.map((_, index) =>
  `<audio id="voice-${index}" class="clip" ${attrs(starts[index], voiceDurations[index], 10 + index)} src="assets/vo-${index}.mp3" data-volume="1"></audio>`,
).join("\n");

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders — Minute 01 v2</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050608}.composition{position:relative;width:1920px;height:1080px;overflow:hidden}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;object-position:center center}.edge{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(0,0,0,.22)}
</style></head>
<body><main id="why-two-defenders-minute-01-v2" class="composition" data-composition-id="why-two-defenders-minute-01-v2" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080">
<div id="background-fill" class="clip" ${attrs(0, total, -1)} style="position:absolute;inset:0;background:#050608"></div>
${visuals.join("\n")}
${audios}
<div id="edge-vignette" class="clip edge" ${attrs(0, total, 20)}></div>
</main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-minute-01-v2"]=gsap.timeline({paused:true});</script></body></html>`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "hyperframes.json"), JSON.stringify({ composition: "index.html", fps: 30, width: 1920, height: 1080 }, null, 2));
fs.writeFileSync(path.join(ROOT, "meta.json"), JSON.stringify({
  title: "Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work",
  section: "minute-01-v2",
  duration: total,
  narration: "Josh",
  noMusic: true,
  noBroadcastAudio: true,
  noDrawings: true,
  sourceReceipts: [
    { url: "https://www.youtube.com/watch?v=yFs4tjhvJ58", gameDate: "2026-07-22", event: "Clark 29.99-foot three" },
    { url: "https://www.youtube.com/watch?v=lo7foKnQ1Ao", gameDate: "2026-06-24", event: "Clark 31.2-foot step-back three" },
    { url: "https://www.youtube.com/watch?v=LFC6S3BV5iE", gameDate: "2025-05-20", event: "Boston cutting layup, Clark assist, Q4 1:21" },
  ],
}, null, 2));
console.log(JSON.stringify({ root: ROOT, duration: total, starts, voiceDurations }, null, 2));
