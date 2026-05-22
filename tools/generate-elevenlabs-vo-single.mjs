#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [, , scriptPath, outputPath] = process.argv;

if (!scriptPath || !outputPath) {
  console.error("Usage: node tools/generate-elevenlabs-vo-single.mjs SCRIPT_PATH OUTPUT_MP3");
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT ?? "mp3_44100_128";

if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");

const raw = fs.readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n").trim();
if (!raw) throw new Error(`Script is empty: ${scriptPath}`);

// ElevenLabs handles natural prose and pause tags better than stitched chunk audio.
// Convert our neutral pause marker into a single-call tag while preserving the text.
const text = raw
  .replace(/\[PAUSE:\s*([\d.]+)\s*seconds?[^\]]*\]/gi, (_, secs) => `<break time="${Number(secs).toFixed(1)}s" />`)
  .replace(/\[pause\]/gi, '<break time="1.0s" />')
  .replace(/\[long pause\]/gi, '<break time="1.8s" />');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const body = {
  text,
  model_id: modelId,
  voice_settings: {
    stability: Number(process.env.ELEVENLABS_STABILITY ?? "0.42"),
    similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? "0.78"),
    style: Number(process.env.ELEVENLABS_STYLE ?? "0.18"),
    use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST !== "0",
  },
};

const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
    "content-type": "application/json",
    "accept": "audio/mpeg",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const err = await res.text();
  throw new Error(`ElevenLabs single-call failed with ${res.status}: ${err}`);
}

fs.writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
fs.writeFileSync(`${outputPath}.manifest.json`, JSON.stringify({
  provider: "elevenlabs",
  mode: "single-call",
  modelId,
  voiceId,
  outputFormat,
  scriptPath,
  outputPath,
  chars: text.length,
  voiceSettings: body.voice_settings,
  createdAt: new Date().toISOString(),
}, null, 2) + "\n");

console.log(outputPath);
