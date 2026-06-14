#!/usr/bin/env node
// FTL News Recap — hybrid beat builder.
// Plans beats from the final news script + the chosen story (via Gemini), then materializes the
// visual assets into the video folder:
//   - ai-image    -> generated via the codex-image-gen skill (free)
//   - receipt     -> a clean, factual headline/quote CARD rendered via codex-image-gen
//                    (verbatim text + outlet attribution; swap in a real screenshot if preferred)
//   - broll-still -> a frame extracted (ffmpeg) from our own Caitlin Clark b-roll
//   - broll-video -> a short moving insert trimmed (ffmpeg) from our own b-roll, audio kept for ducking
//
// Output: <video-dir>/beats.json + <video-dir>/images/* (+ <video-dir>/clips/* for video beats)
//
// Usage:
//   node tools/ftl-news-build-beats.mjs --slug SLUG [--research PATH] [--story-rank N]
//        [--script PATH] [--video-dir DIR] [--broll-dir DIR] [--model M]
//        [--plan-only] [--from-beats] [--max-broll-seconds N]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";

const REPO = "/Users/abdul/code/fromthelogo";
const TRANSCRIPTS = path.join(process.env.HOME, "transcripts");
const SSD_VIDEOS = "/Volumes/SSK SSD/ftl/videos";
const DEFAULT_BROLL = "/Volumes/SSK SSD/broll/clips";
const IMAGE_GEN = path.join(process.env.HOME, ".claude/skills/codex-image-gen/scripts/generate.sh");

const FTL_IMAGE_STYLE =
  "High-resolution editorial sports-news illustration, cinematic dramatic lighting, " +
  "Indiana Fever navy/gold palette, bold and modern, broadcast-quality. Real brand/team logos " +
  "(WNBA, Indiana Fever, etc.) are allowed. CRITICAL: do NOT render any scoreboard, final score, " +
  "statistics, jersey numbers, dates, or readable text of any kind — AI-generated text is unreliable " +
  "and can display FALSE information. Render mood and concept only; any factual number/score/quote " +
  "belongs on a separate receipt card, never inside this image.";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(`Usage:
  node tools/ftl-news-build-beats.mjs --slug SLUG [options]

Options:
  --research PATH         News digest from ftl-news-scan.mjs (required unless --from-beats).
  --story-rank N          Which ranked story in the digest to build. Default: 1.
  --script PATH           Final VO script. Default: ~/transcripts/script-<slug>.txt
  --video-dir DIR         Output folder. Default: /Volumes/SSK SSD/ftl/videos/<slug>
  --broll-dir DIR         Caitlin Clark b-roll library. Default: ${DEFAULT_BROLL}
  --model M               Gemini model for beat planning. Default: gemini-2.5-pro
  --plan-only             Write beats.json only; skip asset generation.
  --from-beats            Skip Gemini; (re)materialize assets from an existing beats.json.
  --max-broll-seconds N   Max length for broll-video inserts. Default: 6`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { storyRank: 1, brollDir: DEFAULT_BROLL, model: "gemini-2.5-pro", maxBroll: 6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) usage(`${a} needs a value`);
      return v;
    };
    if (a === "--slug") args.slug = next();
    else if (a === "--research") args.research = next();
    else if (a === "--story-rank") args.storyRank = Number(next());
    else if (a === "--script") args.script = next();
    else if (a === "--video-dir") args.videoDir = next();
    else if (a === "--broll-dir") args.brollDir = next();
    else if (a === "--model") args.model = next();
    else if (a === "--plan-only") args.planOnly = true;
    else if (a === "--from-beats") args.fromBeats = true;
    else if (a === "--max-broll-seconds") args.maxBroll = Number(next());
    else if (a === "--help" || a === "-h") usage();
    else usage(`unknown flag ${a}`);
  }
  if (!args.slug) usage("--slug is required");
  if (!args.fromBeats && !args.research) usage("--research is required (unless --from-beats)");
  args.script ||= path.join(TRANSCRIPTS, `script-${args.slug}.txt`);
  args.videoDir ||= path.join(SSD_VIDEOS, args.slug);
  return args;
}

