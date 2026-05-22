#!/usr/bin/env node
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const [videoPath, editScriptPath, outputPath] = process.argv.slice(2);

if (!videoPath || !editScriptPath || !outputPath) {
  console.error('Usage: node tools/gemini-video-edit-qc.mjs <video.mp4> <edit-script.json> <output.json>');
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve('.env'));
loadEnvFile(path.resolve('.env.local'));

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const editScript = JSON.parse(fs.readFileSync(editScriptPath, 'utf8'));
const videoBytes = fs.readFileSync(videoPath);

const upload = await ai.files.upload({
  file: new Blob([videoBytes], { type: 'video/mp4' }),
  config: { mimeType: 'video/mp4', displayName: path.basename(videoPath) },
});

let file = upload;
while (file.state === 'PROCESSING') {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  file = await ai.files.get({ name: file.name });
}

if (file.state !== 'ACTIVE') {
  throw new Error(`Gemini upload failed with state ${file.state}`);
}

const cueContext = editScript.cues.map((cue, index) => ({
  index,
  start: cue.start,
  end: cue.end,
  beat: cue.beat,
  vo: cue.vo,
  asset: cue.asset,
  sourceIn: cue.sourceIn,
  sourceOut: cue.sourceOut,
  treatment: cue.treatment,
  overlays: cue.overlays,
}));

const reviewBrief = process.env.GEMINI_VIDEO_QC_BRIEF || '';

const prompt = `
You are the senior editor and retention analyst for From The Logo, a faceless Caitlin Clark / Indiana Fever YouTube channel.

Review this full rendered video meticulously. The user needs a practical second-by-second editing repair list, not generic compliments.

Editorial standards:
- The visuals must show exactly what the Johnny VO is saying.
- Repeated clips are allowed only when each repeat reveals new information: slow motion, freeze frame, alternate angle, or a new overlay.
- Avoid long raw highlight stretches. Strengthen fair-use posture with analysis overlays, short clips, freeze frames, text callouts, clock/score receipts, and replay comparisons.
- The tone should feel casual basketball film-room, not corporate/editorial.
- Caitlin Clark, CC, or Caitlin should be the emotional center.
${reviewBrief ? `\nSpecific instructions for this review:\n${reviewBrief}\n` : ''}

Watch for:
- Wrong play or wrong player shown under a VO line.
- Same clip repeated without a new analytical purpose.
- Overlays that block the play, scoreboard, clock, or ball.
- Places that need freeze frames, slow motion, zooms, arrows, circles, distance markers, or alternate-angle replay.
- Places that need a pause so the viewer can actually see the play.
- Music or VO pacing issues.
- Any section that feels like filler, editorial, too static, or not Daniel Li / FTL enough.

Return strict JSON only with this shape:
{
  "overallVerdict": "short blunt verdict",
  "topProblems": [
    {"severity":"critical|major|minor","time":"MM:SS-MM:SS","problem":"...","fix":"..."}
  ],
  "timelineFixes": [
    {
      "time":"MM:SS-MM:SS",
      "severity":"critical|major|minor|ok",
      "whatIsOnScreen":"specific visual description",
      "voAlignment":"matched|partially matched|mismatched",
      "problem":"specific issue or 'works'",
      "exactFix":"specific edit instruction, including what clip/angle/treatment should replace or be added",
      "fairUseTreatment":"overlay/freeze/slowmo/replay/crop suggestion"
    }
  ],
  "clipReuseAudit": [
    {"clipOrMoment":"...","whereItAppears":"...","verdict":"keep|trim|replace|needs alternate angle","reason":"..."}
  ],
  "recommendedRepairOrder": [
    "ordered concrete step"
  ]
}

Make timelineFixes beat-by-beat across the full 8:49 video. Use short timestamp ranges, normally 3-10 seconds. If a range is clean, mark severity "ok"; do not skip large sections. Be direct and specific.

Current edit script cue context:
${JSON.stringify(cueContext, null, 2)}
`;

const response = await ai.models.generateContent({
  model: process.env.GEMINI_VIDEO_QC_MODEL || 'gemini-3.1-pro-preview',
  contents: [
    {
      role: 'user',
      parts: [
        { fileData: { fileUri: file.uri, mimeType: file.mimeType || 'video/mp4' } },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.15,
    maxOutputTokens: 32768,
    responseMimeType: 'application/json',
  },
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, response.text);
console.log(outputPath);
