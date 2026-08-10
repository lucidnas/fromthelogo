#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/minute-02-josh";
const VOICE = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/josh-section-01";
const PREP = "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute02";
const SOURCES = {
  atl: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/atl-1m21-normalized.mp4",
  min: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022400204/226.mp4",
  minTurnSlow: path.join(PREP, "min-turn-slow.mp4"),
  minPayoffSlow: path.join(PREP, "min-payoff-slow.mp4"),
};
const STILLS = {
  atlRead: path.join(PREP, "atl-read.jpg"),
  minLoad: path.join(PREP, "min-load.jpg"),
  minWindow: path.join(PREP, "min-window.jpg"),
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

function attrs(start, span, track = 0) {
  return `data-start="${start.toFixed(3)}" data-duration="${span.toFixed(3)}" data-track-index="${track}"`;
}

function video(id, src, start, span, mediaStart = 0, cls = "") {
  return `<video id="${id}" class="clip footage ${cls}" ${attrs(start, span)} src="assets/${src}.mp4" data-media-start="${mediaStart.toFixed(3)}" muted playsinline></video>`;
}

function freeze(id, src, start, span, cls = "") {
  return `<img id="${id}" class="clip footage freeze ${cls}" ${attrs(start, span)} src="assets/${src}.jpg" alt="">`;
}

fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
for (const [name, source] of Object.entries(SOURCES)) link(source, path.join(ROOT, "assets", `${name}.mp4`));
for (const [name, source] of Object.entries(STILLS)) link(source, path.join(ROOT, "assets", `${name}.jpg`));

const voiceIndices = [4, 5, 6, 7];
const voiceFiles = voiceIndices.map(i => path.join(VOICE, `continuous-${String(i).padStart(2, "0")}.mp3`));
const voiceDurations = voiceFiles.map(duration);
voiceFiles.forEach((source, i) => link(source, path.join(ROOT, "assets", `vo-${i}.mp3`)));
const starts = [];
let cursor = 0;
for (const span of voiceDurations) { starts.push(cursor); cursor += span; }
const total = cursor + 0.3;

const visuals = [
  // Close the Atlanta thought with new evidence: a clean decision frame, then only the payoff portion of the replay.
  freeze("atl-read-freeze", "atlRead", 0, 4.0),
  video("atl-pass-payoff", "atl", 4.0, voiceDurations[0] - 4.0, 28.0, "crop-atl"),

  // Minnesota plays once, in sequence. Live setup -> freeze -> slow continuation -> freeze -> slow release -> live finish.
  video("min-establish", "min", starts[1], 1.35, 0),
  freeze("min-loaded-help", "minLoad", starts[1] + 1.35, 3.7),
  video("min-turn-slow", "minTurnSlow", starts[1] + 5.05, voiceDurations[1] - 5.05, 0),

  freeze("min-open-window", "minWindow", starts[2], 4.0),
  video("min-payoff-slow", "minPayoffSlow", starts[2] + 4.0, 5.0, 0),
  video("min-finish", "min", starts[2] + 9.0, voiceDurations[2] - 9.0, 3.95, "crop-min"),

  // Compare the two structures without restarting either full possession.
  video("atl-comparison", "atl", starts[3], 4.2, 19.0, "crop-atl"),
  video("min-comparison", "min", starts[3] + 4.2, voiceDurations[3] - 4.2, 1.35, "crop-min"),
];

const audios = voiceFiles.map((_, i) => `<audio id="voice-${i}" class="clip" ${attrs(starts[i], voiceDurations[i], 10 + i)} src="assets/vo-${i}.mp3" data-volume="1"></audio>`).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders — Minute 02</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050608}.composition{position:relative;width:1920px;height:1080px;overflow:hidden}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;filter:saturate(1.08) contrast(1.035) brightness(1.02)}.crop-atl{object-position:51% 50%}.crop-min{object-position:50% 50%}.edge{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(0,0,0,.22)}
</style></head><body><main id="why-two-defenders-minute-02" class="composition" data-composition-id="why-two-defenders-minute-02" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080"><div class="clip" ${attrs(0,total,-1)} style="position:absolute;inset:0;background:#050608"></div>${visuals.join("\n")}${audios}<div class="clip edge" ${attrs(0,total,20)}></div></main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-minute-02"]=gsap.timeline({paused:true});</script></body></html>`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "hyperframes.json"), JSON.stringify({ composition: "index.html", fps: 30, width: 1920, height: 1080 }, null, 2));
fs.writeFileSync(path.join(ROOT, "meta.json"), JSON.stringify({ title: "Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work", section: "minute-02", duration: total, narration: "Josh", noMusic: true, noBroadcastAudio: true, noDrawings: true }, null, 2));
console.log(JSON.stringify({ root: ROOT, duration: total, starts, voiceDurations }, null, 2));
