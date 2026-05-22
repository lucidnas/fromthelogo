#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "1");
  }
}

const scriptPath = args.get("script");
const outPath = args.get("out");
const model = args.get("model") || "gpt-4o-mini-tts";
const voice = args.get("voice") || "cedar";
const speed = Number(args.get("speed") || "0.9");
const responseFormat = args.get("format") || "mp3";
const maxChars = Number(args.get("max-chars") || "3600");
const chunkMode = args.get("chunk-mode") || "sentence-batch";
const sentenceBatchChars = Number(args.get("sentence-batch-chars") || "1200");
const maxGenerateChunks = Number(args.get("max-generate-chunks") || "0");
const sampleChars = Number(args.get("sample-chars") || "0");
const skipStitch = args.has("skip-stitch");
const instructions = args.get("instructions") || [
  "Speak at a calm, normal sports narration pace.",
  "Keep the same voice and tone across the entire recording.",
  "Sound conversational and clear, not like a hype announcer.",
  "Treat [pause] as a brief natural pause and [long pause] as a longer dramatic pause.",
].join(" ");

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
if (!scriptPath) throw new Error("Missing --script /path/to/script.txt");
if (!outPath) throw new Error("Missing --out /path/to/output.mp3");

let script = fs.readFileSync(scriptPath, "utf8").trim();
if (sampleChars > 0) script = script.slice(0, sampleChars).trim();
if (!script) throw new Error(`Script is empty: ${scriptPath}`);

const outDir = path.dirname(outPath);
const stem = path.basename(outPath, path.extname(outPath));
const chunkDir = path.join(outDir, `${stem}-openai-${chunkMode}-chunks`);
fs.mkdirSync(chunkDir, { recursive: true });

function sentenceParts(text) {
  return text
    .split(/\n{2,}/)
    .flatMap(paragraph => {
      const marked = paragraph.replace(/\[(?:long\s+)?pause\]/gi, match => ` ${match}. `).trim();
      return marked.match(/[^.!?]+[.!?]+(?:["”’])?|[^.!?]+$/g) || [marked];
    })
    .map(part => part.trim())
    .filter(Boolean);
}

function chunkText(text) {
  if (chunkMode === "sentence") return sentenceParts(text);
  if (chunkMode === "sentence-batch") {
    const chunks = [];
    let current = "";
    for (const sentence of sentenceParts(text)) {
      const next = current ? `${current}\n\n${sentence}` : sentence;
      if (next.length <= sentenceBatchChars || !current) current = next;
      else {
        chunks.push(current);
        current = sentence;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars || !current) current = next;
    else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function generateChunk(text, index) {
  const ext = responseFormat === "wav" ? "wav" : "mp3";
  const chunkPath = path.join(chunkDir, `chunk-${String(index).padStart(2, "0")}.${ext}`);
  if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
    console.log(`Skipping existing ${path.basename(chunkPath)}`);
    return chunkPath;
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      response_format: responseFormat,
      speed,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status}): ${await res.text()}`);
  fs.writeFileSync(chunkPath, Buffer.from(await res.arrayBuffer()));
  return chunkPath;
}

const chunks = chunkText(script);
console.log(`Generating ${chunks.length} OpenAI TTS chunk(s) with ${model}, voice ${voice}, speed ${speed}`);
if (sampleChars > 0) console.log(`Sample mode: first ${sampleChars} chars`);

let generatedThisRun = 0;
for (let i = 0; i < chunks.length; i += 1) {
  const ext = responseFormat === "wav" ? "wav" : "mp3";
  const expectedPath = path.join(chunkDir, `chunk-${String(i + 1).padStart(2, "0")}.${ext}`);
  const exists = fs.existsSync(expectedPath) && fs.statSync(expectedPath).size > 0;
  if (!exists && maxGenerateChunks > 0 && generatedThisRun >= maxGenerateChunks) {
    console.log(`Reached --max-generate-chunks ${maxGenerateChunks}; stopping before chunk ${i + 1}`);
    break;
  }
  console.log(`Chunk ${i + 1}/${chunks.length}`);
  await generateChunk(chunks[i], i + 1);
  if (!exists) generatedThisRun += 1;
}

const ext = responseFormat === "wav" ? "wav" : "mp3";
const expected = chunks.map((_, i) => path.join(chunkDir, `chunk-${String(i + 1).padStart(2, "0")}.${ext}`));
const missing = expected.filter(file => !fs.existsSync(file) || fs.statSync(file).size === 0);
if (missing.length) {
  console.log(`Generated ${generatedThisRun} new chunk(s). Missing ${missing.length}/${expected.length}.`);
  if (skipStitch || maxGenerateChunks > 0) process.exit(0);
  throw new Error("Cannot stitch because some chunks are missing");
}

const concatPath = path.join(chunkDir, "concat.txt");
fs.writeFileSync(concatPath, expected.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
const concat = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-ar", "44100", "-ac", "1", "-b:a", "128k", outPath], { stdio: "inherit" });
if (concat.status !== 0) throw new Error("ffmpeg concat failed");

const manifest = {
  provider: "openai",
  model,
  voice,
  speed,
  responseFormat,
  scriptPath,
  outPath,
  chunkMode,
  chunks: expected.length,
  instructions,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, `${stem}-manifest.json`), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Saved ${outPath}`);
