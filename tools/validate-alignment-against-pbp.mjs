#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node tools/validate-alignment-against-pbp.mjs --alignment FILE --official FILE --out-json FILE --out-md FILE

Validates a Gemini VO/clip alignment against official WNBA liveData play-by-play.`);
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

const alignmentPath = args.get("alignment");
const officialPath = args.get("official");
const outJson = args.get("out-json");
const outMd = args.get("out-md");
if (!alignmentPath || !officialPath || !outJson || !outMd) usage();

const alignment = JSON.parse(fs.readFileSync(alignmentPath, "utf8"));
const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const cues = alignment.alignmentCues || [];

function lower(value) {
  return String(value || "").toLowerCase();
}

function officialLine(row) {
  if (!row) return "";
  return `Q${row.period} ${row.time} | ${row.score} | ${row.eventText}`;
}

function scoreMatchesStatCue(text) {
  const box = official.clark?.game || {};
  const needs = [];
  if (/21/.test(text) || /point/.test(text)) needs.push(["pts", "21"]);
  if (/10/.test(text) || /assist/.test(text)) needs.push(["ast", "10"]);
  if (/7/.test(text) || /rebound/.test(text)) needs.push(["trb", "7"]);
  const issues = [];
  for (const [key, expected] of needs) {
    if (String(box[key]) !== expected) issues.push(`Expected Clark ${key}=${expected}, official has ${box[key] || "missing"}.`);
  }
  return { ok: issues.length === 0, issues };
}

function findRelevantEvents(cue) {
  const text = lower([
    cue.overlayLabel,
    cue.voLine,
    cue.requiredVisual,
    cue.whyThisMatches,
  ].filter(Boolean).join(" "));

  const events = [];
  const assists = official.clarkAssists || [];
  const threes = official.clarkMadeThrees || [];
  const clarkEvents = official.clarkEvents || [];
  const label = lower(cue.overlayLabel);

  const firstMitchellLayup = assists.find((row) => /K\. Mitchell running finger roll Layup/i.test(row.eventText));
  const billingsCut = assists.find((row) => /M\. Billings cutting Layup/i.test(row.eventText));
  const cunninghamAssist = assists.find((row) => /S\. Cunningham/i.test(row.eventText));
  const clarkAndOne = clarkEvents.filter((row) => row.period === "2" && (row.time === "2:49" || /17' driving floating Jump Shot|Free Throw 1 of 1/i.test(row.eventText)));

  if (/early push|gravity assist/.test(label)) {
    if (firstMitchellLayup) events.push(firstMitchellLayup);
    return events;
  }

  if (/cutting behind/.test(label)) {
    if (billingsCut) events.push(billingsCut);
    return events;
  }

  if (/running 3/.test(label) && !/second/.test(label)) {
    events.push(threes[0]);
    return events.filter(Boolean);
  }

  if (/second running 3/.test(label)) {
    events.push(threes[1]);
    return events.filter(Boolean);
  }

  if (/10th assist|controlling the game/.test(label)) {
    if (cunninghamAssist) events.push(cunninghamAssist);
    return events;
  }

  if (/and-one finish/.test(label)) {
    events.push(...clarkAndOne);
    return events;
  }

  if (/21 pts|complete game/.test(label)) {
    return [];
  }

  if (/running 3|running three|28 feet|logo|pullup|pull-up/.test(text)) {
    if (/second|colder|everybody/.test(text)) events.push(threes[1]);
    else events.push(threes[0], threes[1]);
  }

  if (/mitchell/.test(text) && /layup|gravity|early push|defense tilted|real problems/.test(text)) {
    events.push(...assists.filter((row) => /K\. Mitchell/i.test(row.eventText) && /Layup/i.test(row.eventText)));
  }

  if (/billings|cutting behind|cut behind|cuts behind|easy two/.test(text)) {
    events.push(...assists.filter((row) => /M\. Billings/i.test(row.eventText)));
  }

  if (/hull/.test(text)) {
    events.push(...assists.filter((row) => /L\. Hull/i.test(row.eventText)));
  }

  if (/hines|hines-allen/.test(text)) {
    events.push(...assists.filter((row) => /M\. Hines-Allen/i.test(row.eventText)));
  }

  if (/cunningham|10th assist|payoff/.test(text)) {
    events.push(...assists.filter((row) => /S\. Cunningham/i.test(row.eventText)));
  }

  if (/and-one|and one|finish|drive/.test(text)) {
    events.push(...clarkEvents.filter((row) => /C\. Clark/i.test(row.eventText) && /Layup|driving|free throw|foul/i.test(row.eventText)));
  }

  if (/\bfree throw\b|secures win/.test(text)) {
    events.push(...clarkEvents.filter((row) => /C\. Clark/i.test(row.eventText) && /free throw/i.test(row.eventText)));
  }

  const seen = new Set();
  return events.filter(Boolean).filter((row) => {
    const key = row.actionNumber ?? `${row.period}-${row.time}-${row.eventText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateCue(cue, index) {
  const text = lower(`${cue.overlayLabel || ""} ${cue.voLine || ""} ${cue.requiredVisual || ""}`);
  const issues = [];
  const warnings = [];
  let status = "needs-review";
  let officialEvents = findRelevantEvents(cue);

  if (cue.matchStatus === "missing_from_official_highlight") {
    return {
      cueIndex: index + 1,
      voStart: cue.voStart,
      voEnd: cue.voEnd,
      overlayLabel: cue.overlayLabel,
      status: "needs-social-clip",
      officialEvents: [],
      issues: ["Gemini marked this beat as missing from official highlight; source a social/media clip, then validate its claim against PBP if it references a play."],
      warnings,
      cueClaim: cue.voLine || "",
    };
  }

  if (/21|10 assist|7 rebound|double-double|box score/.test(text)) {
    const statCheck = scoreMatchesStatCue(text);
    if (!statCheck.ok) issues.push(...statCheck.issues);
    if (statCheck.ok && !officialEvents.length) status = "verified-stat";
  }

  if (officialEvents.length) {
    status = issues.length ? "correct-with-notes" : "verified-pbp";
  } else if (status !== "verified-stat") {
    warnings.push("No specific official PBP event matched by heuristic. Treat as conceptual analysis unless a selected clip is manually tied to an actionNumber.");
    status = issues.length ? "needs-correction" : "conceptual-needs-review";
  }

  if (/assist/.test(text) && !officialEvents.some((row) => row.assistPersonId === 1642286)) {
    warnings.push("Cue mentions assists/creation but no Clark-assisted official event was matched.");
  }

  return {
    cueIndex: index + 1,
    voStart: cue.voStart,
    voEnd: cue.voEnd,
    overlayLabel: cue.overlayLabel,
    status,
    officialEvents,
    officialEventLines: officialEvents.map(officialLine),
    issues,
    warnings,
    cueClaim: cue.voLine || "",
    sourceIn: cue.sourceIn ?? null,
    sourceOut: cue.sourceOut ?? null,
  };
}

const checks = cues.map(validateCue);
const report = {
  createdAt: new Date().toISOString(),
  alignmentPath,
  officialPath,
  sourceName: official.sourceName,
  sourceUrls: official.sources,
  clarkBox: official.clark?.game || {},
  summary: {
    cueCount: checks.length,
    verifiedPbp: checks.filter((c) => c.status === "verified-pbp").length,
    verifiedStat: checks.filter((c) => c.status === "verified-stat").length,
    conceptualNeedsReview: checks.filter((c) => c.status === "conceptual-needs-review").length,
    needsSocialClip: checks.filter((c) => c.status === "needs-social-clip").length,
    needsCorrection: checks.filter((c) => c.status === "needs-correction" || c.status === "correct-with-notes").length,
    officialClarkAssists: official.clarkAssists?.length || 0,
    officialClarkMadeThrees: official.clarkMadeThrees?.length || 0,
  },
  checks,
};

const md = [];
md.push(`# Alignment vs Official Play-by-Play Validation`);
md.push("");
md.push(`Generated: ${report.createdAt}`);
md.push(`Official source: ${report.sourceName}`);
md.push(`Box: ${report.sourceUrls?.boxUrl || ""}`);
md.push(`PBP: ${report.sourceUrls?.pbpUrl || ""}`);
md.push("");
md.push(`## Summary`);
md.push(`- Cues checked: ${report.summary.cueCount}`);
md.push(`- Verified PBP cues: ${report.summary.verifiedPbp}`);
md.push(`- Verified stat-only cues: ${report.summary.verifiedStat}`);
md.push(`- Conceptual cues needing human/source review: ${report.summary.conceptualNeedsReview}`);
md.push(`- Needs social clip: ${report.summary.needsSocialClip}`);
md.push(`- Needs correction/notes: ${report.summary.needsCorrection}`);
md.push(`- Official Clark box: ${report.clarkBox.pts} PTS, ${report.clarkBox.ast} AST, ${report.clarkBox.trb} REB, ${report.clarkBox.fg}-${report.clarkBox.fga} FG, ${report.clarkBox.fg3}-${report.clarkBox.fg3a} 3PT, ${report.clarkBox.ft}-${report.clarkBox.fta} FT`);
md.push("");
md.push(`## Cue Checks`);
for (const check of checks) {
  md.push(`### ${String(check.cueIndex).padStart(2, "0")} ${check.overlayLabel || "UNTITLED"} (${check.voStart}-${check.voEnd}s)`);
  md.push(`- Status: ${check.status}`);
  if (check.issues.length) md.push(`- Issues: ${check.issues.join(" ")}`);
  if (check.warnings.length) md.push(`- Warnings: ${check.warnings.join(" ")}`);
  if (check.officialEventLines?.length) {
    md.push(`- Official match(es):`);
    for (const line of check.officialEventLines) md.push(`  - ${line}`);
  }
  md.push(`- Cue claim: ${String(check.cueClaim).replace(/\s+/g, " ").slice(0, 350)}`);
  md.push("");
}

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outMd, `${md.join("\n")}\n`);
console.log(`json=${outJson}`);
console.log(`markdown=${outMd}`);
