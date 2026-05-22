#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

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

function values(name) {
  const out = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const clips = values("clip");
const outPath = arg("out");
const claim = arg("claim");
const model = arg("model", process.env.GEMINI_MODEL || "gemini-3.1-pro-preview");

if (!clips.length || !outPath || !claim) {
  console.error("Usage: node tools/gemini-locate-claim-in-videos.mjs --clip FILE [--clip FILE...] --claim TEXT --out FILE [--model MODEL]");
  process.exit(1);
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadClip(clipPath, index) {
  if (!fs.existsSync(clipPath)) throw new Error(`Clip not found: ${clipPath}`);
  const bytes = fs.readFileSync(clipPath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: "video/mp4" }),
    config: {
      mimeType: "video/mp4",
      displayName: `${String(index + 1).padStart(2, "0")}-${path.basename(clipPath)}`,
    },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${clipPath}: ${file.state}`);
  return file;
}

console.log(`Uploading ${clips.length} clip(s) to ${model}...`);
const uploads = [];
for (let i = 0; i < clips.length; i += 1) {
  console.log(`Uploading ${i + 1}/${clips.length}: ${clips[i]}`);
  uploads.push({ clipPath: clips[i], file: await uploadClip(clips[i], i) });
}

const context = clips.map((clipPath, index) => ({
  clipIndex: index,
  fileName: path.basename(clipPath),
  clipPath,
}));

const prompt = `
You are a senior video logger for From The Logo.

Find this exact claimed play in the uploaded video(s):
${claim}

Use the official play-by-play claim as the search target, but only mark a match when the visible video supports it.

Return strict JSON only:
{
  "claim": "copy the claim",
  "found": true,
  "bestMatch": {
    "clipIndex": 0,
    "fileName": "",
    "confidence": "high|medium|low",
    "timestampStart": 0,
    "timestampEnd": 0,
    "visibleClock": "",
    "visibleQuarter": "",
    "visibleScore": "",
    "whatHappens": "",
    "clarkRole": "",
    "scorer": "",
    "passer": "",
    "jerseyEvidence": "",
    "whyThisMatches": ""
  },
  "allCandidates": [
    {
      "clipIndex": 0,
      "timestampStart": 0,
      "timestampEnd": 0,
      "confidence": "high|medium|low",
      "matchStatus": "exact|partial|not_match",
      "reason": ""
    }
  ],
  "notFoundReason": "",
  "recommendedEditorAction": ""
}

Uploaded clip context:
${JSON.stringify(context, null, 2)}
`;

const response = await ai.models.generateContent({
  model,
  contents: [{
    role: "user",
    parts: [
      ...uploads.map(({ file }) => ({ fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } })),
      { text: prompt },
    ],
  }],
  config: {
    temperature: 0,
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
