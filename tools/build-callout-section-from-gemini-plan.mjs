#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , sectionArg] = process.argv;

if (!sectionArg) {
  console.error("Usage: node tools/build-callout-section-from-gemini-plan.mjs P03|P04|P05");
  process.exit(1);
}

const section = sectionArg.toUpperCase();
const SSD = "/Volumes/SSK SSD";
const rootSlug = "fever-storm-2026-05-17";
const sectionSlug = `${rootSlug}-section-${section}`;
const videoDir = `${SSD}/ftl/videos/${sectionSlug}`;
const planPath = `${SSD}/ftl/videos/${rootSlug}/analysis/section-plans/gemini-pro-awful-${section}.md`;
const outPath = `${videoDir}/edit-script-johnny-v2.json`;
const sourceRoot = `${SSD}/broll/social/${rootSlug}`;

if (!fs.existsSync(planPath)) throw new Error(`Missing plan: ${planPath}`);
if (!fs.existsSync(videoDir)) throw new Error(`Missing section dir: ${videoDir}`);

function duration(filePath) {
  const out = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  return Number(out.trim());
}

function parseClock(value) {
  const clean = String(value).trim();
  if (!clean.includes(":")) return Number(clean);
  const parts = clean.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(clean);
}

function parseTimeRange(raw) {
  const value = raw.trim().replace(/^00:/, "");
  const [start, end] = value.split("-").map((item) => parseClock(item));
  return [start, end];
}

function sourcePath(filename) {
  const p = path.join(sourceRoot, filename);
  if (!fs.existsSync(p)) throw new Error(`Missing source asset: ${p}`);
  return p;
}

function titleCaseWords(text) {
  return text
    .replace(/['"]/g, "")
    .replace(/\b(CC|Clark|Caitlin Clark)\b/gi, "Clark")
    .replace(/\b(Freeze|Circle|Draw|Arrow|Highlight|Label|Showing|Shows|The|A|An|To|Of|As|And|With|On|In|For|From)\b/gi, " ")
    .replace(/[^a-z0-9+ ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calloutFor(block) {
  const preferred = block.screen && !/^none$/i.test(block.screen) ? block.screen : block.effects || block.vo || block.visual;
  let text = titleCaseWords(preferred);
  text = text
    .replace(/\bweak side\b/gi, "weak side")
    .replace(/\bwide open\b/gi, "wide open")
    .trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 6) text = words.slice(0, 6).join(" ");
  return (text || "The Read").toUpperCase();
}

function parseBlocks(markdown) {
  const chunks = markdown.split(/\n(?=###\s+\d+\.)/g).filter((chunk) => /^###\s+\d+\./.test(chunk.trim()));
  return chunks.map((chunk) => {
    const header = chunk.match(/^###\s+\d+\.\s+([^/]+)\//m);
    const relativeRange = header ? header[1].trim() : null;
    const source = chunk.match(/^- Source:\s+([^\s]+)\s+\(([^)]+)\)/m);
    const field = (name) => {
      const found = chunk.match(new RegExp(`^- ${name}:\\s+(.+)$`, "m"));
      return found ? found[1].trim() : "";
    };
    if (!relativeRange || !source) return null;
    const [start, end] = parseTimeRange(relativeRange);
    const [sourceInRaw, sourceOutRaw] = source[2].split("-").map((part) => parseClock(part));
    return {
      start,
      end,
      duration: end - start,
      vo: field("VO"),
      visual: field("Visual"),
      screen: field("Screen"),
      freeze: field("Freeze"),
      effects: field("Effects"),
      filename: source[1],
      sourceIn: sourceInRaw,
      sourceOut: Number.isFinite(sourceOutRaw) ? sourceOutRaw : sourceInRaw,
    };
  }).filter(Boolean);
}

const plan = fs.readFileSync(planPath, "utf8");
const blocks = parseBlocks(plan);
if (!blocks.length) throw new Error(`No blocks parsed from ${planPath}`);

const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
const voiceDuration = fs.existsSync(`${videoDir}/vo.mp3`) ? duration(`${videoDir}/vo.mp3`) : (existing.voiceDuration ?? blocks.at(-1).end);
const assetDurations = new Map();

function clampSource(cue) {
  const assetPath = sourcePath(cue.filename);
  if (!assetDurations.has(assetPath)) assetDurations.set(assetPath, duration(assetPath));
  const assetDuration = assetDurations.get(assetPath);
  const sourceIn = Math.max(0, Math.min(cue.sourceIn, Math.max(0, assetDuration - 0.15)));
  const maxOut = Math.max(sourceIn + 0.1, Math.min(cue.sourceOut, assetDuration));
  return { assetPath, sourceIn, sourceOut: maxOut };
}

const cues = blocks.map((block) => {
  const isFreeze = /freeze/i.test(block.visual) || (/freeze/i.test(block.freeze) && !/^none$/i.test(block.freeze));
  const { assetPath, sourceIn, sourceOut } = clampSource(block);
  const cueDuration = Math.max(0.1, block.end - block.start);
  const label = isFreeze ? calloutFor(block) : "";
  return {
    start: +block.start.toFixed(3),
    end: +Math.min(block.end, voiceDuration).toFixed(3),
    beat: block.vo || block.screen || block.visual,
    vo: block.vo || block.screen || block.visual,
    asset: block.filename,
    assetPath,
    sourceIn,
    sourceOut: isFreeze ? +(sourceIn + 0.1).toFixed(3) : sourceOut,
    audioVolume: 0,
    treatment: isFreeze
      ? "Callout-only freeze frame: no circles, arrows, lines, boxes, or distance drawings."
      : "Live or replay beat, muted under VO.",
    overlays: [],
    overlayPosition: "default",
    graphics: isFreeze ? [{
      type: "label",
      x: 50,
      y: 22,
      text: label,
      color: "#ffe000",
      startOffset: 0.15,
      duration: Math.max(0.5, cueDuration - 0.35),
    }] : [],
    freezeFrames: isFreeze ? [{
      startOffset: 0,
      duration: cueDuration,
      sourceTime: sourceIn,
      zoomFrom: 1.01,
      zoomTo: 1.06,
      x: 50,
      y: 50,
    }] : [],
    hideOverlays: true,
    editorNote: `Converted from ${section} Gemini plan as callout-only. Original effects: ${block.effects || "none"}`,
  };
}).filter((cue) => cue.end > cue.start);

cues[0].start = 0;
for (let i = 1; i < cues.length; i += 1) cues[i].start = cues[i - 1].end;
cues[cues.length - 1].end = +Math.min(voiceDuration, cues[cues.length - 1].end).toFixed(3);

if (fs.existsSync(outPath)) {
  const backupPath = outPath.replace(".json", `.pre-callouts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.copyFileSync(outPath, backupPath);
}

const edit = {
  ...existing,
  title: existing.title || `This Caitlin Clark Double Double Was SPECTACULAR - ${section}`,
  slug: rootSlug,
  voiceDuration: +voiceDuration.toFixed(3),
  editorialPhilosophy: `${section} callout-only analysis: text labels only after Section 1; no circles, arrows, lines, boxes, or distance drawings.`,
  sourceAssets: Object.fromEntries([...new Set(cues.map((cue) => cue.assetPath))].map((assetPath, i) => [`asset${i + 1}`, assetPath])),
  cues,
};

fs.writeFileSync(outPath, `${JSON.stringify(edit, null, 2)}\n`);
console.log(JSON.stringify({ section, outPath, cues: cues.length, labels: cues.reduce((n, cue) => n + cue.graphics.length, 0) }, null, 2));
