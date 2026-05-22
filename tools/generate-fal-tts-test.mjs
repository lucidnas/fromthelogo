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
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
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

const PRESETS = {
  kokoro: {
    endpoint: "fal-ai/kokoro/american-english",
    price: "$0.02 / 1k chars",
    defaultVoice: "af_heart",
    buildPayload: ({ text, voice, speed }) => ({ prompt: text, voice, speed }),
  },
  qwen: {
    endpoint: "fal-ai/qwen-3-tts/text-to-speech/0.6b",
    price: "$0.07 / 1k chars",
    defaultVoice: "Ryan",
    buildPayload: ({ text, voice, instructions }) => ({ text, voice, prompt: instructions, language: "English" }),
  },
  minimax: {
    endpoint: "fal-ai/minimax/speech-02-hd",
    price: "$0.03 / 1k chars",
    defaultVoice: "Wise_Woman",
    buildPayload: ({ text, voice, speed }) => ({
      text,
      output_format: "url",
      language_boost: "English",
      voice_setting: {
        voice_id: voice,
        speed,
        emotion: "neutral",
        english_normalization: true,
      },
      audio_setting: {
        sample_rate: "44100",
        bitrate: "128000",
        format: "mp3",
        channel: "1",
      },
    }),
  },
  f5: {
    endpoint: "fal-ai/f5-tts",
    price: "$0.20 / 1k chars + reference audio required",
    defaultVoice: "",
    buildPayload: ({ text, refAudioUrl, refText }) => {
      if (!refAudioUrl) throw new Error("f5 preset requires --ref-audio-url");
      return { gen_text: text, ref_audio_url: refAudioUrl, ref_text: refText || "" };
    },
  },
};

if (args.has("list-models")) {
  console.log("Cheap fal.ai TTS presets:");
  for (const [name, preset] of Object.entries(PRESETS)) {
    console.log(`- ${name}: ${preset.endpoint} (${preset.price})`);
  }
  process.exit(0);
}

if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not set");

const scriptPath = args.get("script");
const outPath = args.get("out");
const presetName = args.get("preset") || "kokoro";
const preset = PRESETS[presetName];
const endpoint = args.get("endpoint") || preset?.endpoint;
const sampleChars = Number(args.get("sample-chars") || "1000");
const voice = args.get("voice") || preset?.defaultVoice || "";
const speed = Number(args.get("speed") || "0.9");
const instructions = args.get("instructions") || "Calm, normal sports narration pace. Clear, conversational, steady voice.";
const refAudioUrl = args.get("ref-audio-url") || "";
const refText = args.get("ref-text") || "";
const payloadJson = args.get("payload-json");
const pollIntervalMs = Number(args.get("poll-interval-ms") || "1500");
const timeoutMs = Number(args.get("timeout-ms") || "180000");

if (!endpoint) throw new Error(`Unknown --preset ${presetName}; use --list-models`);
if (!scriptPath) throw new Error("Missing --script /path/to/script.txt");
if (!outPath) throw new Error("Missing --out /path/to/output.mp3");

let text = fs.readFileSync(scriptPath, "utf8").trim();
if (sampleChars > 0) text = text.slice(0, sampleChars).trim();
if (!text) throw new Error(`Script is empty: ${scriptPath}`);

function buildPayload() {
  if (payloadJson) {
    const payload = JSON.parse(fs.readFileSync(payloadJson, "utf8"));
    return JSON.parse(JSON.stringify(payload).replaceAll("{{TEXT}}", text));
  }
  if (!preset) throw new Error("Custom --endpoint requires --payload-json with {{TEXT}} placeholder");
  return preset.buildPayload({ text, voice, speed, instructions, refAudioUrl, refText });
}

async function falJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const bodyText = await res.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = bodyText;
  }
  if (!res.ok) throw new Error(`fal.ai request failed (${res.status}) ${url}: ${bodyText}`);
  return body;
}

function findAudioUrl(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.url === "string" && /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(value.url)) return value.url;
  if (typeof value.audio_url === "string") return value.audio_url;
  if (value.audio && typeof value.audio.url === "string") return value.audio.url;
  if (value.output && typeof value.output.url === "string") return value.output.url;
  for (const child of Object.values(value)) {
    const found = findAudioUrl(child);
    if (found) return found;
  }
  return "";
}

const payload = buildPayload();
console.log(`Submitting fal.ai TTS test: ${endpoint}`);
console.log(`Preset: ${presetName}${preset?.price ? ` (${preset.price})` : ""}`);
if (voice) console.log(`Voice: ${voice}`);
if (Number.isFinite(speed)) console.log(`Speed: ${speed}`);
if (sampleChars > 0) console.log(`Sample mode: first ${sampleChars} chars`);

const submit = await falJson(`https://queue.fal.run/${endpoint}`, {
  method: "POST",
  body: JSON.stringify(payload),
});

let result = submit;
if (submit.status_url && submit.response_url) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await falJson(submit.status_url, { method: "GET" });
    const state = status.status || status.state;
    console.log(`Status: ${state || "unknown"}`);
    if (state === "COMPLETED") {
      result = await falJson(submit.response_url, { method: "GET" });
      break;
    }
    if (state === "FAILED" || state === "ERROR") {
      throw new Error(`fal.ai job failed: ${JSON.stringify(status)}`);
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

const audioUrl = findAudioUrl(result);
if (!audioUrl) {
  const resultPath = `${outPath}.fal-result.json`;
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
  throw new Error(`Could not find an audio URL in fal.ai response. Saved response to ${resultPath}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const download = spawnSync("ffmpeg", ["-y", "-i", audioUrl, "-ar", "44100", "-ac", "1", "-b:a", "128k", outPath], { stdio: "inherit" });
if (download.status !== 0) throw new Error("ffmpeg download/transcode failed");

const manifest = {
  provider: "fal.ai",
  endpoint,
  preset: presetName,
  price: preset?.price || null,
  voice,
  speed,
  scriptPath,
  outPath,
  sampleChars,
  payload,
  result,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(`${outPath}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Saved ${outPath}`);
