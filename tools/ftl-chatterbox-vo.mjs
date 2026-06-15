#!/usr/bin/env node
// FTL voiceover via Chatterbox TTS on Modal (voice-cloned), replacing ElevenLabs.
// Clones the "aym explains" narration voice from a reference clip, renders the script in
// sentence-grouped chunks on the L40S GPU, then stitches them with natural pauses between
// sentences/paragraphs and a slowed tempo.
//
// Drop-in usage (same shape as generate-elevenlabs-vo-single.mjs):
//   node tools/ftl-chatterbox-vo.mjs SCRIPT_PATH OUTPUT_MP3 [options]
//
// Options (with slowed, natural-pause defaults):
//   --voice PATH         Reference voice wav. Default: /Volumes/SSK SSD/ftl/voice/aym-explains-reference.wav
//   --exaggeration N     Chatterbox expressiveness. Default 0.4
//   --cfg-weight N       Lower = slower / more deliberate pacing. Default 0.4
//   --temperature N      Default 0.7
//   --atempo N           Final tempo (1.0 = unchanged, <1 = slower, pitch-preserved). Default 0.92
//   --sentence-gap N     Silence (s) between sentence chunks. Default 0.30
//   --paragraph-gap N    Silence (s) between paragraphs. Default 0.65
//   --max-words N        Max words per synthesis chunk. Default 45
//   --keep-temp          Keep the per-chunk wavs + manifest for debugging.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";
const MODAL_APP = path.join(REPO, "tools/modal/chatterbox_modal_app.py");
const DEFAULT_VOICE = "/Volumes/SSK SSD/ftl/voice/aym-explains-reference.wav";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error("Usage: node tools/ftl-chatterbox-vo.mjs SCRIPT_PATH OUTPUT_MP3 [options]");
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    voice: DEFAULT_VOICE, exaggeration: 0.4, cfgWeight: 0.4, temperature: 0.7,
    atempo: 0.92, sentenceGap: 0.30, paragraphGap: 0.65, maxWords: 45, keepTemp: false,
    positional: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v == null) usage(`${a} needs a value`); return v; };
    if (a === "--voice") args.voice = next();
    else if (a === "--exaggeration") args.exaggeration = Number(next());
    else if (a === "--cfg-weight") args.cfgWeight = Number(next());
    else if (a === "--temperature") args.temperature = Number(next());
    else if (a === "--atempo") args.atempo = Number(next());
    else if (a === "--sentence-gap") args.sentenceGap = Number(next());
    else if (a === "--paragraph-gap") args.paragraphGap = Number(next());
    else if (a === "--max-words") args.maxWords = Number(next());
    else if (a === "--keep-temp") args.keepTemp = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("--")) usage(`unknown flag ${a}`);
    else args.positional.push(a);
  }
  args.script = args.positional[0];
  args.out = args.positional[1];
  if (!args.script || !args.out) usage("SCRIPT_PATH and OUTPUT_MP3 are required");
  if (!fs.existsSync(args.script)) usage(`script not found: ${args.script}`);
  if (!fs.existsSync(args.voice)) usage(`voice reference not found: ${args.voice}`);
  return args;
}

function resolveModal() {
  const c = `${process.env.HOME}/.pyenv/versions/3.11.0/envs/modal-env/bin/modal`;
  return fs.existsSync(c) ? c : "modal";
}

function run(cmd, cmdArgs, opts = {}) {
  console.log(`$ ${cmd} ${cmdArgs.map((x) => (String(x).includes(" ") ? JSON.stringify(x) : x)).join(" ")}`);
  const p = spawnSync(cmd, cmdArgs, { stdio: "inherit", env: process.env, ...opts });
  if (p.status !== 0) throw new Error(`${cmd} exited ${p.status}`);
}

// Clean the script to spoken text, then chunk into <=maxWords groups that never cross a paragraph.
// Each chunk records the pause that should FOLLOW it (sentence vs paragraph gap).
// Chatterbox reads hyphenated number pairs and "$" poorly (e.g. "114-106" was misspoken). Normalize
// scores/stat-lines into spoken words so the VO matches the on-screen receipts.
function normalizeForTTS(t) {
  return t
    .replace(/(\d+)\s*-\s*of\s*-\s*(\d+)/gi, "$1 of $2")
    .replace(/(\d+)\s*-\s*for\s*-\s*(\d+)/gi, "$1 for $2")
    .replace(/(\d+)\s*-\s*and\s*-\s*(\d+)/gi, "$1 and $2")
    .replace(/\$\s*(\d[\d,]*)/g, (_m, n) => `${n.replace(/,/g, "")} dollars`)
    .replace(/(\d+)\s*-\s*(\d+)/g, "$1 to $2"); // bare scores like 114-106, 85-75
}

