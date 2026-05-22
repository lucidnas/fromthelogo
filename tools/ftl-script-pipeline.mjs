#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";
const TRANSCRIPTS = "/Users/abdul/transcripts";

function usage() {
  console.error(`Usage:
  node tools/ftl-script-pipeline.mjs --slug SLUG --title TITLE --research PATH --clips PATH [options]

Options:
  --out PATH              Script output path. Default: ~/transcripts/script-SLUG.txt
  --generate              Generate a draft with Gemini from research + clip manifest
  --validate              Validate an existing script without generating
  --model MODEL           Gemini model for draft generation. Default: gemini-3.1-pro-preview
  --min-words N           Default: 1200
  --max-words N           Default: 1400
  --skip-roast            Skip RoastMyVideo scoring
  --skip-fact-check       Skip Codex fact-check
  --report PATH           Report output path. Default: /Volumes/SSK SSD/ftl/videos/SLUG/script/script-report.json

Examples:
  node tools/ftl-script-pipeline.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --title "This Caitlin Clark Fourth Quarter Was UNREAL" \\
    --research research/celebration-ideas/2026-05-16-fever-mystics-clark-fourth-quarter.md \\
    --clips "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/clips/caitlin-selects-manifest.json" \\
    --generate

  node tools/ftl-script-pipeline.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --title "This Caitlin Clark Fourth Quarter Was UNREAL" \\
    --research research/celebration-ideas/2026-05-16-fever-mystics-clark-fourth-quarter.md \\
    --clips "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/clips/caitlin-selects-manifest.json" \\
    --out /Users/abdul/transcripts/script-fever-mystics-2026-05-15-unreal.txt \\
    --validate`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    generate: false,
    validate: false,
    model: "gemini-3.1-pro-preview",
    minWords: 1200,
    maxWords: 1400,
    roast: true,
    factCheck: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") args.slug = next();
    else if (arg === "--title") args.title = next();
    else if (arg === "--research") args.research = next();
    else if (arg === "--clips") args.clips = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--report") args.report = next();
    else if (arg === "--model") args.model = next();
    else if (arg === "--min-words") args.minWords = Number(next());
    else if (arg === "--max-words") args.maxWords = Number(next());
    else if (arg === "--generate") args.generate = true;
    else if (arg === "--validate") args.validate = true;
    else if (arg === "--skip-roast") args.roast = false;
    else if (arg === "--skip-fact-check") args.factCheck = false;
    else usage();
  }
  if (!args.slug || !args.title || !args.research || !args.clips) usage();
  if (!args.generate && !args.validate) args.validate = true;
  args.out ||= path.join(TRANSCRIPTS, `script-${args.slug}.txt`);
  args.report ||= `/Volumes/SSK SSD/ftl/videos/${args.slug}/script/script-report.json`;
  return args;
}

