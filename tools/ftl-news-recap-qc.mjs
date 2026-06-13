#!/usr/bin/env node
// FTL News Recap — long-form upload-gate QC.
// Uploads a rendered news-recap MP4 to Gemini (Files API, gemini-2.5-pro) and runs a strict
// long-form review. Use this INSTEAD of tools/gemini-cli-review.mjs for news recaps: that tool
// delegates any video > 20 MB to the Shorts batch reviewer, which wrongly fails a 4-6 min recap
// for exceeding the 60-second Shorts limit.
//
// Usage:
//   node tools/ftl-news-recap-qc.mjs --video PATH [--title "..."] [--out PATH] [--model M]

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const REPO = "/Users/abdul/code/fromthelogo";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(`Usage: node tools/ftl-news-recap-qc.mjs --video PATH [--title "..."] [--out PATH] [--model M]`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { model: "gemini-2.5-pro" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { const v = argv[++i]; if (v == null) usage(`${a} needs a value`); return v; };
    if (a === "--video") args.video = next();
    else if (a === "--title") args.title = next();
    else if (a === "--out") args.out = next();
    else if (a === "--model") args.model = next();
    else if (a === "--help" || a === "-h") usage();
    else usage(`unknown flag ${a}`);
  }
  if (!args.video) usage("--video is required");
  if (!fs.existsSync(args.video)) usage(`video not found: ${args.video}`);
  args.title ||= "(untitled)";
  args.out ||= path.join(path.dirname(args.video), "qc-longform.txt");
  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function buildPrompt(title) {
  return `You are doing a STRICT upload-gate QC on a From The Logo (FTL) LONG-FORM (4-6 minute) Caitlin Clark NEWS RECAP video. It is intentionally long-form, NOT a YouTube Short — do not flag its length. Format: image-led — AI editorial images + typeset on-screen "receipt" cards (real headlines/stats) + occasional Caitlin Clark game b-roll, over a voice-over with burned-in captions. Title: "${title}".

IMPORTANT: Do NOT fact-check statistics, scores, dates, or records against your own training knowledge. This covers CURRENT events that are newer than your knowledge cutoff, and the on-screen facts were already verified against live sources by a separate web fact-check. Treat the on-screen numbers/dates as correct. Only judge whether the text is LEGIBLE, correctly SPELLED, internally consistent, and visually well presented — never whether a stat "looks wrong" to you.

Go through it and report concretely with timestamps:
1. RECEIPT CARDS: find each on-screen text card. Quote the text you see. Is it legible, correctly spelled, and does it read as clean sports-news framing? (Do not second-guess the numbers.)
2. VISUAL/NARRATION MATCH: do the images match what the VO is saying at that moment? Call out any image that is clearly wrong or irrelevant.
3. IMAGE QUALITY: any broken, distorted, garbled, or AI-glitched images (bad hands, melted faces, gibberish text)?
4. B-ROLL: is the game footage actually basketball / Caitlin Clark, and framed well (fills the frame) or small/awkward?
5. CAPTIONS: legible? correctly spelled (especially names like Caitlin Clark, Aliyah Boston, Sophie Cunningham)? roughly in sync with the VO?
6. PACING: any image that holds too long with no motion?
End with: VERDICT: SHIP or VERDICT: FIX, then a short prioritized bullet list of the top issues.`;
}

async function main() {
  loadEnvFile(path.join(REPO, ".env"));
  loadEnvFile(path.join(REPO, "local/.env.local"));
  loadEnvFile(path.join(REPO, ".env.local"));
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.error(`Uploading ${args.video} ...`);
  let file = await ai.files.upload({ file: args.video, config: { mimeType: "video/mp4" } });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 4000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`upload state ${file.state}`);
  console.error("ACTIVE — reviewing...");

  const res = await ai.models.generateContent({
    model: args.model,
    contents: [{ role: "user", parts: [
      { fileData: { fileUri: file.uri, mimeType: "video/mp4" } },
      { text: buildPrompt(args.title) },
    ] }],
  });
  const text = res.text || "";
  fs.writeFileSync(args.out, text);
  console.log(text);
  console.error(`\nSaved QC to ${args.out}`);
  const verdict = (text.match(/VERDICT:\s*(SHIP|FIX)/i) || [])[1] || "UNKNOWN";
  console.error(`VERDICT: ${verdict}`);
  if (verdict.toUpperCase() !== "SHIP") process.exit(3);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
