#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split(/=(.*)/s, 2);
    out[key] = inline ?? argv[++i] ?? true;
  }
  return out;
}

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    return execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-a", "fromthelogo", "-s", "ftl-gemini-youtube", "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new Error(
      "No Gemini key found. Set GEMINI_API_KEY or add Keychain service ftl-gemini-youtube for account fromthelogo.",
    );
  }
}

const args = argsOf(process.argv.slice(2));
if (!args.url || !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(args.url)) {
  console.error("Usage: gemini-youtube-url-review.mjs --url=<public YouTube URL> [--prompt=...] [--out=...] [--game-date=YYYY-MM-DD]");
  process.exit(2);
}

const model = String(args.model || "gemini-3.6-flash");
const currentDate = new Date().toISOString().slice(0, 10);
const gameDate = args["game-date"] ? String(args["game-date"]) : "unknown";
const userPrompt = String(
  args.prompt ||
    "Describe every distinct basketball play, reaction, scoreboard/clock state, camera angle, replay, visible caption, and useful candidate cut. Give approximate video timestamps. Do not identify a player unless the name or jersey is visibly supported; otherwise describe the player by team and role.",
);

const groundedPrompt = `You are performing preliminary visual screening of a public YouTube basketball video for From The Logo.
Current date: ${currentDate}. Historical game date: ${gameDate}.
Watch the actual video frames and audio. Do not substitute the title, description, transcript, search results, or model memory for visual evidence.
This is a semantic first pass, not final timestamp, identity, fact, or edit authority. Mark uncertainty explicitly. Never infer a jersey identity from memory.

Return valid JSON with this shape:
{
  "videoSummary": "string",
  "visibleTeamsAndUniforms": ["string"],
  "plays": [{"start": 0, "end": 0, "description": "string", "visibleEvidence": "string", "cameraAngle": "string", "editorialValue": "string", "confidence": "high|medium|low"}],
  "reactions": [{"time": 0, "description": "string"}],
  "onscreenText": [{"time": 0, "text": "string"}],
  "audioNotes": [{"start": 0, "end": 0, "note": "string"}],
  "uncertainties": ["string"]
}

Task: ${userPrompt}`;

const body = {
  contents: [{
    role: "user",
    parts: [
      { file_data: { file_uri: String(args.url) } },
      { text: groundedPrompt },
    ],
  }],
  generationConfig: {
    temperature: 0,
    maxOutputTokens: Number(args["max-output-tokens"] || 6000),
    thinkingConfig: { thinkingLevel: String(args["thinking-level"] || "minimal") },
    responseMimeType: "application/json",
  },
};

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-goog-api-key": apiKey(),
  },
  body: JSON.stringify(body),
});
const raw = await response.text();
let envelope;
try {
  envelope = JSON.parse(raw);
} catch {
  throw new Error(`Gemini returned non-JSON HTTP ${response.status}: ${raw.slice(0, 500)}`);
}
if (!response.ok) {
  throw new Error(`Gemini HTTP ${response.status}: ${envelope?.error?.message || raw.slice(0, 500)}`);
}

const answerText = (envelope.candidates?.[0]?.content?.parts || [])
  .map((part) => part.text || "")
  .join("")
  .trim();
let analysis;
try {
  analysis = JSON.parse(answerText);
} catch {
  analysis = { rawAnswer: answerText };
}

const result = {
  schemaVersion: 1,
  preliminaryOnly: true,
  transport: "google-official-gemini-api",
  model,
  sourceUrl: String(args.url),
  currentDate,
  gameDate,
  usage: envelope.usageMetadata || null,
  analysis,
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (args.out) {
  const output = resolve(String(args.out));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serialized, { mode: 0o600 });
  console.log(output);
} else {
  process.stdout.write(serialized);
}
