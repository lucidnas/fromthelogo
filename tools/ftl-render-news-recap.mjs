#!/usr/bin/env node
// FTL News Recap — image-led Hyperframes renderer.
// Combines the in-repo Hyperframes composition pattern (tools/make-ftl-hyperframes-short.mjs)
// with the kinetic-video word-alignment idea to render a 16:9 news recap from:
//   <video-dir>/vo.mp3        (Johnny VO)
//   <video-dir>/beats.json    (from ftl-news-build-beats.mjs)
//   <video-dir>/images/*      (ai-image / receipt / broll-still beats)
//   <video-dir>/clips/*       (broll-video beats)
//
// Pipeline: whisper word timestamps -> align beats + captions to the VO timeline ->
// write a Hyperframes project (index.html + hyperframes.json) -> inspect -> render (wrapped in
// render-hyperframes-clean.mjs so leftover Chrome/ffmpeg workers are killed).
//
// Usage:
//   node tools/ftl-render-news-recap.mjs --slug SLUG [--video-dir DIR] [--quality draft|standard|high]
//        [--music PATH|none] [--music-volume 0.18] [--whisper-model base.en] [--prepare-only]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";
const SSD_VIDEOS = "/Volumes/SSK SSD/ftl/videos";
const DEFAULT_MUSIC = "/Volumes/SSK SSD/Desktop/Background Music/Anno Domini Beats - Like That.mp3";
const HANDLE = "@fromthelogo22";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(`Usage:
  node tools/ftl-render-news-recap.mjs --slug SLUG [options]

Options:
  --video-dir DIR      Default: /Volumes/SSK SSD/ftl/videos/<slug>
  --quality Q          draft | standard | high. Default: draft
  --music PATH|none    Music bed. Default: ${DEFAULT_MUSIC}
  --music-volume V     Default: 0.18
  --whisper-model M    Default: base.en
  --out PATH           Render output. Default: <video-dir>/render/renders/final-v1-<quality>.mp4
                       (DEFAULT: renders on Modal — prep happens locally, the heavy HyperFrames
                       encode is offloaded to the cloud and the MP4 fetched back. Requires modal auth.)
  --local              Render locally instead of on Modal (Chromium + ffmpeg on this machine).
  --remote             Explicitly force the Modal render (already the default).
  --prepare-only       Build project + alignment, skip inspect/render (for validation).`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { quality: "draft", music: DEFAULT_MUSIC, musicVolume: 0.18, whisperModel: "base.en" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) usage(`${a} needs a value`);
      return v;
    };
    if (a === "--slug") args.slug = next();
    else if (a === "--video-dir") args.videoDir = next();
    else if (a === "--script") args.script = next();
    else if (a === "--quality") args.quality = next();
    else if (a === "--music") args.music = next();
    else if (a === "--music-volume") args.musicVolume = Number(next());
    else if (a === "--whisper-model") args.whisperModel = next();
    else if (a === "--out") args.out = next();
    else if (a === "--remote") args.local = false;
    else if (a === "--local") args.local = true;
    else if (a === "--prepare-only") args.prepareOnly = true;
    else if (a === "--help" || a === "-h") usage();
    else usage(`unknown flag ${a}`);
  }
  if (!args.slug) usage("--slug is required");
  args.videoDir ||= path.join(SSD_VIDEOS, args.slug);
  return args;
}

function run(cmd, cmdArgs, opts = {}) {
  const { allowFail, ...spawnOpts } = opts;
  console.log(`$ ${cmd} ${cmdArgs.map((x) => (String(x).includes(" ") ? JSON.stringify(x) : x)).join(" ")}`);
  const proc = spawnSync(cmd, cmdArgs, { stdio: "inherit", env: process.env, ...spawnOpts });
  if (proc.status !== 0 && !allowFail) throw new Error(`${cmd} exited ${proc.status}`);
}

function probeDuration(file) {
  const out = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ], { encoding: "utf8" }).stdout;
  const d = parseFloat((out || "").trim());
  return Number.isFinite(d) ? d : 0;
}

