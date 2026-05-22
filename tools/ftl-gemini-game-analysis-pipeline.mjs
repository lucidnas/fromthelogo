#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-gemini-game-analysis-pipeline.mjs --slug SLUG --title TITLE [options]

Runs the deterministic FTL game-analysis chain:
  optional source refresh -> Gemini clip-pool selection -> Gemini possession breakdown -> optional official context/fact-check

Options:
  --match-any TERMS       Required only with --source. Comma-separated Nitter timeline terms.
  --source                Run tools/ftl-source-game-clips.mjs before Gemini analysis.
  --account ACCOUNT       Account for sourcing. Repeatable. Default inside source script: IndianaFever.
  --url URL               Seed URL for sourcing. Repeatable.
  --source-file FILE      Extra source URL file for sourcing.
  --max-candidates N      Gemini selection upload cap. Default: 18.
  --include-long          Let selector include long highlight packages/full-game clips.
  --score-context FILE    Official score/play-by-play context to include in Gemini prompts.
  --selection-model MODEL Gemini clip-selection model.
  --breakdown-model MODEL Gemini possession-breakdown model. Default: gemini-3.1-pro-preview.
  --reuse-existing        Skip selection/breakdown steps whose output files already exist.
  --wnba-game-id ID       Pull WNBA liveData official context and fact-check breakdown.
  --bref-id ID            Pull Basketball-Reference context and fact-check breakdown.

Outputs:
  /Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-selection.json
  /Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-selected-clips-manifest.json
  /Volumes/SSK SSD/ftl/videos/{slug}/analysis/possession-breakdown-gemini-selected.json
  /Volumes/SSK SSD/ftl/videos/{slug}/analysis/official-game-context.json
  /Volumes/SSK SSD/ftl/videos/{slug}/analysis/fact-check-report.md

Example:
  node tools/ftl-gemini-game-analysis-pipeline.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --title "This Caitlin Clark Fourth Quarter Was UNREAL" \\
    --max-candidates 18`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    accounts: [],
    urls: [],
    source: false,
    maxCandidates: "18",
    breakdownModel: "gemini-3.1-pro-preview",
    includeLong: false,
    reuseExisting: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") args.slug = next();
    else if (arg === "--title") args.title = next();
    else if (arg === "--match-any") args.matchAny = next();
    else if (arg === "--source") args.source = true;
    else if (arg === "--account") args.accounts.push(next());
    else if (arg === "--url") args.urls.push(next());
    else if (arg === "--source-file") args.sourceFile = next();
    else if (arg === "--max-candidates") args.maxCandidates = next();
    else if (arg === "--include-long") args.includeLong = true;
    else if (arg === "--score-context") args.scoreContext = next();
    else if (arg === "--selection-model") args.selectionModel = next();
    else if (arg === "--breakdown-model") args.breakdownModel = next();
    else if (arg === "--reuse-existing") args.reuseExisting = true;
    else if (arg === "--wnba-game-id") args.wnbaGameId = next();
    else if (arg === "--bref-id") args.brefId = next();
    else usage();
  }

  if (!args.slug || !args.title) usage();
  if (args.source && !args.matchAny) throw new Error("--match-any is required when --source is set");
  return args;
}

function run(command, commandArgs) {
  console.log(`\n$ ${command} ${commandArgs.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`);
  const proc = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (proc.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit ${proc.status}`);
  }
}

function fileReady(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10;
}

const args = parseArgs(process.argv.slice(2));
const analysisDir = `/Volumes/SSK SSD/ftl/videos/${args.slug}/analysis`;
const selectionPath = path.join(analysisDir, "gemini-clip-selection.json");
const manifestPath = path.join(analysisDir, "gemini-selected-clips-manifest.json");
const breakdownPath = path.join(analysisDir, "possession-breakdown-gemini-selected.json");
const officialPath = path.join(analysisDir, "official-game-context.json");
const officialMdPath = path.join(analysisDir, "official-game-context.md");
const factCheckPath = path.join(analysisDir, "fact-check-report.json");
const factCheckMdPath = path.join(analysisDir, "fact-check-report.md");

fs.mkdirSync(analysisDir, { recursive: true });

if (args.source) {
  const sourceArgs = [
    "tools/ftl-source-game-clips.mjs",
    "--slug", args.slug,
    "--match-any", args.matchAny,
  ];
  for (const account of args.accounts) sourceArgs.push("--account", account);
  for (const url of args.urls) sourceArgs.push("--url", url);
  if (args.sourceFile) sourceArgs.push("--source-file", args.sourceFile);
  run("node", sourceArgs);
}

if (args.reuseExisting && fileReady(selectionPath) && fileReady(manifestPath)) {
  console.log(`Reusing Gemini selection outputs:
selection=${selectionPath}
manifest=${manifestPath}`);
} else {
  const selectArgs = [
    "tools/gemini-clip-pool-select.mjs",
    "--slug", args.slug,
    "--title", args.title,
    "--max-candidates", args.maxCandidates,
    "--out", selectionPath,
    "--manifest-out", manifestPath,
  ];
  if (args.includeLong) selectArgs.push("--include-long");
  if (args.scoreContext) selectArgs.push("--score-context", args.scoreContext);
  if (args.selectionModel) selectArgs.push("--model", args.selectionModel);
  run("node", selectArgs);
}

if (args.reuseExisting && fileReady(breakdownPath)) {
  console.log(`Reusing possession breakdown:
breakdown=${breakdownPath}`);
} else {
  const breakdownArgs = [
    "tools/gemini-possession-breakdown.mjs",
    "--title", args.title,
    "--clips", manifestPath,
    "--out", breakdownPath,
    "--model", args.breakdownModel,
  ];
  if (args.scoreContext) breakdownArgs.push("--score-context", args.scoreContext);
  run("node", breakdownArgs);
}

if (args.wnbaGameId || args.brefId) {
  if (args.reuseExisting && fileReady(officialPath)) {
    console.log(`Reusing official context:
official=${officialPath}`);
  } else {
    const officialArgs = [
      "tools/ftl-fetch-game-official-context.mjs",
      "--slug", args.slug,
      "--out-json", officialPath,
      "--out-md", officialMdPath,
    ];
    if (args.wnbaGameId) officialArgs.push("--wnba-game-id", args.wnbaGameId);
    else officialArgs.push("--bref-id", args.brefId);
    run("node", officialArgs);
  }

  if (args.reuseExisting && fileReady(factCheckPath)) {
    console.log(`Reusing fact-check report:
factCheck=${factCheckPath}`);
  } else {
    run("node", [
      "tools/ftl-fact-check-gemini-possessions.mjs",
      "--breakdown", breakdownPath,
      "--official", officialPath,
      "--out-json", factCheckPath,
      "--out-md", factCheckMdPath,
    ]);
  }
}

console.log(`\nDone.
selection=${selectionPath}
manifest=${manifestPath}
breakdown=${breakdownPath}
official=${fileReady(officialPath) ? officialPath : ""}
factCheck=${fileReady(factCheckMdPath) ? factCheckMdPath : ""}`);
