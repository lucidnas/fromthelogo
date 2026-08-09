#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";
const NARRATOR = (process.argv[2] ?? "jack").toLowerCase();
if (!new Set(["jack", "josh"]).has(NARRATOR)) throw new Error("Narrator must be jack or josh");
const ROOT = `/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/section-01-${NARRATOR}`;
const VOICE = `/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/${NARRATOR}-section-01`;
const SOURCES = {
  deep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-yFs4tjhvJ58.mp4",
  deepEvent: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022600201/55.mp4",
  atl: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/clip-4-20-4-54-LFC6S3BV5iE.mp4",
  min: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022400204/226.mp4",
  con: "/Volumes/SSK SSD/ftl-data/caitlin-clark-clip-bank/v2/1022600201/397.mp4",
};
const GAP = 0.18;

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
  return `<video id="${id}" class="clip footage ${cls}" ${attrs(start, span, 0)} src="assets/${src}.mp4" data-trim-start="${trimStart.toFixed(3)}" data-trim-end="${trimEnd.toFixed(3)}" muted playsinline></video>`;
}

function freeze(id, src, start, span, at, svg, cls = "") {
  return video(`${id}-frame`, src, start, span, at, at + 0.035, `freeze ${cls}`);
}

function circle(cx, cy, rx = 62, ry = 86) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
}

function arrow(id, d) {
  return `<defs><marker id="${id}" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto"><path d="M0 0 L14 7 L0 14 Z" fill="#FFD400"/></marker></defs><path class="arrow" d="${d}" marker-end="url(#${id})"/>`;
}

const atlHigh = `<svg viewBox="0 0 1920 1080">${circle(1432, 565)}${circle(1300, 563)}<path class="shade" d="M1110 460 L1325 460 L1238 814 L1020 814 Z"/><text x="1160" y="440">SPACE BEHIND THE SHOW</text></svg>`;
const atlLane = `<svg viewBox="0 0 1920 1080">${circle(1320, 558)}${circle(1192, 585)}${circle(1002, 614, 58, 82)}${arrow("atl-pass", "M1280 600 C1200 650 1110 670 1038 646")}<text x="930" y="520">BOSTON SLIPS BEHIND BOTH</text></svg>`;
const atlRead = `<svg viewBox="0 0 1920 1080">${circle(1432, 565)}${circle(1300, 563)}<path class="shade" d="M1110 460 L1325 460 L1238 814 L1020 814 Z"/></svg>`;
const minLoad = `<svg viewBox="0 0 1920 1080">${circle(1245, 500, 78, 112)}${circle(1035, 575, 78, 112)}<path class="shade" d="M825 430 L1190 430 L1040 820 L755 820 Z"/><text x="790" y="350">TWO DEFENDERS ORIENT TO CLARK</text></svg>`;
const minWindow = `<svg viewBox="0 0 1920 1080">${circle(1245, 500, 76, 108)}${circle(1035, 575, 76, 108)}${circle(825, 690, 66, 96)}${arrow("min-pass", "M1165 555 C1070 600 940 665 875 684")}<text x="720" y="375">THE WINDOW OPENS BEHIND THEM</text></svg>`;
const conThird = `<svg viewBox="0 0 1920 1080">${circle(720, 500, 66, 94)}${circle(790, 500, 66, 94)}${circle(1260, 530, 66, 94)}<text x="1030" y="395">NOW READ THE THIRD DEFENDER</text></svg>`;

fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
for (const [name, source] of Object.entries(SOURCES)) link(source, path.join(ROOT, "assets", `${name}.mp4`));

const voiceFiles = Array.from({ length: 9 }, (_, index) => path.join(VOICE, `continuous-${String(index).padStart(2, "0")}.mp3`));
const voiceDurations = voiceFiles.map(duration);
voiceFiles.forEach((source, index) => link(source, path.join(ROOT, "assets", `vo-${index}.mp3`)));
const starts = [];
let cursor = 0;
for (const span of voiceDurations) { starts.push(cursor); cursor += span + GAP; }
const total = cursor - GAP + 0.35;

const visuals = [];
// Range: play once, study the pickup point, then move to the first possession.
visuals.push(video("deep-live", "deep", starts[0], 6.6, 28.2, 34.8));
visuals.push(freeze("deep-freeze", "deep", starts[0] + 6.6, 4.2, 31.55, `<svg viewBox="0 0 1920 1080">${circle(1328, 636, 68, 88)}${circle(1056, 620, 68, 88)}${arrow("deep-gap", "M1260 670 C1190 662 1120 650 1104 640")}<text x="1110" y="515">THE BIG HAS TO MEET HER HERE</text></svg>`));
visuals.push(video("deep-finish", "deep", starts[0] + 10.8, starts[1] - (starts[0] + 10.8), 31.55, 34.93, "crop-a"));
visuals.push(video("deep-event", "deepEvent", starts[1], voiceDurations[1], 0.2, 9.16, "crop-b"));