function escapeHtml(v) {
  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Loop a (short) source clip to fill exactly `durSec` of timeline, scaled/letterboxed to 1920x1080.
// If the source is already longer than durSec, it is simply trimmed.
function loopExtendClip(src, dst, durSec) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const proc = spawnSync("ffmpeg", [
    "-y", "-stream_loop", "-1", "-i", src, "-t", String(Math.max(0.5, durSec)),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,fps=30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-movflags", "+faststart", dst,
  ], { stdio: "inherit" });
  if (proc.status !== 0) throw new Error(`loop-extend failed for ${dst}`);
}

function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ---- Whisper -----------------------------------------------------------------

function resolveWhisper() {
  if (process.env.WHISPER_BIN && fs.existsSync(process.env.WHISPER_BIN)) return process.env.WHISPER_BIN;
  // `whisper` is not installed in the fromthelogo pyenv context; fall back to known envs that have it.
  const candidates = [
    `${process.env.HOME}/.pyenv/versions/psych-channel/bin/whisper`,
    `${process.env.HOME}/.pyenv/versions/3.11.0/envs/psych-channel/bin/whisper`,
    `${process.env.HOME}/.pyenv/versions/3.9.21/bin/whisper`,
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // Last resort: hope it's on PATH.
  return "whisper";
}

function runWhisper(voPath, model, workDir) {
  const jsonPath = path.join(workDir, `${path.basename(voPath, path.extname(voPath))}.json`);
  if (fs.existsSync(jsonPath)) {
    console.log(`Using existing whisper transcript: ${jsonPath}`);
    return jsonPath;
  }
  const whisperBin = resolveWhisper();
  console.log(`Using whisper: ${whisperBin}`);
  run(whisperBin, [
    voPath, "--model", model, "--language", "en",
    "--output_format", "json", "--word_timestamps", "True", "--output_dir", workDir,
  ]);
  if (!fs.existsSync(jsonPath)) throw new Error(`whisper did not produce ${jsonPath}`);
  return jsonPath;
}

function flattenWords(whisperJson) {
  const words = [];
  for (const seg of whisperJson.segments || []) {
    for (const w of seg.words || []) {
      const t = normalize(w.word);
      if (t) words.push({ t, start: w.start, end: w.end });
    }
  }
  return words;
}

// Find the timeline start for a beat's narration_excerpt by best contiguous word match.
function matchExcerptStart(words, excerpt) {
  const needle = normalize(excerpt).split(" ").filter(Boolean);
  if (!needle.length || !words.length) return null;
  let best = { score: 0, idx: -1 };
  for (let i = 0; i <= words.length - 1; i++) {
    let score = 0;
    for (let j = 0; j < needle.length && i + j < words.length; j++) {
      if (words[i + j].t === needle[j]) score += 1;
      else if (j > 0 && words[i + j].t.startsWith(needle[j].slice(0, 4))) score += 0.25;
    }
    if (score > best.score) best = { score, idx: i };
  }
  if (best.idx === -1 || best.score < Math.max(1, needle.length * 0.4)) return null;
  return words[best.idx].start;
}

function alignBeats(beats, words, totalDuration) {
  const ordered = beats.slice().sort((a, b) => (a.beat || 0) - (b.beat || 0));
  // First pass: matched starts.
  for (const b of ordered) {
    b._start = matchExcerptStart(words, b.narration_excerpt);
  }
  // Force first beat to 0.
  if (ordered.length) ordered[0]._start = 0;
  // Interpolate unmatched / out-of-order starts.
  let lastKnown = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i]._start == null || ordered[i]._start < lastKnown) {
      // find next known
      let nextIdx = -1;
      for (let j = i + 1; j < ordered.length; j++) {
        if (ordered[j]._start != null && ordered[j]._start > lastKnown) { nextIdx = j; break; }
      }
      const nextTime = nextIdx === -1 ? totalDuration : ordered[nextIdx]._start;
      const span = nextIdx === -1 ? ordered.length - i : nextIdx - i;
      ordered[i]._start = lastKnown + (nextTime - lastKnown) * (1 / (span + 1));
    }
    lastKnown = ordered[i]._start;
  }
  // Compute durations from gaps.
  for (let i = 0; i < ordered.length; i++) {
    const end = i + 1 < ordered.length ? ordered[i + 1]._start : totalDuration;
    ordered[i]._dur = Math.max(0.6, end - ordered[i]._start);
  }
  return ordered;
}