function resolvePath(p) {
  if (!p) return p;
  if (p.startsWith("~")) return path.join(process.env.HOME, p.slice(1));
  return path.isAbsolute(p) ? p : path.resolve(REPO, p);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function read(p) {
  const r = resolvePath(p);
  if (!fs.existsSync(r)) throw new Error(`Missing file: ${r}`);
  return fs.readFileSync(r, "utf8");
}

function stripCodeFence(text) {
  const m = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (m.length) return m[m.length - 1][1].trim();
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a !== -1 && b > a) return text.slice(a, b + 1);
  return text.trim();
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

// ---- Beat planning (Gemini) -------------------------------------------------

function buildPlanPrompt({ script, research, storyRank }) {
  return `You are an FTL news-recap editor building the visual beat plan for an image-led 4-6 minute
Caitlin Clark / Indiana Fever news video.

You are given (1) the FINAL voice-over script and (2) the news research digest. Use the story ranked
#${storyRank} in the digest as the subject.

Produce a beat-by-beat visual plan that covers the WHOLE script in order. Rules:
- Each beat's "narration_excerpt" MUST be a short VERBATIM phrase copied exactly from the script
  (5-12 words) marking where this visual appears. Beats must move forward through the script in order.
- Aim for one beat roughly every 2-4 sentences (typically 8-16 beats total).
- Choose a "type" for each beat:
    "ai-image"     : default. A conceptual editorial image. Give a vivid "prompt".
    "receipt"      : show the proof for a SOURCED claim. Give "receiptText" = the VERBATIM
                     headline or quote (exactly as in the research, no paraphrase) and
                     "attribution" = the outlet name. Use this when the VO cites a report/quote/stat.
    "broll-still"  : a still from our Caitlin Clark game footage. Give a "brollQuery" of keywords
                     (e.g. "three pointer logo", "assist fast break", "celebration").
    "broll-video"  : a short moving clip of our Caitlin Clark game footage. Give "brollQuery".
- Prefer ai-image for the majority; use receipt for every cited fact; use broll only for genuine
  on-court action references. Do NOT invent receipts — only use facts present in the research.
- CRITICAL: ai-image prompts must NEVER request a scoreboard, final score, statistics, jersey
  numbers, dates, standings, or any readable on-screen text/headline — AI image text is unreliable
  and will hallucinate FALSE numbers/teams. If a score, stat, headline, or quote needs to appear on
  screen, make it a "receipt" beat (typeset accurately), not an ai-image. Keep ai-image prompts to
  mood/metaphor/concept only.

Return ONLY a single fenced \`\`\`json block:
\`\`\`json
{
  "beats": [
    { "beat": 1, "type": "ai-image", "narration_excerpt": "...", "prompt": "...", "source": "" },
    { "beat": 2, "type": "receipt", "narration_excerpt": "...", "receiptText": "...", "attribution": "Yahoo Sports", "source": "https://..." },
    { "beat": 3, "type": "broll-video", "narration_excerpt": "...", "brollQuery": "logo three" }
  ]
}
\`\`\`

FINAL SCRIPT:
${script}

NEWS RESEARCH DIGEST:
${research}`;
}

async function planBeats(args) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for beat planning");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPlanPrompt({
    script: read(args.script),
    research: read(args.research),
    storyRank: args.storyRank,
  });
  const result = await ai.models.generateContent({
    model: args.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.3, topP: 0.9, responseMimeType: "application/json", maxOutputTokens: 16384 },
  });
  const data = JSON.parse(stripCodeFence(result.text));
  if (!Array.isArray(data.beats) || !data.beats.length) throw new Error("Gemini returned no beats");
  return data.beats.map((b, i) => ({ ...b, beat: b.beat ?? i + 1 }));
}

// ---- Asset materialization --------------------------------------------------

const CODEX_GEN_DIR = path.join(process.env.CODEX_HOME || path.join(process.env.HOME, ".codex"), "generated_images");

// A valid PNG starts with the 8-byte signature and is non-trivial in size. macOS on exFAT (the SSD)
// and codex's own copy step can leave a 4 KB "._<name>" AppleDouble companion in place of the real
// image, so we must verify the magic bytes, not just existence.
function isRealPng(p) {
  try {
    const st = fs.statSync(p);
    if (st.size <= 10000) return false;
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  } catch {
    return false;
  }
}

function stripAppleDouble(p) {
  const comp = path.join(path.dirname(p), `._${path.basename(p)}`);
  try { fs.rmSync(comp, { force: true }); } catch { /* best effort */ }
}

