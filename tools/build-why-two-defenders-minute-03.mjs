#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/minute-03-josh";
const VOICE = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/josh-section-03";
const PREP = "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute03";
const SOURCES = {
  con: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022600201/397.mp4",
  conDeep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-yFs4tjhvJ58.mp4",
  atl: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/atl-1m21-normalized.mp4",
  min: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022400204/226.mp4",
  phxDeep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-lo7foKnQ1Ao.mp4",
  conSetupSlow: path.join(PREP, "con-setup-slow.mp4"),
  conDriveSlow: path.join(PREP, "con-drive-slow.mp4"),
  conPassSlow: path.join(PREP, "con-pass-slow-v2.mp4"),
  conFinishSlow: path.join(PREP, "con-finish-slow.mp4"),
};
const STILLS = {
  conLow: path.join(PREP, "con-low-commit.jpg"),
  conRoute: path.join(PREP, "con-route-open.jpg"),
  conFinish: path.join(PREP, "con-finish.jpg"),
  conRelease: path.join(PREP, "con-release.jpg"),
  conReaction: path.join(PREP, "con-reaction.jpg"),
  conRange: path.join(PREP, "con-range.jpg"),
  atlHigh: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/atl-high-freeze.jpg",
};

function duration(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return Number(r.stdout.trim());
}
function link(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.unlinkSync(target); } catch (e) { if (e.code !== "ENOENT") throw e; }
  fs.symlinkSync(source, target);
}
function attrs(start, span, track = 0) { return `data-start="${start.toFixed(3)}" data-duration="${span.toFixed(3)}" data-track-index="${track}"`; }
function video(id, src, start, span, mediaStart = 0, cls = "") { return `<video id="${id}" class="clip footage ${cls}" ${attrs(start, span)} src="assets/${src}.mp4" data-media-start="${mediaStart.toFixed(3)}" muted playsinline></video>`; }
function freeze(id, src, start, span, cls = "") { return `<img id="${id}" class="clip footage freeze ${cls}" ${attrs(start, span)} src="assets/${src}.jpg" alt="">`; }

fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
for (const [name, source] of Object.entries(SOURCES)) link(source, path.join(ROOT, "assets", `${name}.mp4`));
for (const [name, source] of Object.entries(STILLS)) link(source, path.join(ROOT, "assets", `${name}.jpg`));
const voiceFiles = Array.from({ length: 3 }, (_, i) => path.join(VOICE, `continuous-${String(i).padStart(2, "0")}.mp3`));
const voiceDurations = voiceFiles.map(duration);
voiceFiles.forEach((source, i) => link(source, path.join(ROOT, "assets", `vo-${i}.mp3`)));
const starts = [];
let cursor = 0;
for (const span of voiceDurations) { starts.push(cursor); cursor += span; }
const total = cursor + 0.3;

const visuals = [
  // The low defender moves before each short teaching freeze; slow motion carries the explanation.
  video("con-live-setup", "con", starts[0], 1.2, 0, "analytics-crop"),
  video("con-setup-slow", "conSetupSlow", starts[0] + 1.2, 2.5, 0, "analytics-crop"),
  freeze("con-low-defender-freeze", "conLow", starts[0] + 3.7, 2.0, "analytics-crop"),
  video("con-drive-slow", "conDriveSlow", starts[0] + 5.7, 3.0, 0, "analytics-crop"),
  freeze("con-route-preview", "conRoute", starts[0] + 8.7, 2.0, "analytics-crop"),
  video("con-pass-preview", "conPassSlow", starts[0] + 10.7, 3.67, 0, "analytics-crop"),
  freeze("con-release-preview", "conRelease", starts[0] + 14.37, voiceDurations[0] - 14.37, "analytics-crop"),

  // Resume from the open route, slow the delivery, and complete the reverse layup only once.
  freeze("con-route-explanation", "conRoute", starts[1], 2.0, "analytics-crop"),
  video("con-pass-slow", "conPassSlow", starts[1] + 2.0, 3.67, 0, "analytics-crop"),
  video("con-finish-slow", "conFinishSlow", starts[1] + 5.67, 2.0, 0, "analytics-crop"),
  video("con-payoff", "con", starts[1] + 7.67, 4.25, 5.5, "analytics-crop"),
  // Stay on the possession being analyzed. A clean finish hold lets the sentence
  // resolve without replaying the layup or cutting to an unrelated possession.
  freeze("con-finish-resolution", "conFinish", starts[1] + 11.92, voiceDurations[1] - 11.92, "analytics-crop"),

  // Connect range and passing with two different static receipts, not another full-play loop.
  video("con-range-payoff", "conDeep", starts[2], 5.0, 31.55, "analytics-crop"),
  `<div id="advanced-stats-clean-cover" class="clip watermark-clean-cover" ${attrs(starts[2], 5.0, 4)}></div>`,
  video("atlanta-first-line", "atl", starts[2] + 5.0, 4.0, 19.0),
  freeze("atlanta-high-show-hold", "atlHigh", starts[2] + 9.0, 3.0),
  video("minnesota-second-line", "min", starts[2] + 12.0, voiceDurations[2] - 12.0, 1.35),
];
const audios = voiceFiles.map((_, i) => `<audio id="voice-${i}" class="clip" ${attrs(starts[i], voiceDurations[i], 10 + i)} src="assets/vo-${i}.mp3" data-volume="1"></audio>`).join("\n");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders — Minute 03</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050608}.composition{position:relative;width:1920px;height:1080px;overflow:hidden}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;object-position:center;filter:saturate(1.14) contrast(1.06) brightness(1.035)}.analytics-crop{inset:auto!important;left:-106px!important;top:-60px!important;width:2132px!important;height:1200px!important;object-fit:cover!important;object-position:center!important}.watermark-clean-cover{position:absolute;top:0;left:760px;width:400px;height:42px;background:#000}.reaction-crop{object-position:58% 50%;transform:scale(1.06)}.range-wide{object-position:50% 50%}.low-crop{object-position:57% 50%;transform:scale(1.08)}.release-crop{object-position:53% 50%;transform:scale(1.05)}.edge{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(0,0,0,.22)}</style></head><body><main id="why-two-defenders-minute-03" class="composition" data-composition-id="why-two-defenders-minute-03" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080"><div id="background-fill" class="clip" ${attrs(0,total,-1)} style="position:absolute;inset:0;background:#050608"></div>${visuals.join("\n")}${audios}<div id="edge-vignette" class="clip edge" ${attrs(0,total,20)}></div></main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-minute-03"]=gsap.timeline({paused:true});</script></body></html>`;
fs.writeFileSync(path.join(ROOT, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "hyperframes.json"), JSON.stringify({ composition: "index.html", fps: 30, width: 1920, height: 1080 }, null, 2));
fs.writeFileSync(path.join(ROOT, "meta.json"), JSON.stringify({ title: "Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work", section: "minute-03", duration: total, narration: "Josh", noMusic: true, noBroadcastAudio: true, noDrawings: true }, null, 2));
console.log(JSON.stringify({ root: ROOT, duration: total, starts, voiceDurations }, null, 2));