function resolvePath(filePath) {
  if (filePath.startsWith("~")) return path.join(process.env.HOME, filePath.slice(1));
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(REPO, filePath);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function run(cmd, args, options = {}) {
  const proc = spawnSync(cmd, args, {
    cwd: options.cwd ?? REPO,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (proc.status !== 0) {
    const rendered = `${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`;
    throw new Error(`${rendered}\n${proc.stderr || proc.stdout}`);
  }
  return proc.stdout;
}

function read(filePath) {
  const resolved = resolvePath(filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Missing file: ${resolved}`);
  return fs.readFileSync(resolved, "utf8");
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripCodeFence(text) {
  return text.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractVoiceProfile() {
  const voicePath = path.join(REPO, "src/lib/voice-profile.ts");
  if (!fs.existsSync(voicePath)) return "";
  return fs.readFileSync(voicePath, "utf8");
}

function loadDoctrine() {
  return {
    scriptRules: read("research/script-writing-rules.md"),
    hooks: read("research/hooks-library.md"),
    celebration: read("research/celebration-format-playbook.md"),
    hyperframes: read("research/hyperframes-video-process.md"),
    voice: extractVoiceProfile(),
  };
}

function buildDraftPrompt({ title, researchText, clipsText, doctrine, minWords, maxWords }) {
  return `You are writing a From The Logo Caitlin Clark Celebration script.

TITLE:
${title}

MANDATORY FORMAT:
- Clark Celebration / Awe-Spectacle.
- Target ${minWords}-${maxWords} words.
- Cold open must use the hooks library Template 1 style: play-first, no greeting.
- Do not write markdown headers, labels, stage directions, or bracketed notes.
- VO must be continuous spoken narration only.
- Visuals are central. Write around the available Caitlin clips.
- Use first-person sparingly for real reactions.
- Include one direct CTA near the end.
- End exactly with: New videos every week on From The Logo. See you next time.
- Avoid documentary tone.
- Avoid saying "clip", "sequence", "segment", "visual", "asset", or "B-roll" in the VO.
- Do not fabricate facts. Use only the research and clip manifest.

RESEARCH:
${researchText}

CLIP MANIFEST:
${clipsText}

SCRIPT RULES:
${doctrine.scriptRules}

HOOKS LIBRARY:
${doctrine.hooks}

CELEBRATION PLAYBOOK:
${doctrine.celebration}

VOICE PROFILE:
${doctrine.voice}

Write the final VO script only.`;
}

async function generateDraft(args, context) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for --generate");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildDraftPrompt(context);
  const result = await ai.models.generateContent({
    model: args.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.45,
      topP: 0.85,
    },
  });
  const script = stripCodeFence(result.text);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${script.trim()}\n`);
  return script;
}

function staticChecks(script, args) {
  const count = wordCount(script);
  const avoidTerms = ["clip", "sequence", "segment", "visual", "asset", "B-roll"];
  const lower = script.toLowerCase();
  const foundAvoidTerms = avoidTerms.filter((term) => lower.includes(term.toLowerCase()));
  const checks = [
    { name: "word_count_min", pass: count >= args.minWords, value: count, expected: `>= ${args.minWords}` },
    { name: "word_count_max", pass: count <= args.maxWords, value: count, expected: `<= ${args.maxWords}` },
    { name: "no_greeting", pass: !/^\s*(what'?s up|welcome back|today we'?re)/i.test(script), value: script.split(/\r?\n/)[0] },
    { name: "mentions_caitlin_clark", pass: /Caitlin Clark/.test(script), value: /Caitlin Clark/.test(script) },
    { name: "has_required_signoff", pass: script.trim().endsWith("New videos every week on From The Logo. See you next time."), value: script.trim().split(/\r?\n/).slice(-1)[0] },
    { name: "avoid_terms_in_vo", pass: foundAvoidTerms.length === 0, value: foundAvoidTerms },
    { name: "one_direct_subscribe_cta_max", pass: (script.match(/subscribe/gi) ?? []).length <= 1, value: (script.match(/subscribe/gi) ?? []).length },
  ];
  return { wordCount: count, checks };
}

function runRoast(script) {
  const roastDir = path.join(process.env.HOME, "code/roastmyvideo");
  const code = `
import { analyzeScript } from './src/utils/gemini';
const result = await analyzeScript(process.env.SCRIPT, 'professional');
console.log(JSON.stringify(result, null, 2));
`;
  const output = run("bun", ["-e", code], { cwd: roastDir, env: { SCRIPT: script } });
  return JSON.parse(output);
}

function runFactCheck(args) {
  const prompt = `Fact-check this From The Logo script against public recaps/box scores and the provided research file. Focus only on factual claims, unsupported player/action descriptions, final score, injuries, stats, timestamps, and whether any claim needs correction. Return concise pass/fail findings and suggested corrections.

Title: ${args.title}
Research path: ${resolvePath(args.research)}
Clip manifest path: ${resolvePath(args.clips)}
Script path: ${args.out}`;
  return run("codex", ["exec", "-c", 'sandbox_permissions=["disk-full-read-access"]', prompt], {
    cwd: REPO,
  });
}

function passGate(report) {
  if (report.static.checks.some((check) => !check.pass)) return false;
  if (report.roast && !["strong", "fire"].includes(report.roast.overallSentiment)) return false;
  if (report.factCheck && !/\bPASS\b/i.test(report.factCheck)) return false;
  return true;
}

async function main() {
  loadEnvFile(path.join(REPO, ".env"));
  loadEnvFile(path.join(REPO, ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  args.research = resolvePath(args.research);
  args.clips = resolvePath(args.clips);
  args.out = resolvePath(args.out);
  args.report = resolvePath(args.report);

  const doctrine = loadDoctrine();
  const researchText = read(args.research);
  const clipsText = read(args.clips);

  let script = "";
  if (args.generate) {
    script = await generateDraft(args, {
      title: args.title,
      researchText,
      clipsText,
      doctrine,
      minWords: args.minWords,
      maxWords: args.maxWords,
    });
  } else {
    script = read(args.out);
  }

  const report = {
    slug: args.slug,
    title: args.title,
    scriptPath: args.out,
    researchPath: args.research,
    clipsPath: args.clips,
    static: staticChecks(script, args),
    roast: null,
    factCheck: null,
    passed: false,
  };

  if (args.roast) {
    console.log("Running RoastMyVideo script analysis...");
    report.roast = await runRoast(script);
  }

  if (args.factCheck) {
    console.log("Running Codex fact-check...");
    report.factCheck = runFactCheck(args);
  }

  report.passed = passGate(report);
  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.writeFileSync(args.report, JSON.stringify(report, null, 2) + "\n");

  console.log(JSON.stringify({
    passed: report.passed,
    scriptPath: report.scriptPath,
    reportPath: args.report,
    wordCount: report.static.wordCount,
    staticFailed: report.static.checks.filter((check) => !check.pass).map((check) => check.name),
    overallSentiment: report.roast?.overallSentiment ?? null,
  }, null, 2));

  if (!report.passed) process.exit(2);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
