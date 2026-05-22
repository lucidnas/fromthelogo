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

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const [videoPath, transcriptPath, outputPath] = process.argv.slice(2);

if (!videoPath || !transcriptPath || !outputPath) {
  console.error("Usage: node tools/gemini-edit-anatomy.mjs <video.mp4> <transcript.txt> <output.md>");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const transcript = fs.readFileSync(transcriptPath, "utf8");
const videoBytes = fs.readFileSync(videoPath);

console.log(`Uploading ${videoPath} to Gemini...`);
const upload = await ai.files.upload({
  file: new Blob([videoBytes], { type: "video/mp4" }),
  config: { mimeType: "video/mp4", displayName: path.basename(videoPath) },
});

let file = upload;
while (file.state === "PROCESSING") {
  await new Promise(resolve => setTimeout(resolve, 5000));
  file = await ai.files.get({ name: file.name });
  console.log(`Gemini file state: ${file.state}`);
}

if (file.state !== "ACTIVE") {
  throw new Error(`Gemini upload failed with state ${file.state}`);
}

const prompt = `
You are Gemini acting as a senior YouTube video editor and retention analyst.

Watch the full uploaded Awful Coaching video and reverse-engineer its exact editing structure. This is NOT a summary of the topic. The user needs a detailed production blueprint that From The Logo can copy structurally without copying the creator's exact words.

Analyze:
- second-by-second visual structure
- how often the clip changes
- when it uses live play vs replay vs freeze/hold vs zoom/crop
- whether there are arrows, circles, telestration, captions, scoreboard holds, or other overlays
- how the VO maps to what is visible
- how each play is introduced, explained, and paid off
- the rhythm of "look here" phrases against visual cues
- how it handles transitions between plays
- how it maintains retention without a traditional narrative
- how much of each possession is shown before/after the important action
- where it lets the clip breathe vs where it talks continuously

Do not give a generic review. Give the full detailed editing recipe.

Return markdown with these sections:

# Awful Coaching Edit Anatomy

## One-Sentence Formula
One precise sentence naming the editing format.

## Global Editing Rules
Detailed bullets. Include clip length averages, visual rhythm, VO density, replay/freeze usage, and how the screen is directed.

## Timeline Anatomy
A dense timestamped table covering the whole video. Use rows every 5-15 seconds, or tighter when the edit changes faster.
Columns:
- Time
- Visual State
- VO Function
- Edit Move
- Why It Retains
- FTL Replication Note

## Beat Pattern
Break down the repeated unit of the video. Include exact order of operations from play setup to payoff.

## Visual Language
Describe crops, pauses, replays, freeze frames, scoreboard/clock usage, overlays, and whether the edit relies on raw broadcast or added graphics.

## VO-To-Visual Mapping
Explain how phrases like "look at this," "right here," "so now," "again," "that gets..." correspond to screen action.

## What To Copy For FTL
Concrete implementation rules for our Caitlin Clark Celebration game videos.

## What Not To Copy
List verbal fingerprints, weaknesses, or things that would make FTL feel derivative.

## Deterministic Template
Give a reusable template for our automation. Include fields we should put in a clip-led edit JSON.

Transcript for reference:
${transcript}
`;

const response = await ai.models.generateContent({
  model: process.env.GEMINI_VIDEO_QC_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  contents: [
    {
      role: "user",
      parts: [
        { fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.1,
    maxOutputTokens: 32768,
  },
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${response.text.trim()}\n`);
console.log(outputPath);
