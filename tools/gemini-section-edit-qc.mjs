#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const [videoPath, editScriptPath, outputPath] = process.argv.slice(2);

if (!videoPath || !editScriptPath || !outputPath) {
  console.error("Usage: node tools/gemini-section-edit-qc.mjs <section.mp4> <section-edit-script.json> <output.json>");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const editScript = JSON.parse(fs.readFileSync(editScriptPath, "utf8"));
const videoBytes = fs.readFileSync(videoPath);

const upload = await ai.files.upload({
  file: new Blob([videoBytes], { type: "video/mp4" }),
  config: { mimeType: "video/mp4", displayName: path.basename(videoPath) },
});

let file = upload;
while (file.state === "PROCESSING") {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  file = await ai.files.get({ name: file.name });
}

if (file.state !== "ACTIVE") {
  throw new Error(`Gemini upload failed with state ${file.state}`);
}

const cueContext = (editScript.cues ?? []).map((cue, index) => ({
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
  graphics: cue.graphics,
  visualMode: cue.visualMode,
}));

const sectionName = process.env.SECTION_NAME || editScript.section || "this section";
const sectionBrief = process.env.SECTION_BRIEF || "Review whether the visuals match the VO and whether any repeated clips are justified by new analysis.";

const prompt = `
You are a world-class YouTube sports editor reviewing ${sectionName} of a From The Logo Caitlin Clark video.

This is not a generic roast. Be a professional editor who does not let anything slide. Watch the entire 49-second section carefully, including VO, pacing, on-screen text, freeze opportunities, motion graphics, image inserts, and whether the visual proof matches the words.

Section-specific brief:
${sectionBrief}

Channel/editing target:
- FTL is a faceless Caitlin Clark / Indiana Fever channel. Caitlin Clark, CC, or Caitlin is the emotional center.
- The style should feel like casual basketball film-room: Daniel Li / From The Logo energy, not documentary filler.
- The hook must make viewers feel: this bucket was historic, but the real reason it is genius is the choice Caitlin made.
- The visuals should show first, then the VO should explain. Pauses are valuable when the play needs to breathe.

Hard standards:
- Every VO beat needs matching visual proof.
- Freeze frames should happen on decision points, not random frames.
- Ken Burns on images should feel intentional: full-screen, not cropped, top visible, slow motion that keeps the viewer engaged.
- Replays are allowed only when each repeat teaches something new: different angle, slower speed, freeze, arrow, ring, distance label, clock/score receipt, or before/after comparison.
- Repeated layups are especially risky here. If the same layup appears too many times, identify each unnecessary repeat and say what should replace it: alternate angle, deeper range receipt, pass receipt, defender-position freeze, scoreboard/clock receipt, graphic board, or a shortened cut.
- Avoid raw highlight loops. Strengthen fair-use posture with overlays, short analytical repeats, freeze frames, and motion graphics.
- If an overlay blocks the ball, Caitlin, defender, scoreboard, clock, or lane, call it out.
- If a moment needs announcer audio, crowd reaction, a pause, a freeze, a zoom, or a graphic, say exactly where.

Return strict JSON only:
{
  "overallVerdict": "one blunt paragraph",
  "sectionScore": {
    "hookClarity": 1,
    "visualVoMatch": 1,
    "pacing": 1,
    "fairUseTransformation": 1,
    "professionalPolish": 1
  },
  "nonNegotiableFixes": [
    {"time":"MM:SS-MM:SS","problem":"...","fix":"..."}
  ],
  "secondBySecondPlan": [
    {
      "time":"MM:SS-MM:SS",
      "voBeat":"what the VO is saying or the pause beat",
      "currentVisual":"what is actually on screen",
      "verdict":"keep|fix|replace|tighten|extend|freeze|add-motion",
      "exactEdit":"the exact edit that should happen at this timestamp",
      "freezeFrameInstruction":"frame/time to freeze, duration, and why; or 'none'",
      "kenBurnsOrMotion":"camera/motion instruction, e.g. slow push, punch-in, pan, no crop, top visible; or 'none'",
      "graphicsOverlays":"specific labels/arrows/rings/clock-score receipts to add or remove",
      "audioTiming":"whether VO should pause, resume, duck, or let natural/crowd audio breathe",
      "fairUsePurpose":"how this edit makes the use more analytical/commentary-driven"
    }
  ],
  "assetReuseAudit": [
    {"moment":"...","where":"...","verdict":"keep|replace|needs alternate angle|needs stronger treatment","reason":"..."}
  ],
  "implementationChecklist": [
    "ordered concrete action"
  ]
}

Make the secondBySecondPlan cover the whole section with short ranges, usually 1-4 seconds. If something works, still explain why it works and how to polish it. Be specific enough that an editor can implement the notes without asking follow-up questions.

Section edit script cue context:
${JSON.stringify(cueContext, null, 2)}
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
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, response.text);
console.log(outputPath);