// Fallback captions straight from Whisper's ASR (used only if the script text is unavailable).
function buildCaptions(whisperJson, totalDuration) {
  const cues = [];
  for (const seg of whisperJson.segments || []) {
    const text = (seg.text || "").trim();
    if (!text) continue;
    cues.push({ text, start: Math.max(0, seg.start || 0), end: Math.min(totalDuration, seg.end || 0) });
  }
  return cues;
}

// Split the (correctly-spelled) script into caption-sized phrases.
function splitScriptIntoCues(scriptText, maxWords = 11) {
  const clean = scriptText.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [clean];
  const cues = [];
  for (const s of sentences) {
    const words = s.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += maxWords) cues.push(words.slice(i, i + maxWords).join(" "));
  }
  return cues.map((t) => t.trim()).filter(Boolean);
}

// Build captions from the SCRIPT (correct names/spelling) timed against Whisper word timestamps.
// Whisper base.en mishears proper nouns ("Aliyah" -> "Alia", "Aliyah Boston" -> "a LeBron"), so we
// only borrow its timing, never its text.
function buildCaptionsFromScript(scriptText, words, totalDuration) {
  const phrases = splitScriptIntoCues(scriptText);
  const cues = phrases.map((text) => ({ text, _start: matchExcerptStart(words, text) }));
  if (!cues.length) return [];
  cues[0]._start = 0;
  // Interpolate unmatched / out-of-order starts (same approach as alignBeats).
  let lastKnown = 0;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i]._start == null || cues[i]._start < lastKnown) {
      let nextIdx = -1;
      for (let j = i + 1; j < cues.length; j++) {
        if (cues[j]._start != null && cues[j]._start > lastKnown) { nextIdx = j; break; }
      }
      const nextTime = nextIdx === -1 ? totalDuration : cues[nextIdx]._start;
      const span = nextIdx === -1 ? cues.length - i : nextIdx - i;
      cues[i]._start = lastKnown + (nextTime - lastKnown) * (1 / (span + 1));
    }
    lastKnown = cues[i]._start;
  }
  return cues.map((c, i) => ({
    text: c.text,
    start: c._start,
    end: i + 1 < cues.length ? cues[i + 1]._start : totalDuration,
  }));
}

// ---- Composition -------------------------------------------------------------

