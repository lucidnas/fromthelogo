#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , scriptPath, outputPath] = process.argv;

if (!scriptPath || !outputPath) {
  console.error("Usage: node tools/generate-elevenlabs-vo-with-pauses.mjs SCRIPT_PATH OUTPUT_MP3");
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";
const voiceSpeed = Number(process.env.ELEVENLABS_VOICE_SPEED ?? "0.96");

if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");

const outDir = path.dirname(outputPath);
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const workLabel = process.env.ELEVENLABS_WORK_LABEL ?? "vo-work";
const workDir = path.join(outDir, `${workLabel}-${stamp}`);
fs.mkdirSync(workDir, { recursive: true });

const rawScript = fs.readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n").trim();

function splitLongText(text, maxChars = 4300) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const para of paras) {
    if ((current + "\n\n" + para).trim().length > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = (current + "\n\n" + para).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const pieces = [];
let cursor = 0;
const pauseRe = /\[PAUSE:\s*([\d.]+)\s*seconds?[^\]]*\]/gi;
let match;
while ((match = pauseRe.exec(rawScript))) {
  const before = rawScript.slice(cursor, match.index).trim();
  for (const chunk of splitLongText(before)) pieces.push({ type: "text", text: chunk });
  pieces.push({ type: "silence", seconds: Number(match[1]) });
  cursor = match.index + match[0].length;
}
for (const chunk of splitLongText(rawScript.slice(cursor).trim())) {
  pieces.push({ type: "text", text: chunk });
}

async function synthesize(text, filePath) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      "accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.48,
        similarity_boost: 0.78,
        style: 0.1,
        speed: voiceSpeed,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs failed with ${res.status}: ${err}`);
  }

  const data = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, data);
}

const audioFiles = [];
let textIndex = 0;
let silenceIndex = 0;

for (const piece of pieces) {
  if (piece.type === "text") {
    const file = path.join(workDir, `chunk-${String(++textIndex).padStart(2, "0")}.mp3`);
    console.log(`Generating text chunk ${textIndex} (${piece.text.length} chars)`);
    await synthesize(piece.text, file);
    audioFiles.push(file);
  } else {
    const file = path.join(workDir, `silence-${String(++silenceIndex).padStart(2, "0")}-${piece.seconds}s.mp3`);
    console.log(`Generating silence ${piece.seconds}s`);
    execFileSync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      piece.seconds.toFixed(3),
      "-b:a",
      "128k",
      file,
    ]);
    audioFiles.push(file);
  }
}

const filterParts = [];
const args = ["-y", "-hide_banner", "-loglevel", "error"];
audioFiles.forEach((file, i) => {
  args.push("-i", file);
  filterParts.push(`[${i}:a]aresample=44100,asetpts=PTS-STARTPTS[a${i}]`);
});
const joinedInputs = audioFiles.map((_, i) => `[a${i}]`).join("");
const filter = `${filterParts.join(";")};${joinedInputs}concat=n=${audioFiles.length}:v=0:a=1,apad=pad_dur=0.25[out]`;

args.push(
  "-filter_complex",
  filter,
  "-map",
  "[out]",
  "-ar",
  "44100",
  "-ac",
  "1",
  "-b:a",
  "128k",
  outputPath,
);

execFileSync("ffmpeg", args);
console.log(`Wrote ${outputPath}`);
console.log(`Work dir: ${workDir}`);
