#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const envPath of [path.join(process.cwd(), ".env"), path.join(process.cwd(), ".env.local")]) {
  if (!fs.existsSync(envPath)) continue;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

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
const voice = args.get("voice") || process.env.GEMINI_TTS_VOICE || "Charon";
const model = args.get("model") || process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const delivery = args.get("delivery") || process.env.GEMINI_TTS_DELIVERY || [
  "Read this naturally, like a calm sports narrator.",
  "Keep the baseline warm, clear, steady, and conversational.",
  "Do not rush, and do not use hype-announcer energy.",
  "Lift the energy only on payoff lines, big reveals, and short punch lines, then settle back down.",
  "Let sentence breaks breathe.",
].join(" ");
const maxChars = Number(args.get("max-chars") || process.env.GEMINI_TTS_MAX_CHARS || 1050);
const chunkMode = args.get("chunk-mode") || process.env.GEMINI_TTS_CHUNK_MODE || "paragraph";
const sentenceBatchChars = Number(args.get("sentence-batch-chars") || process.env.GEMINI_TTS_SENTENCE_BATCH_CHARS || 520);
const maxGenerateChunks = Number(args.get("max-generate-chunks") || process.env.GEMINI_TTS_MAX_GENERATE_CHUNKS || 0);
const skipStitch = args.has("skip-stitch");
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
if (!scriptPath) throw new Error("Missing --script /path/to/script.txt");
if (!outPath) throw new Error("Missing --out /path/to/vo.mp3");

const script = fs.readFileSync(scriptPath, "utf8").trim();
if (!script) throw new Error(`Script is empty: ${scriptPath}`);

const outDir = path.dirname(outPath);
const stem = path.basename(outPath, path.extname(outPath));
const chunkDirSuffix =
  chunkMode === "sentence" ? "sentence-gemini-chunks" :
  chunkMode === "sentence-batch" ? "sentence-batch-gemini-chunks" :
  "gemini-chunks";
const chunkDir = path.join(outDir, `${stem}-${chunkDirSuffix}`);
fs.mkdirSync(chunkDir, { recursive: true });

function chunkText(text, maxChars) {
  if (chunkMode === "sentence" || chunkMode === "sentence-batch") {
    const sentences = text
      .split(/\n{2,}/)
      .flatMap(paragraph => {
        const marked = paragraph
          .replace(/\[(?:long\s+)?pause\]/gi, match => ` ${match}. `)
          .trim();
        return marked.match(/[^.!?]+[.!?]+(?:["”’])?|[^.!?]+$/g) || [marked];
      })
      .map(part => part.trim())
      .filter(Boolean);
    if (chunkMode === "sentence") return sentences;

    const chunks = [];
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current}\n\n${sentence}` : sentence;
      if (next.length <= sentenceBatchChars || !current) {
        current = next;
      } else {
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
    const addition = current ? `\n\n${paragraph}` : paragraph;
    if ((current + addition).length <= maxChars) {
      current += addition;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+/g) || [paragraph];
    current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) chunks.push(current);
        current = sentence.trim();
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wavBuffer(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
  header.writeUInt16LE(channels * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function generateChunk(text, index) {
  const wavPath = path.join(chunkDir, `chunk-${String(index).padStart(2, "0")}.wav`);
  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 44) {
    console.log(`Skipping existing ${path.basename(wavPath)}`);
    return wavPath;
  }

  const prompt = [
    "Synthesize speech from the transcript only.",
    `Style: ${delivery}`,
    "Do not speak labels, instructions, brackets, or headings.",
    "Transcript:",
    "",
    text,
  ].join("\n");

  let json;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    });

    if (res.ok) {
      json = await res.json();
      break;
    }

    const body = await res.text();
    const retryMatch = body.match(/retry(?:Delay| in)[^0-9]*(\d+)/i);
    if (res.status === 429 && attempt < 4) {
      const waitSecs = Math.max(20, Number(retryMatch?.[1] || 45) + 3);
      console.log(`Rate limited on chunk ${index}; waiting ${waitSecs}s before retry ${attempt + 1}/4`);
      await new Promise(resolve => setTimeout(resolve, waitSecs * 1000));
      continue;
    }

    throw new Error(`Gemini TTS failed (${res.status}): ${body}`);
  }

  const data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error(`No audio returned for chunk ${index}`);

  fs.writeFileSync(wavPath, wavBuffer(Buffer.from(data, "base64")));
  return wavPath;
}

const chunks = chunkText(script, maxChars);
console.log(`Generating ${chunks.length} Gemini TTS chunk(s) with ${model}, voice ${voice}`);
if (chunkMode === "sentence") {
  console.log("Chunk mode: sentence, one sentence per generated audio file");
} else if (chunkMode === "sentence-batch") {
  console.log(`Chunk mode: sentence-batch, grouped sentence chunks up to ${sentenceBatchChars} chars`);
} else {
  console.log(`Chunk target: ${maxChars} chars, about 45-65 seconds per chunk`);
}

const wavs = [];
let generatedThisRun = 0;
for (let i = 0; i < chunks.length; i += 1) {
  console.log(`Chunk ${i + 1}/${chunks.length}`);
  const wavPath = path.join(chunkDir, `chunk-${String(i + 1).padStart(2, "0")}.wav`);
  const exists = fs.existsSync(wavPath) && fs.statSync(wavPath).size > 44;
  if (!exists && maxGenerateChunks > 0 && generatedThisRun >= maxGenerateChunks) {
    console.log(`Reached --max-generate-chunks ${maxGenerateChunks}; stopping before chunk ${i + 1}`);
    break;
  }
  wavs.push(await generateChunk(chunks[i], i + 1));
  if (!exists) generatedThisRun += 1;
}

const expectedWavs = chunks.map((_, i) => path.join(chunkDir, `chunk-${String(i + 1).padStart(2, "0")}.wav`));
const missingWavs = expectedWavs.filter(file => !fs.existsSync(file) || fs.statSync(file).size <= 44);
if (missingWavs.length) {
  console.log(`Generated ${generatedThisRun} new chunk(s) this run. Missing ${missingWavs.length}/${expectedWavs.length} chunk(s).`);
  console.log(`Next missing chunk: ${path.basename(missingWavs[0])}`);
  if (skipStitch || maxGenerateChunks > 0) process.exit(0);
  throw new Error("Cannot stitch because some chunks are missing");
}

const concatPath = path.join(chunkDir, "concat.txt");
fs.writeFileSync(concatPath, expectedWavs.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");

const archiveWav = path.join(outDir, `${stem}-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`);
const concat = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-ar", "44100", "-ac", "1", archiveWav], { stdio: "inherit" });
if (concat.status !== 0) throw new Error("ffmpeg wav concat failed");

const mp3 = spawnSync("ffmpeg", ["-y", "-i", archiveWav, "-ar", "44100", "-ac", "1", "-b:a", "128k", outPath], { stdio: "inherit" });
if (mp3.status !== 0) throw new Error("ffmpeg mp3 encode failed");

console.log(`Saved ${outPath}`);
console.log(`Archived ${archiveWav}`);
