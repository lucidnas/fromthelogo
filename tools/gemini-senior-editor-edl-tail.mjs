#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const [, , slugArg, startArg, outputArg] = process.argv;
if (!slugArg || !startArg) {
  console.error("Usage: node tools/gemini-senior-editor-edl-tail.mjs <slug> <startSecs> [output.json]");
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in env or .env");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const slug = slugArg;
const startSecs = Number(startArg);
const videoDir = `${SSD}/ftl/videos/${slug}`;
const brollDir = `${SSD}/broll/aroll/${slug}`;
const voPath = `${videoDir}/vo.mp3`;
const existingPath = `${videoDir}/edit-script-gemini-senior-v1.json`;
const roughPath = `${videoDir}/edit-script-johnny-v2.json`;
const scriptPath = "/Users/abdul/transcripts/script-fever-sparks-2026-05-13-spectacular.txt";
const researchPath = "research/celebration-ideas/2026-05-15-fever-sparks-clark-game-review.md";
const outputPath = outputArg || `${videoDir}/edit-script-gemini-senior-tail-v1.json`;

const assets = [
  {
    asset: "wnba-official-K_rW6X9FP8M.mp4",
    path: `${brollDir}/wnba-official-K_rW6X9FP8M.mp4`,
    mimeType: "video/mp4",
  },
  {
    asset: "fever-official-HYen3giL5Jc.mp4",
    path: `${brollDir}/fever-official-HYen3giL5Jc.mp4`,
    mimeType: "video/mp4",
  },
  { asset: "vo.mp3", path: voPath, mimeType: "audio/mpeg" },
];

for (const asset of assets) {
  if (!fs.existsSync(asset.path)) throw new Error(`Missing ${asset.path}`);
}

const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
const rough = fs.existsSync(roughPath) ? JSON.parse(fs.readFileSync(roughPath, "utf8")) : null;
const scriptText = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
const researchText = fs.existsSync(researchPath) ? fs.readFileSync(researchPath, "utf8") : "";
const voiceDuration = Number(existing.voiceDuration || rough?.voiceDuration || 482.248);

const roughTail = (rough?.cues || [])
  .filter((cue) => Number(cue.end) > startSecs - 5)
  .map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    beat: cue.beat,
    vo: cue.vo,
    asset: cue.asset,
    assetPath: cue.assetPath,
    sourceIn: cue.sourceIn,
    sourceOut: cue.sourceOut,
    overlays: cue.overlays,
    treatment: cue.treatment,
    graphics: cue.graphics,
    freezeFrames: cue.freezeFrames,
  }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function upload(asset) {
  const uploaded = await ai.files.upload({
    file: new Blob([fs.readFileSync(asset.path)], { type: asset.mimeType }),
    config: { mimeType: asset.mimeType, displayName: `${slug}-tail-${asset.asset}` },
  });
  let file = uploaded;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Upload failed: ${asset.asset} ${file.state}`);
  return { asset, file };
}

console.log(`Uploading tail inputs for ${startSecs}-${voiceDuration}...`);
const uploads = [];
for (const asset of assets) uploads.push(await upload(asset));

const prompt = `
You are the senior editor for From The Logo. Create ONLY the missing tail edit script from ${startSecs.toFixed(3)} to ${voiceDuration.toFixed(3)}.

Return strict JSON only:
{
  "voiceDuration": ${voiceDuration},
  "tailStart": ${startSecs},
  "tailEnd": ${voiceDuration},
  "cues": [
    {
      "start": number,
      "end": number,
      "beat": "short beat",
      "vo": "exact or summarized VO covered",
      "asset": "wnba-official-K_rW6X9FP8M.mp4 or fever-official-HYen3giL5Jc.mp4",
      "assetPath": "absolute path",
      "sourceIn": number,
      "sourceOut": number,
      "audioVolume": 0,
      "treatment": "specific edit instruction",
      "overlays": ["SHORT LABEL"],
      "overlayPosition": "default or scorebug-cover",
      "graphics": [
        {"type":"ring|arrow|line|label","startOffset":number,"duration":number,"x":number,"y":number,"w":number,"h":number,"x1":number,"y1":number,"x2":number,"y2":number,"text":"SHORT","color":"#FFE84D"}
      ],
      "freezeFrames": [
        {"startOffset":number,"duration":number,"sourceTime":number,"zoomFrom":number,"zoomTo":number,"x":number,"y":number,"label":"SHORT LABEL"}
      ],
      "editorNote": "why this screen choice belongs here"
    }
  ],
  "validationChecklist": ["..."]
}

Rules:
- The first cue must start exactly ${startSecs.toFixed(3)}.
- The last cue must end exactly ${voiceDuration.toFixed(3)}.
- Cues must be contiguous with no gaps or overlaps.
- Use only these assetPath values:
  - ${assets[0].path}
  - ${assets[1].path}
- Do not invent names. If uncertain use labels like HELP, CUTTER, WINDOW, SECOND DEFENDER.
- This is FTL Celebration, not insult comedy.
- Use Awful-Coaching-style mechanics: pause, replay, freeze, ring, arrow, label, show the read, then payoff.
- Add at least 10 freezeFrames and at least 18 graphics in this tail.
- Use short cues, usually 2-7 seconds.
- Every cue must explain the VO visually.

Known verified moments and facts:
${researchText}

Full script:
${scriptText}

The already-generated edit stopped here. Continue it, do not rewrite earlier cues:
${JSON.stringify((existing.cues || []).slice(-5), null, 2)}

Rough tail timing map from the prior EDL. Improve this heavily with more freeze frames, arrows, and rings:
${JSON.stringify(roughTail, null, 2)}
`;

const response = await ai.models.generateContent({
  model: process.env.GEMINI_SENIOR_EDITOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  contents: [
    {
      role: "user",
      parts: [
        ...uploads.map(({ asset, file }) => ({ fileData: { fileUri: file.uri, mimeType: file.mimeType || asset.mimeType } })),
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.05,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.writeFileSync(outputPath, response.text);
console.log(`Wrote ${outputPath}`);
