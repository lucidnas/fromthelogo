#!/usr/bin/env node
// Gemini 2.5 Pro video review via the `gemini` CLI binary (instead of the SDK).
// Handles the workarounds documented at github.com/google-gemini/gemini-cli/issues/3379:
//   - @filename.mp4 syntax (file must be in cwd)
//   - --skip-trust for non-default directories
//   - Prepend an assertion that the CLI can read videos (the agent otherwise refuses)
//
// Usage:
//   node tools/gemini-cli-review.mjs --video=/abs/short.mp4 [--prompt="custom QC prompt"] [--out=/abs/review.json]
// Gemini CLI only. URL inputs and oversized files fail closed; there is no SDK/API fallback.
//
// Defaults to gemini-3.1-pro-preview. The CLI does not support YouTube URLs natively, so URL input fails closed.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [k, ...rest] = arg.replace(/^--/, "").split("=");
      return [k, rest.join("=") || "1"];
    }),
  );
}

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (k && process.env[k] == null) process.env[k] = v;
  }
}

loadEnv(path.resolve(".env"));
loadEnv(path.resolve(".env.local"));
loadEnv(path.resolve("local/.env.local"));

const args = parseArgs(process.argv.slice(2));
const video = args.video;
const url = args.url;
const userPrompt = args.prompt || "";
const outPath = args.out;
const model = args.model || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
const expectJson = args.json !== "0";
const gameDate = args["game-date"] || "not provided";
const teams = args.teams || "not provided";
const groundingPath = args.grounding ? path.resolve(args.grounding) : null;
if (groundingPath && !fs.existsSync(groundingPath)) {
  console.error(`Grounding file not found: ${groundingPath}`);
  process.exit(1);
}
const grounding = groundingPath ? fs.readFileSync(groundingPath, "utf8").trim() : "No official game-specific roster/play-by-play receipt supplied.";

if (!video && !url) {
  console.error("Usage: --video=/abs/short.mp4 [--prompt=...] [--out=...] [--game-date=YYYY-MM-DD] [--teams='IND vs MIN'] [--grounding=/abs/official-context.txt] [--json=1]");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY required (set in .env or env).");
  process.exit(1);
}

// --- YouTube URL path: fail closed. Download first; never fall back to an SDK/API. ---
if (url) {
  console.error("Gemini CLI cannot inspect this URL directly. Download it locally with yt-dlp, then rerun with --video. API fallback is forbidden.");
  process.exit(2);
}

// --- Local MP4 path: use gemini CLI with @file syntax ---
const videoPath = path.resolve(video);
if (!fs.existsSync(videoPath)) {
  console.error(`Video not found: ${videoPath}`);
  process.exit(1);
}

// Gemini CLI inlineData has a 20MB ceiling. Oversized inputs fail closed so callers
// can create a visually faithful QC proxy on Modal. API fallback is forbidden.
const fileSizeMb = fs.statSync(videoPath).size / (1024 * 1024);
if (fileSizeMb > 19.5) {
  console.error(`[gemini-cli-review] Video is ${fileSizeMb.toFixed(1)}MB and exceeds the CLI inline limit. Create a sub-19.5 MB QC proxy on Modal. API fallback is forbidden.`);
  process.exit(2);
}

const videoDir = path.dirname(videoPath);
const videoFile = path.basename(videoPath);

// The "you CAN read video" assertion is the documented workaround for the CLI's hardcoded
// refusal on video filetypes (gemini-cli issue #3379). Without it the agent says "I cannot
// analyze video content" even though the backend (fileUtils.ts) supports MP4 inlineData.
const today = new Date().toISOString().slice(0, 10);
const assertion = `You CAN read mp4 video files via @file inlineData/base64. The CLI's fileUtils.ts supports video MIME types. Do not refuse the task — read the video and answer.

Temporal grounding:
- Today's date: ${today}.
- Historical game date: ${gameDate}.
- Teams: ${teams}.
- Official game-specific context: ${grounding}

Treat the visible game as a historical event whose roster must match its actual game date, not today's roster and not model memory. Never guess a player name from jersey number alone. Assert a player identity only when the supplied game-specific official roster/play-by-play/gamebook receipt supports it and the visible evidence is compatible. Otherwise describe the player by team, jersey if legible, and role, and mark the name unknown. If the historical game date or official context is absent, explicitly refuse to name uncertain players rather than filling the gap from training knowledge.`;

const defaultQcPrompt = `Review this rendered vertical Short as a senior YouTube Shorts editor for upload approval.

Output JSON only (no markdown, no prose):
{
  "score": 1-10,
  "uploadReadiness": "upload-ready" | "minor revise" | "major revise" | "reject",
  "titleReadability": "strong" | "ok" | "weak",
  "titleAccuracy": "matches" | "unclear" | "wrong",
  "framing": "strong" | "ok" | "weak",
  "caitlinVisibility": "clear" | "ok" | "unclear",
  "pacing": "fast" | "ok" | "slow",
  "issues": [{"severity": "critical"|"major"|"minor", "time": "MM:SS-MM:SS", "problem": "...", "fix": "..."}],
  "publishNote": "one-sentence summary"
}`;

const prompt = `${assertion}\n\nRead @${videoFile} and complete this task:\n\n${userPrompt || defaultQcPrompt}`;

console.error(`[gemini-cli-review] Running gemini -m ${model} on @${videoFile} (cwd: ${videoDir})`);

const cliResult = spawnSync("gemini", [
  "-m", model,
  "-p", prompt,
  "--skip-trust",
  "--approval-mode", "yolo",
], {
  cwd: videoDir,
  encoding: "utf8",
  env: { ...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY },
  maxBuffer: 64 * 1024 * 1024,
});

if (cliResult.status !== 0) {
  console.error(`gemini CLI exited with code ${cliResult.status}`);
  console.error(cliResult.stderr || "");
  process.exit(cliResult.status || 1);
}

let body = (cliResult.stdout || "").trim();

// Strip YOLO/trust banner lines and Shell cwd reset lines so JSON parsing works.
body = body
  .split("\n")
  .filter((line) => !line.match(/^(YOLO mode is enabled|Approval mode overridden|Ripgrep is not available|Shell cwd was reset)/))
  .join("\n")
  .trim();

let parsed = null;
if (expectJson) {
  // Try to extract a JSON object from the response.
  const fence = body.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = fence ? fence[1] : body;
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      parsed = JSON.parse(jsonStr.slice(start, end + 1));
    } catch (e) {
      console.error(`Could not parse JSON response: ${e.message}`);
    }
  }
}

const result = parsed
  ? { ...parsed, model, video: videoPath }
  : { rawResponse: body, model, video: videoPath };

const json = JSON.stringify(result, null, 2);
if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, json);
  console.error(`Wrote ${outPath}`);
}
console.log(json);