function buildHtml({ beats, captions, duration, voName, musicName, musicVolume }) {
  const W = 1920, H = 1080;
  // Beat layers + media elements.
  let trackIndex = 2; // 0 = VO, 1 = music
  const layers = [];
  const tweens = [];
  beats.forEach((b, i) => {
    const id = `beat${i}`;
    const z = 10 + i;
    const isVideo = b.type === "broll-video" && b.clipPath;
    if (isVideo) {
      // The staged clip is loop-extended to the full beat duration, so the video covers the whole
      // beat window — no black screen after a short clip ends.
      layers.push(
        `<div id="${id}" class="beat" style="z-index:${z}"><video class="beat-video" src="assets/${path.basename(b.clipPath)}" ` +
        `playsinline data-start="${b._start.toFixed(3)}" data-duration="${Math.max(0.3, b._dur).toFixed(3)}" ` +
        `data-track-index="${trackIndex++}" data-volume="0.35"></video></div>`,
      );
    } else {
      const img = b.imagePath ? path.basename(b.imagePath) : "";
      layers.push(
        `<div id="${id}" class="beat" style="z-index:${z}"><div class="kb" style="background-image:url('assets/${img}')"></div></div>`,
      );
    }
    // crossfade in/out
    const fade = 0.35;
    const start = b._start;
    const end = b._start + b._dur;
    tweens.push(`tl.fromTo("#${id}", { opacity: 0 }, { opacity: 1, duration: ${fade}, ease: "power1.out" }, ${Math.max(0, start - fade / 2).toFixed(3)});`);
    if (i < beats.length - 1) {
      tweens.push(`tl.to("#${id}", { opacity: 0, duration: ${fade}, ease: "power1.in" }, ${Math.max(0, end - fade / 2).toFixed(3)});`);
    }
    if (!isVideo) {
      tweens.push(`tl.fromTo("#${id} .kb", { scale: 1.0 }, { scale: 1.07, duration: ${b._dur.toFixed(3)}, ease: "none" }, ${start.toFixed(3)});`);
    }
  });

  // Caption nodes.
  const capNodes = [];
  captions.forEach((c, i) => {
    capNodes.push(`<div id="cap${i}" class="caption">${escapeHtml(c.text)}</div>`);
    const fade = 0.18;
    tweens.push(`tl.fromTo("#cap${i}", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: ${fade}, ease: "power2.out" }, ${Math.max(0, c.start).toFixed(3)});`);
    tweens.push(`tl.to("#cap${i}", { opacity: 0, duration: ${fade}, ease: "power1.in" }, ${Math.max(0.2, c.end - 0.05).toFixed(3)});`);
  });

  const musicTag = musicName
    ? `<audio id="music" src="assets/${musicName}" data-start="0" data-duration="${duration.toFixed(3)}" data-track-index="1" data-volume="${musicVolume.toFixed(2)}"></audio>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #05070d; font-family: "Nunito", Arial, Helvetica, sans-serif; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #05070d; }
      .beat { position: absolute; inset: 0; opacity: 0; will-change: opacity; overflow: hidden; }
      .beat .kb { position: absolute; inset: -4%; background-size: cover; background-position: center; will-change: transform; }
      .beat-video { position: absolute; inset: 0; width: ${W}px; height: ${H}px; object-fit: cover; }
      .grade { position: absolute; inset: 0; z-index: 60; pointer-events: none; }
      #vignette { background: radial-gradient(circle at 50% 46%, transparent 40%, rgba(0,0,0,0.62) 100%), linear-gradient(180deg, rgba(0,0,0,0.34), transparent 22%, transparent 70%, rgba(0,0,0,0.62)); }
      #grain { opacity: 0.05; mix-blend-mode: overlay; background-image: radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.55) 1px, transparent 1px); background-size: 3px 3px, 5px 5px; background-position: 0 0, 2px 2px; }
      .caption-bar { position: absolute; left: 0; right: 0; bottom: 86px; z-index: 70; display: flex; justify-content: center; pointer-events: none; }
      .caption { position: absolute; max-width: 1500px; padding: 16px 30px; background: rgba(6, 9, 16, 0.78); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; color: #F5EED8; font-size: 46px; font-weight: 800; line-height: 1.16; text-align: center; opacity: 0; text-shadow: 0 3px 10px rgba(0,0,0,0.7); }
      #watermark { position: absolute; bottom: 30px; right: 36px; z-index: 80; padding: 9px 16px; border-radius: 999px; background: rgba(5,7,13,0.55); border: 1px solid rgba(255,255,255,0.16); color: rgba(255,255,255,0.9); font-size: 28px; font-weight: 900; text-transform: lowercase; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duration.toFixed(3)}" data-width="${W}" data-height="${H}">
      ${layers.join("\n      ")}
      <audio id="vo" src="assets/${voName}" data-start="0" data-duration="${duration.toFixed(3)}" data-track-index="0" data-volume="1.0"></audio>
      ${musicTag}
      <div id="vignette" class="grade"></div>
      <div id="grain" class="grade"></div>
      <div class="caption-bar">
        ${capNodes.join("\n        ")}
      </div>
      <div id="watermark">${escapeHtml(HANDLE)}</div>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${tweens.join("\n      ")}
      window.__timelines = window.__timelines || {};
      window.__timelines.main = tl;
    </script>
  </body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const videoDir = args.videoDir;
  const voPath = path.join(videoDir, "vo.mp3");
  const beatsPath = path.join(videoDir, "beats.json");
  if (!fs.existsSync(voPath)) throw new Error(`Missing VO: ${voPath} (run /ftl-vo ${args.slug})`);
  if (!fs.existsSync(beatsPath)) throw new Error(`Missing beats.json: ${beatsPath} (run ftl-news-build-beats.mjs)`);

  const beats = JSON.parse(fs.readFileSync(beatsPath, "utf8"));
  const duration = probeDuration(voPath);
  if (!duration) throw new Error(`Could not read VO duration from ${voPath}`);

  const projectDir = path.join(videoDir, "render");
  const assetsDir = path.join(projectDir, "assets");

  // Init Hyperframes project if missing (installs local hyperframes), like the kinetic-video skill.
  if (!fs.existsSync(path.join(projectDir, "package.json"))) {
    fs.mkdirSync(videoDir, { recursive: true });
    run("npx", ["-y", "hyperframes@latest", "init", "render", "--example", "blank", "--non-interactive", "--skip-skills"], { cwd: videoDir });
  }
  fs.mkdirSync(assetsDir, { recursive: true });

  // Stage assets into the project.
  fs.copyFileSync(voPath, path.join(assetsDir, "vo.mp3"));
  let musicName = "";
  if (args.music && args.music !== "none") {
    if (!fs.existsSync(args.music)) throw new Error(`Missing music: ${args.music}`);
    musicName = `music${path.extname(args.music) || ".mp3"}`;
    fs.copyFileSync(args.music, path.join(assetsDir, musicName));
  }
  // Stage image assets (clips are staged AFTER alignment, once we know each beat's duration).
  for (const b of beats) {
    if (b.imagePath) {
      const src = path.join(videoDir, b.imagePath);
      if (!fs.existsSync(src)) throw new Error(`Beat ${b.beat}: missing image ${src}`);
      fs.copyFileSync(src, path.join(assetsDir, path.basename(b.imagePath)));
    }
  }

  // Whisper alignment.
  const whisperJson = JSON.parse(fs.readFileSync(runWhisper(voPath, args.whisperModel, videoDir), "utf8"));
  const words = flattenWords(whisperJson);
  const aligned = alignBeats(beats, words, duration);

  // Stage video clips, loop-extended to exactly the aligned beat duration so a short clip never
  // ends mid-beat and leaves a black screen.
  for (const b of aligned) {
    if (!b.clipPath) continue;
    const src = path.join(videoDir, b.clipPath);
    if (!fs.existsSync(src)) throw new Error(`Beat ${b.beat}: missing clip ${src}`);
    loopExtendClip(src, path.join(assetsDir, path.basename(b.clipPath)), b._dur);
  }

  // Caption from the locked script (correct spelling) timed against Whisper words; fall back to
  // Whisper ASR text only if the script file is missing.
  const scriptPath = args.script || path.join(process.env.HOME, "transcripts", `script-${args.slug}.txt`);
  let captions;
  if (fs.existsSync(scriptPath)) {
    captions = buildCaptionsFromScript(fs.readFileSync(scriptPath, "utf8"), words, duration);
    console.log(`Captions from script: ${scriptPath}`);
  } else {
    captions = buildCaptions(whisperJson, duration);
    console.warn(`Script not found at ${scriptPath}; falling back to Whisper ASR captions (may misspell names).`);
  }
  console.log(`Aligned ${aligned.length} beats, ${captions.length} caption cues over ${duration.toFixed(1)}s.`);

  // Write composition.
  fs.writeFileSync(path.join(projectDir, "hyperframes.json"), JSON.stringify({
    version: "1.0",
    compositions: [{ id: "main", file: "index.html", width: 1920, height: 1080, duration, fps: 30 }],
  }, null, 2));
  fs.writeFileSync(path.join(projectDir, "index.html"), buildHtml({
    beats: aligned, captions, duration, voName: "vo.mp3", musicName, musicVolume: args.musicVolume,
  }));

  // Persist the alignment for QC/debugging.
  fs.writeFileSync(path.join(videoDir, "beats-aligned.json"), JSON.stringify(
    aligned.map((b) => ({ beat: b.beat, type: b.type, start: b._start, dur: b._dur, narration_excerpt: b.narration_excerpt })),
    null, 2,
  ) + "\n");

  if (args.prepareOnly) {
    console.log(JSON.stringify({ projectDir, prepared: true, beats: aligned.length, captions: captions.length, duration }, null, 2));
    return;
  }

  const out = args.out || path.join(projectDir, "renders", `final-v1-${args.quality}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  // Modal is the default render target for the news lane; --local opts out.
  if (!args.local) {
    remoteRender(projectDir, out, args.quality, args.slug);
    console.log(JSON.stringify({ projectDir, render: out, mode: "modal" }, null, 2));
    return;
  }

  // Local render: inspect (sanity), then render through the cleanup wrapper (kills leftover Chrome/ffmpeg).
  run("npx", ["hyperframes", "inspect", "--samples", "10", "--json"], { cwd: projectDir });
  run("node", [path.join(REPO, "tools/render-hyperframes-clean.mjs"), "--output", out, "--quality", args.quality, "--fps", "30"], { cwd: projectDir });

  console.log(JSON.stringify({ projectDir, render: out }, null, 2));
}

