#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node tools/ftl-fact-check-gemini-possessions.mjs --breakdown FILE --official FILE --out-json FILE --out-md FILE

Compares Gemini possession breakdown events against local official game context.

Example:
  node tools/ftl-fact-check-gemini-possessions.mjs \\
    --breakdown "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/possession-breakdown-gemini-selected.json" \\
    --official "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/official-game-context-wnba.json" \\
    --out-json "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/fact-check-report.json" \\
    --out-md "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/fact-check-report.md"`);
  process.exit(1);
}

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "1");
  }
}

const breakdownPath = args.get("breakdown");
const officialPath = args.get("official");
const outJson = args.get("out-json");
const outMd = args.get("out-md");
if (!breakdownPath || !officialPath || !outJson || !outMd) usage();

const breakdown = JSON.parse(fs.readFileSync(breakdownPath, "utf8"));
const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const possessions = breakdown.possessions || [];

function normPeriod(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("ot")) return "OT";
  const match = v.match(/[1-4]/);
  return match ? match[0] : String(value || "");
}

function normTime(value) {
  return String(value || "").replace(/^0:/, "").replace(/\.0$/, "").trim();
}

function parseOrdinal(label, word) {
  const match = String(label || "").match(new RegExp(`${word}\\s+([0-9]+)`, "i"));
  return match ? Number(match[1]) : null;
}

function officialSummary(row) {
  if (!row) return "";
  return `Q${row.period} ${row.time} | ${row.score} | ${row.eventText}`;
}

function comparePossession(pos) {
  const eventType = String(pos.officialVerification?.eventType || "").toLowerCase();
  let expected = null;
  let sequenceNumber = null;

  if (eventType.includes("three") || /triple/i.test(pos.label || "")) {
    sequenceNumber = parseOrdinal(pos.label, "Triple");
    if (/game-tying/i.test(pos.label || "")) sequenceNumber = 7;
    if (sequenceNumber) expected = official.clarkMadeThrees?.[sequenceNumber - 1] || null;
  } else if (eventType.includes("assist") || /assist/i.test(pos.label || "")) {
    sequenceNumber = parseOrdinal(pos.label, "Assist");
    if (sequenceNumber) expected = official.clarkAssists?.[sequenceNumber - 1] || null;
  }

  const readable = pos.readableClockScore || {};
  const issues = [];
  const corrections = [];

  if (!expected) {
    issues.push("No matching official event found by sequence/type.");
    if (eventType.includes("assist")) {
      corrections.push(`Official Clark assist count in this source is ${official.clarkAssists?.length || 0}; Gemini produced at least ${sequenceNumber || "unknown"} assist beat(s).`);
    }
    return { label: pos.label, eventType, status: "needs-review", issues, corrections, gemini: readable, official: null };
  }

  if (normPeriod(readable.quarter) && normPeriod(readable.quarter) !== expected.period) {
    issues.push(`Quarter mismatch: Gemini ${readable.quarter}, official Q${expected.period}.`);
  }
  if (readable.gameClock && normTime(readable.gameClock) !== normTime(expected.time)) {
    issues.push(`Clock mismatch: Gemini ${readable.gameClock}, official ${expected.time}.`);
  }
  if (readable.score && String(readable.score).replace(/\s+/g, " ").trim() !== expected.score) {
    issues.push(`Score mismatch: Gemini ${readable.score}, official ${expected.score}.`);
  }

  corrections.push(`Use official event: ${officialSummary(expected)}`);

  return {
    label: pos.label,
    eventType,
    status: issues.length ? "correct" : "verified",
    issues,
    corrections,
    gemini: readable,
    official: expected,
  };
}

const checks = possessions.map(comparePossession);
const report = {
  createdAt: new Date().toISOString(),
  breakdownPath,
  officialPath,
  sourceName: official.sourceName,
  sourceUrls: official.sources,
  summary: {
    possessionCount: possessions.length,
    officialMadeThrees: official.clarkMadeThrees?.length || 0,
    officialClarkAssists: official.clarkAssists?.length || 0,
    verified: checks.filter((check) => check.status === "verified").length,
    correct: checks.filter((check) => check.status === "correct").length,
    needsReview: checks.filter((check) => check.status === "needs-review").length,
  },
  clarkBox: official.clark?.game || {},
  checks,
};

const md = [];
md.push(`# Gemini Possession Fact Check`);
md.push("");
md.push(`Generated: ${report.createdAt}`);
md.push("");
md.push(`Official source: ${official.sourceName}`);
md.push(`Box: ${official.sources?.boxUrl}`);
md.push(`Play-by-play: ${official.sources?.pbpUrl}`);
md.push("");
md.push("## Summary");
md.push(`- Gemini possessions checked: ${report.summary.possessionCount}`);
md.push(`- Official Clark made threes: ${report.summary.officialMadeThrees}`);
md.push(`- Official Clark assists: ${report.summary.officialClarkAssists}`);
md.push(`- Verified as-is: ${report.summary.verified}`);
md.push(`- Needs correction: ${report.summary.correct}`);
md.push(`- Needs review/no official match: ${report.summary.needsReview}`);
md.push("");
md.push("## Clark Box");
md.push(`- ${report.clarkBox.pts} PTS, ${report.clarkBox.ast} AST, ${report.clarkBox.trb} REB, ${report.clarkBox.fg}-${report.clarkBox.fga} FG, ${report.clarkBox.fg3}-${report.clarkBox.fg3a} 3PT, ${report.clarkBox.ft}-${report.clarkBox.fta} FT, ${report.clarkBox.plus_minus} plus/minus`);
md.push("");
md.push("## Checks");
for (const check of checks) {
  md.push(`### ${check.label}`);
  md.push(`- Status: ${check.status}`);
  if (check.issues.length) md.push(`- Issues: ${check.issues.join(" ")}`);
  for (const correction of check.corrections) md.push(`- ${correction}`);
  md.push("");
}

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outMd, `${md.join("\n")}\n`);

console.log(`json=${outJson}`);
console.log(`markdown=${outMd}`);