// Atlanta: live setup, then sequential teaching freezes and a clean replay.
visuals.push(video("atl-establish", "atl", starts[2], 8.2, 14.4, 22.6));
visuals.push(freeze("atl-high", "atl", starts[2] + 8.2, 5.2, 18.65, atlHigh));
visuals.push(video("atl-motion-a", "atl", starts[2] + 13.4, 2.1, 18.65, 20.75));
visuals.push(freeze("atl-lane", "atl", starts[2] + 15.5, 6.0, 20.25, atlLane));
visuals.push(video("atl-payoff", "atl", starts[2] + 21.5, 3.2, 20.25, 23.45));
visuals.push(video("atl-reaction", "atl", starts[2] + 24.7, starts[4] - (starts[2] + 24.7), 23.45, 26.07, "crop-a"));
visuals.push(video("atl-replay", "atl", starts[4], 10.0, 23.8, 33.8, "crop-b"));
visuals.push(freeze("atl-read", "atl", starts[4] + 10.0, voiceDurations[4] - 10.0, 19.55, atlRead, "crop-b"));

// Minnesota: let the action establish before any pause, then explain the loaded help.
visuals.push(video("min-establish", "min", starts[5], 5.0, 0.0, 5.0));
visuals.push(freeze("min-load", "min", starts[5] + 5.0, 5.1, 1.35, minLoad));
visuals.push(video("min-turn", "min", starts[5] + 10.1, 2.3, 1.35, 3.65));
visuals.push(freeze("min-window", "min", starts[6], 6.0, 2.05, minWindow));
visuals.push(video("min-payoff", "min", starts[6] + 6.0, 5.9, 2.05, 7.95));
visuals.push(video("min-aftermath", "min", starts[6] + 11.9, Math.max(1.0, starts[7] - (starts[6] + 11.9)), 7.95, 10.1, "crop-c"));

// Compare the two geometries, then hand off to the third-defender section.
visuals.push(video("atl-compare", "atl", starts[7], 4.1, 18.1, 22.2, "crop-c"));
visuals.push(video("min-compare", "min", starts[7] + 4.1, voiceDurations[7] - 4.1, 1.0, 5.7, "crop-d"));
visuals.push(video("atl-final-compare", "atl", starts[8], 4.0, 19.0, 23.0, "crop-a"));
visuals.push(video("min-final-compare", "min", starts[8] + 4.0, 4.0, 1.2, 5.2, "crop-b"));
visuals.push(video("deep-stay-home", "deepEvent", starts[8] + 8.0, 5.0, 0.2, 5.2, "crop-b"));
visuals.push(video("con-establish", "con", starts[8] + 13.0, 2.2, 0.0, 2.2));
visuals.push(freeze("con-third", "con", starts[8] + 15.2, 3.0, 2.2, conThird));
visuals.push(video("con-payoff", "con", starts[8] + 18.2, Math.max(.2, total - (starts[8] + 18.2)), 2.2, 6.61, "crop-a"));

const audios = voiceFiles.map((_, index) => `<audio id="voice-${index}" class="clip" ${attrs(starts[index], voiceDurations[index], 10)} src="assets/vo-${index}.mp3" data-volume="1"></audio>`).join("\n");

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders Still Do Not Work — Section 01</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07090c;font-family:Inter,Arial,sans-serif}.composition{position:relative;width:1920px;height:1080px;overflow:hidden;background:#07090c}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;filter:saturate(1.1) contrast(1.04) brightness(1.02)}.crop-a{object-position:52% 50%}.crop-b{object-position:48% 50%}.crop-c{object-position:54% 50%}.crop-d{object-position:46% 50%}.drawing{position:absolute;inset:0;width:1920px;height:1080px;background:rgba(3,6,10,.08)}.drawing svg{width:100%;height:100%}.drawing ellipse,.drawing .arrow{fill:none;stroke:#FFD400;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 3px 2px rgba(0,0,0,.8))}.drawing .shade{fill:rgba(255,212,0,.13);stroke:#FFD400;stroke-width:3;stroke-dasharray:18 14}.drawing text{fill:#FFD400;font-family:Arial,sans-serif;font-size:38px;font-weight:900;letter-spacing:1.2px;paint-order:stroke;stroke:#080a0d;stroke-width:10px;stroke-linejoin:round}.vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 150px rgba(0,0,0,.45)}
</style></head>
<body><main id="why-two-defenders-s01" class="composition" data-composition-id="why-two-defenders-s01" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080">
<div id="background-fill" class="clip" data-start="0" data-duration="${total.toFixed(3)}" data-track-index="-1" style="position:absolute;inset:0;background:#07090c"></div>
${visuals.join("\n")}
${audios}
<div id="edge-vignette" class="clip vignette" data-start="0" data-duration="${total.toFixed(3)}" data-track-index="9"></div>
</main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-s01"]=gsap.timeline({paused:true});</script></body></html>`;

fs.writeFileSync(path.join(ROOT, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "hyperframes.json"), JSON.stringify({ composition: "index.html", fps: 30, width: 1920, height: 1080 }, null, 2));
fs.writeFileSync(path.join(ROOT, "meta.json"), JSON.stringify({ title: "Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work", section: 1, duration: total, narration: NARRATOR === "jack" ? "Jack" : "Josh", noMusic: true, noBroadcastAudio: true, sourceScript: path.join(REPO, "research/daniel-li-bank/why-two-defenders-section-01-script.md") }, null, 2));
console.log(JSON.stringify({ root: ROOT, duration: total, starts, voiceDurations }, null, 2));