function resolveModal() {
  const candidates = [
    process.env.MODAL_BIN,
    `${process.env.HOME}/.pyenv/versions/3.11.0/envs/modal-env/bin/modal`,
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return "modal"; // hope it's on PATH
}

// Render the prepared HyperFrames project on Modal: bundle the project dir (index.html +
// hyperframes.json + assets/, NO node_modules), upload to the shared volume, run the cloud
// `hyperframes render`, fetch the MP4, and clean up the remote job.
function remoteRender(projectDir, out, quality, slug) {
  const MODAL = resolveModal();
  const VOLUME = "video-render-io";
  const APP = path.join(REPO, "tools/modal/hyperframes_render_modal_app.py");
  const job = `ftl-${slug}-${Date.now()}`;
  const stage = fs.mkdtempSync(path.join(require_os_tmpdir(), "ftl-modal-"));
  const bundle = path.join(stage, "project.tar.gz");

  // Bundle only what the cloud render needs (hyperframes is global in the Modal image).
  const members = ["index.html", "hyperframes.json", "assets"];
  if (fs.existsSync(path.join(projectDir, "package.json"))) members.push("package.json");
  console.log(`Bundling project (${members.join(", ")})...`);
  run("tar", ["czf", bundle, "-C", projectDir, ...members]);
  const sizeMb = (fs.statSync(bundle).size / (1024 * 1024)).toFixed(0);
  console.log(`Bundle: ${sizeMb} MB  job=${job}`);

  run(MODAL, ["volume", "create", VOLUME], { allowFail: true });
  console.log("Uploading to Modal volume...");
  run(MODAL, ["volume", "put", VOLUME, bundle, `/hfjobs/${job}/project.tar.gz`]);

  console.log(`Rendering on Modal (quality=${quality})...`);
  run(MODAL, ["run", APP, "--job-id", job, "--quality", quality]);

  console.log("Downloading result...");
  run(MODAL, ["volume", "get", "--force", VOLUME, `/hfjobs/${job}/ep.mp4`, out]);

  run(MODAL, ["volume", "rm", VOLUME, `/hfjobs/${job}`, "-r"], { allowFail: true });
  try { fs.rmSync(stage, { recursive: true, force: true }); } catch { /* best effort */ }
}

function require_os_tmpdir() {
  return process.env.TMPDIR || "/tmp";
}

export { normalize, flattenWords, matchExcerptStart, alignBeats, buildCaptions, buildCaptionsFromScript, splitScriptIntoCues, buildHtml };

// Only run the pipeline when invoked directly (allows importing the pure helpers for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