// Find the newest real ig_*.png codex produced at/after `sinceMs` (ignores ._ companions).
function newestCodexImage(sinceMs) {
  if (!fs.existsSync(CODEX_GEN_DIR)) return null;
  let best = null;
  let bestM = sinceMs;
  for (const d of fs.readdirSync(CODEX_GEN_DIR)) {
    const dir = path.join(CODEX_GEN_DIR, d);
    let files;
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
      files = fs.readdirSync(dir);
    } catch { continue; }
    for (const f of files) {
      if (!f.startsWith("ig_") || !f.endsWith(".png")) continue; // excludes "._ig_..." AppleDouble
      const fp = path.join(dir, f);
      let st;
      try { st = fs.statSync(fp); } catch { continue; }
      if (st.size > 10000 && st.mtimeMs >= bestM) { bestM = st.mtimeMs; best = fp; }
    }
  }
  return best;
}

function copyPngClean(src, dst) {
  fs.writeFileSync(dst, fs.readFileSync(src)); // data-fork copy — no AppleDouble companion
  stripAppleDouble(dst);
}

function genImage(prompt, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const full = `${prompt}\n\nStyle: ${FTL_IMAGE_STYLE}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    // Don't let generate.sh's idempotency skip a previously-failed junk file.
    if (fs.existsSync(outPath) && !isRealPng(outPath)) { try { fs.rmSync(outPath, { force: true }); } catch {} }
    const since = Date.now() - 2000;
    spawnSync("bash", [IMAGE_GEN, "--prompt", full, "--out", outPath, "--aspect", "16:9"], {
      stdio: "inherit",
      env: process.env,
    });
    stripAppleDouble(outPath);
    if (isRealPng(outPath)) return;
    // generate.sh's copy grabbed the AppleDouble (or failed) — recover the real file ourselves.
    const recovered = newestCodexImage(since);
    if (recovered) {
      copyPngClean(recovered, outPath);
      if (isRealPng(outPath)) {
        console.log(`    (recovered real PNG from ${path.basename(path.dirname(recovered))})`);
        return;
      }
    }
    console.warn(`    image attempt ${attempt} produced no valid PNG${attempt < 2 ? " — retrying" : ""}`);
  }
  throw new Error(`image gen failed (no valid PNG) for ${outPath}`);
}

const RECEIPT_FONT = (() => {
  for (const f of [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
  ]) {
    if (fs.existsSync(f)) return f;
  }
  return null;
})();

function wrapText(text, maxChars) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) { lines.push(line); line = w; } else { line = next; }
  }
  if (line) lines.push(line);
  return lines;
}

// Render a deterministic, always-legible receipt CARD with ffmpeg drawtext. codex image_gen
// (gpt-image-2) cannot reliably spell long exact headline/stat text, so receipts are NOT AI-drawn —
// they are typeset directly. The text is therefore guaranteed accurate to the source.
//
// Each wrapped line is its OWN drawtext reading its OWN textfile: this (a) avoids ffmpeg drawtext
// rendering an embedded "\n" as a tofu box (a multi-line textfile quirk), and (b) needs zero
// escaping since the text lives in files, not in the comma-delimited filter string.
function renderReceiptCard(receiptText, attribution, outPath) {
  if (!RECEIPT_FONT) throw new Error("no usable system font for receipt cards");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const lines = wrapText(receiptText, 30).slice(0, 5);
  const fontSize = lines.length <= 2 ? 84 : lines.length === 3 ? 72 : 60;
  const lineH = Math.round(fontSize * 1.34);
  const startY = Math.round((1080 - lines.length * lineH) / 2);
  const base = path.basename(outPath, ".png");
  const tmps = [];
  const writeTmp = (suffix, text) => {
    const tf = path.join(require_tmpdir(), `ftl-receipt-${base}-${suffix}.txt`);
    fs.writeFileSync(tf, text);
    tmps.push(tf);
    return tf;
  };

  const headlineDraws = lines.map((ln, i) => {
    const tf = writeTmp(`l${i}`, ln);
    const y = startY + i * lineH;
    return `drawtext=fontfile=${RECEIPT_FONT}:textfile=${tf}:fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}`;
  });
  const labelTf = writeTmp("label", "THE RECEIPT");
  const attrTf = writeTmp("attr", (attribution || "Source").toUpperCase());

  const vf = [
    `drawbox=x=150:y=232:w=1620:h=5:color=0xFFD648@0.95:t=fill`,
    `drawtext=fontfile=${RECEIPT_FONT}:textfile=${labelTf}:fontcolor=0xFFD648:fontsize=40:x=150:y=176`,
    ...headlineDraws,
    `drawtext=fontfile=${RECEIPT_FONT}:textfile=${attrTf}:fontcolor=0xFFD648:fontsize=44:x=150:y=h-150`,
  ].join(",");

  spawnSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "color=c=0x0a1f3d:s=1920x1080", "-vf", vf, "-frames:v", "1", outPath],
    { stdio: "inherit" },
  );
  for (const t of tmps) { try { fs.rmSync(t, { force: true }); } catch { /* best effort */ } }
  stripAppleDouble(outPath);
  if (!isRealPng(outPath)) throw new Error(`receipt card render failed for ${outPath}`);
}

function require_tmpdir() {
  return process.env.TMPDIR || "/tmp";
}

function listBroll(brollDir) {
  if (!fs.existsSync(brollDir)) return [];
  // Exclude dotfiles, especially macOS "._<name>" AppleDouble companions on the exFAT SSD —
  // they match the video extension but are 4 KB metadata stubs ffmpeg cannot open.
  return fs.readdirSync(brollDir).filter((f) => !f.startsWith(".") && /\.(mp4|mov|m4v)$/i.test(f));
}

function pickBroll(brollFiles, query) {
  const tokens = String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  let best = null;
  let bestScore = 0;
  for (const f of brollFiles) {
    const name = f.toLowerCase();
    let score = 0;
    for (const t of tokens) if (name.includes(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  // Return null when no token matched — the caller downgrades the beat to an AI image rather than
  // dropping an unrelated random clip into the video.
  return best;
}

function probeDuration(file) {
  const proc = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  const d = parseFloat((proc.stdout || "").trim());
  return Number.isFinite(d) ? d : 0;
}

function extractFrame(srcFile, outPath, atSeconds) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const proc = spawnSync(
    "ffmpeg",
    ["-y", "-ss", String(atSeconds), "-i", srcFile, "-frames:v", "1", "-q:v", "2", outPath],
    { stdio: "inherit" },
  );
  if (proc.status !== 0) throw new Error(`frame extract failed for ${outPath}`);
}

function trimClip(srcFile, outPath, inSec, outSec) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const dur = Math.max(0.5, outSec - inSec);
  const proc = spawnSync(
    "ffmpeg",
    ["-y", "-ss", String(inSec), "-i", srcFile, "-t", String(dur),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-movflags", "+faststart", outPath],
    { stdio: "inherit" },
  );
  if (proc.status !== 0) throw new Error(`clip trim failed for ${outPath}`);
}

// Build the asset for one beat. Throws if the asset cannot be created (caller handles fallback).
function materializeBeat(b, ctx) {
  const { imagesDir, clipsDir, brollFiles, args, needsReceiptSwap } = ctx;
  const n = pad3(b.beat);

  if (b.type === "broll-video" || b.type === "broll-still") {
    const pick = pickBroll(brollFiles, b.brollQuery);
    if (!pick) {
      console.warn(`  beat ${n}: no broll match for "${b.brollQuery}" — downgrading to ai-image`);
      b.type = "ai-image";
      b.prompt = b.prompt || `Caitlin Clark in an Indiana Fever game, ${b.brollQuery || "in action"}.`;
      delete b.clipPath; delete b.clipIn; delete b.clipOut;
    } else if (b.type === "broll-video") {
      const src = path.join(args.brollDir, pick);
      const dur = probeDuration(src);
      const inSec = Number.isFinite(b.clipIn) ? b.clipIn : 0;
      const outSec = Number.isFinite(b.clipOut) ? b.clipOut : Math.min(dur || args.maxBroll, inSec + args.maxBroll);
      b.clipPath = `clips/beat_${n}.mp4`;
      b.clipIn = inSec;
      b.clipOut = outSec;
      b.source = b.source || `broll/clips/${pick}`;
      console.log(`  beat ${n}: broll-video <- ${pick} [${inSec}-${outSec}s]`);
      trimClip(src, path.join(clipsDir, `beat_${n}.mp4`), inSec, outSec);
      return;
    } else {
      const src = path.join(args.brollDir, pick);
      const dur = probeDuration(src);
      b.imagePath = `images/beat_${n}.png`;
      b.source = b.source || `broll/clips/${pick}`;
      console.log(`  beat ${n}: broll-still <- ${pick}`);
      extractFrame(src, path.join(imagesDir, `beat_${n}.png`), dur ? dur / 2 : 1);
      return;
    }
  }

  if (b.type === "receipt") {
    b.imagePath = `images/beat_${n}.png`;
    console.log(`  beat ${n}: receipt card -> "${(b.receiptText || "").slice(0, 60)}"`);
    renderReceiptCard(b.receiptText, b.attribution, path.join(imagesDir, `beat_${n}.png`));
    needsReceiptSwap.push({ beat: b.beat, source: b.source, attribution: b.attribution });
    return;
  }

  // ai-image (default)
  b.type = "ai-image";
  b.imagePath = `images/beat_${n}.png`;
  console.log(`  beat ${n}: ai-image`);
  genImage(b.prompt || "Caitlin Clark, Indiana Fever, editorial sports news image.", path.join(imagesDir, `beat_${n}.png`));
}

function materialize(beats, args) {
  const ctx = {
    imagesDir: path.join(args.videoDir, "images"),
    clipsDir: path.join(args.videoDir, "clips"),
    brollFiles: listBroll(args.brollDir),
    args,
    needsReceiptSwap: [],
  };
  const kept = [];
  const dropped = [];

  for (const b of beats) {
    const n = pad3(b.beat);
    try {
      materializeBeat(b, ctx);
      kept.push(b);
    } catch (err) {
      // One beat's asset failed — don't abort the whole video. Downgrade to a generic AI image
      // built from the narration so the timeline stays intact; drop the beat only if that fails too.
      console.warn(`  beat ${n}: ${err.message} — falling back to a generic ai-image`);
      try {
        b.type = "ai-image";
        delete b.clipPath; delete b.clipIn; delete b.clipOut;
        b.imagePath = `images/beat_${n}.png`;
        const concept = b.prompt || `Editorial sports-news illustration about Caitlin Clark and the Indiana Fever: ${b.narration_excerpt || ""}.`;
        genImage(concept, path.join(ctx.imagesDir, `beat_${n}.png`));
        kept.push(b);
      } catch (err2) {
        console.warn(`  beat ${n}: DROPPED (${err2.message})`);
        dropped.push(b.beat);
      }
    }
  }

  return { beats: kept, needsReceiptSwap: ctx.needsReceiptSwap, dropped };
}

async function main() {
  loadEnvFile(path.join(REPO, ".env"));
  loadEnvFile(path.join(REPO, ".env.local"));
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.videoDir, { recursive: true });
  const beatsPath = path.join(args.videoDir, "beats.json");

  let beats;
  if (args.fromBeats) {
    if (!fs.existsSync(beatsPath)) throw new Error(`--from-beats but no beats.json at ${beatsPath}`);
    beats = JSON.parse(fs.readFileSync(beatsPath, "utf8"));
    console.log(`Loaded ${beats.length} beats from ${beatsPath}`);
  } else {
    console.log("Planning beats with Gemini...");
    beats = await planBeats(args);
    fs.writeFileSync(beatsPath, JSON.stringify(beats, null, 2) + "\n");
    console.log(`Planned ${beats.length} beats -> ${beatsPath}`);
  }

  if (args.planOnly) {
    console.log("--plan-only: skipping asset generation.");
    return;
  }

  console.log("Materializing assets...");
  const { beats: kept, needsReceiptSwap, dropped } = materialize(beats, args);
  fs.writeFileSync(beatsPath, JSON.stringify(kept, null, 2) + "\n");

  const summary = {
    beatsPath,
    videoDir: args.videoDir,
    counts: kept.reduce((acc, b) => ((acc[b.type] = (acc[b.type] || 0) + 1), acc), {}),
    kept: kept.length,
    dropped,
    receiptsToVerify: needsReceiptSwap,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (needsReceiptSwap.length) {
    console.log(
      "\nNote: receipt beats were rendered as factual headline/quote cards. To use the literal " +
      "outlet screenshot instead, replace the corresponding images/beat_NNN.png and keep the attribution.",
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