function buildChunks(scriptText, maxWords, sentenceGap, paragraphGap) {
  const text = normalizeForTTS(scriptText
    .replace(/\[[^\]]*\]/g, " ")      // strip [PAUSE]-style stage directions
    .replace(/[ \t]+/g, " ")
    .trim());
  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chunks = [];
  paragraphs.forEach((para, pIdx) => {
    const sentences = para.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [para];
    let cur = "";
    const flush = (gap) => { if (cur.trim()) { chunks.push({ text: cur.trim(), gap }); cur = ""; } };
    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;
      const wouldBe = cur ? `${cur} ${sentence}` : sentence;
      if (wouldBe.split(/\s+/).length > maxWords && cur) { flush(sentenceGap); cur = sentence; }
      else cur = wouldBe;
    }
    flush(pIdx < paragraphs.length - 1 ? paragraphGap : 0);
  });
  return chunks;
}

function makeSilence(seconds, outPath) {
  run("ffmpeg", ["-y", "-f", "lavfi", "-i", `anullsrc=r=24000:cl=mono`, "-t", String(seconds),
    "-c:a", "pcm_s16le", outPath]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const MODAL = resolveModal();
  const work = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "ftl-cbx-"));
  const chunks = buildChunks(fs.readFileSync(args.script, "utf8"), args.maxWords, args.sentenceGap, args.paragraphGap);
  if (!chunks.length) throw new Error("script produced no chunks");
  console.log(`Chunks: ${chunks.length} (voice=${path.basename(args.voice)}, cfg=${args.cfgWeight}, atempo=${args.atempo})`);

  // Manifest for the Modal Chatterbox app (one GPU session synthesizes all chunks).
  const manifest = chunks.map((c, i) => ({
    text: c.text,
    prompt_audio: args.voice,
    exaggeration: args.exaggeration,
    cfg_weight: args.cfgWeight,
    temperature: args.temperature,
    out: path.join(work, `chunk_${String(i).padStart(3, "0")}.wav`),
  }));
  const manifestPath = path.join(work, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("Synthesizing on Modal (Chatterbox, L40S)...");
  run(MODAL, ["run", MODAL_APP, "--manifest", manifestPath]);

  for (const job of manifest) {
    if (!fs.existsSync(job.out) || fs.statSync(job.out).size < 1000) {
      throw new Error(`missing/empty chunk wav: ${job.out}`);
    }
  }

  // Stitch chunks with silence gaps (matched 24k mono), then slow with atempo and encode to mp3.
  const silSentence = path.join(work, "sil_sentence.wav");
  const silPara = path.join(work, "sil_paragraph.wav");
  makeSilence(args.sentenceGap, silSentence);
  makeSilence(args.paragraphGap, silPara);

  const listLines = [];
  chunks.forEach((c, i) => {
    listLines.push(`file '${manifest[i].out.replace(/'/g, "'\\''")}'`);
    if (c.gap === args.paragraphGap) listLines.push(`file '${silPara}'`);
    else if (c.gap > 0) listLines.push(`file '${silSentence}'`);
  });
  const listPath = path.join(work, "concat.txt");
  fs.writeFileSync(listPath, listLines.join("\n") + "\n");

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const filterArgs = args.atempo && args.atempo !== 1 ? ["-filter:a", `atempo=${args.atempo}`] : [];
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath,
    ...filterArgs, "-ar", "44100", "-ac", "2", "-b:a", "128k", args.out]);

  // Manifest of what was produced (parallels the ElevenLabs tool's sidecar).
  fs.writeFileSync(`${args.out}.manifest.json`, JSON.stringify({
    provider: "chatterbox-modal", app: "ftl-chatterbox-tts", voice: args.voice,
    exaggeration: args.exaggeration, cfg_weight: args.cfgWeight, temperature: args.temperature,
    atempo: args.atempo, sentence_gap: args.sentenceGap, paragraph_gap: args.paragraphGap,
    chunks: chunks.length, script: args.script,
  }, null, 2));

  if (!args.keepTemp) { try { fs.rmSync(work, { recursive: true, force: true }); } catch {} }
  console.log(args.out);
}

main();
