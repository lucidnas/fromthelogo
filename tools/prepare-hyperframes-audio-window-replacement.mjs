#!/usr/bin/env node

/**
 * Generate a minimal HyperFrames project that preserves an approved master
 * picture while replacing one bounded narration window. The generated project
 * is production data; this reusable implementation remains in Git.
 */

import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parse(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i] ?? fail(`${token} requires a value`);
    if (token === "--master") args.master = path.resolve(next());
    else if (token === "--replacement") args.replacement = path.resolve(next());
    else if (token === "--replacement-script") args.replacementScript = path.resolve(next());
    else if (token === "--edl-source") args.edlSource = path.resolve(next());
    else if (token === "--out-dir") args.outDir = path.resolve(next());
    else if (token === "--duration") args.duration = Number(next());
    else if (token === "--window-in") args.windowIn = Number(next());
    else if (token === "--window-out") args.windowOut = Number(next());
    else if (token === "--replacement-duration") args.replacementDuration = Number(next());
    else if (token === "--composition-id") args.compositionId = next();
    else fail(`unknown argument ${token}`);
  }
  for (const key of ["master", "replacement", "outDir", "duration", "windowIn", "windowOut", "replacementDuration"]) {
    if (args[key] === undefined) fail(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)} is required`);
  }
  if (!fs.existsSync(args.master)) fail(`master does not exist: ${args.master}`);
  if (!fs.existsSync(args.replacement)) fail(`replacement does not exist: ${args.replacement}`);
  if (args.replacementScript && !fs.existsSync(args.replacementScript)) fail(`replacement script does not exist: ${args.replacementScript}`);
  if (args.edlSource && !fs.existsSync(args.edlSource)) fail(`EDL source does not exist: ${args.edlSource}`);
  if (!(args.windowIn >= 0 && args.windowOut > args.windowIn && args.duration >= args.windowOut)) fail("invalid timing window");
  if (!(args.replacementDuration > 0 && args.replacementDuration <= args.windowOut - args.windowIn)) fail("replacement audio must fit inside the replacement window");
  args.compositionId ??= "audio-window-replacement";
  return args;
}

function link(target, destination) {
  fs.rmSync(destination, { force: true });
  fs.symlinkSync(target, destination);
}

const args = parse(process.argv.slice(2));
const assets = path.join(args.outDir, "assets");
fs.mkdirSync(assets, { recursive: true });
link(args.master, path.join(assets, "master.mp4"));
link(args.replacement, path.join(assets, "replacement.mp3"));

const tailDuration = args.duration - args.windowOut;
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
      video { position: absolute; inset: 0; width: 1920px; height: 1080px; object-fit: cover; background: #000; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${args.compositionId}" data-no-timeline data-start="0" data-duration="${args.duration}" data-width="1920" data-height="1080">
      <video id="approved-picture" class="clip" src="assets/master.mp4" muted preload="auto"
        data-start="0" data-duration="${args.duration}" data-media-start="0" data-track-index="1"></video>
      <audio id="approved-opening-audio" class="clip" src="assets/master.mp4" preload="auto"
        data-start="0" data-duration="${args.windowIn}" data-media-start="0" data-track-index="10"></audio>
      <audio id="replacement-narration" class="clip" src="assets/replacement.mp3" preload="auto"
        data-start="${args.windowIn}" data-duration="${args.replacementDuration}" data-media-start="0" data-track-index="10"></audio>
      <audio id="approved-tail-audio" class="clip" src="assets/master.mp4" preload="auto"
        data-start="${args.windowOut}" data-duration="${tailDuration}" data-media-start="${args.windowOut}" data-track-index="10"></audio>
    </div>
  </body>
</html>
`;

const config = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  media: { autoProxy: true },
  authoringSkill: "general-video",
};

const packageJson = {
  name: "hyperframes-audio-window-replacement",
  private: true,
  type: "module",
  scripts: {
    check: "npx --yes hyperframes@0.8.11 check",
    render: "npx --yes hyperframes@0.8.11 render",
  },
};

fs.writeFileSync(path.join(args.outDir, "index.html"), html);
fs.writeFileSync(path.join(args.outDir, "hyperframes.json"), `${JSON.stringify(config, null, 2)}\n`);
fs.writeFileSync(path.join(args.outDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

if (args.edlSource) {
  const sourceEdl = JSON.parse(fs.readFileSync(args.edlSource, "utf8"));
  const originalOpening = structuredClone(sourceEdl.beats[0]);
  originalOpening.id = "B01";
  originalOpening.program.out = args.windowIn;
  originalOpening.narration = `Preserve the approved opening and original audio through ${args.windowIn.toFixed(3)} seconds.`;
  originalOpening.source.out = args.windowIn;
  originalOpening.treatment.playback = [{ in: 0, out: args.windowIn, speed: 1 }];
  originalOpening.pictureOperations = [{
    ...originalOpening.pictureOperations[0],
    id: "B01-P01",
    programRelative: { in: 0, out: args.windowIn },
    source: { in: 0, out: args.windowIn },
    visibleDetail: "Exact approved opening picture and sound through Minute 1.",
  }];
  originalOpening.audio = { vo: "preserve approved master", source: "preserve approved mix", music: "none", ambience: "none", effects: [] };

  const replacementNarration = args.replacementScript
    ? fs.readFileSync(args.replacementScript, "utf8").trim()
    : "Replacement narration";
  const replacementBeat = {
    id: "B02",
    program: { in: args.windowIn, out: args.windowOut },
    editorialRole: "claim-evidence",
    narration: replacementNarration,
    visualOnly: false,
    source: { asset: "approved-master", path: args.master, in: args.windowIn, out: args.windowOut },
    visibleAction: "Seven previously possession-validated Caitlin Clark plays remain in the approved picture while four concise claims introduce and connect their evidence.",
    caitlinRole: "Primary creator whose scoring gravity and passing reads generate the demonstrated advantages.",
    purpose: "Begin the claim-to-play rhythm immediately after Minute 1 without changing approved picture.",
    treatment: {
      playback: [{ in: args.windowIn, out: args.windowOut, speed: 1 }],
      holds: ["Preserve all approved picture treatments already baked into the master"],
      cropPan: "Preserve approved framing",
      color: "Preserve approved grade",
      graphics: [], captions: [], transitionOut: "cut",
    },
    pictureOperations: [{
      id: "B02-P01",
      programRelative: { in: 0, out: args.windowOut - args.windowIn },
      source: { in: args.windowIn, out: args.windowOut },
      speed: 1,
      kind: "claim-evidence-sequence",
      visibleDetail: "Approved Minute 2 possession sequence; no picture substitution or reordering.",
      approval: "APPROVED",
      evidence: [args.master],
    }],
    audio: {
      vo: `${path.basename(args.replacement)} 0.000-${args.replacementDuration.toFixed(3)}`,
      source: "mute",
      music: "none",
      ambience: "none",
      effects: [],
    },
    truthEvidence: sourceEdl.truthGate?.evidence?.length
      ? sourceEdl.truthGate.evidence
      : originalOpening.truthEvidence,
    qcChecks: ["Each claim precedes its evidence", "All seven approved possessions remain visible", "No original narration remains in the replacement window"],
  };
  const tailBeats = sourceEdl.beats.slice(1).map((beat, index) => ({ ...beat, id: `B${String(index + 3).padStart(2, "0")}` }));
  const edl = {
    ...sourceEdl,
    project: `${args.compositionId}`,
    revision: Number(sourceEdl.revision ?? 1) + 1,
    status: "truth-approved",
    scriptPath: args.replacementScript ?? sourceEdl.scriptPath,
    updatedAt: new Date().toISOString(),
    beats: [originalOpening, replacementBeat, ...tailBeats],
    changeLog: [...(sourceEdl.changeLog ?? []), {
      revision: Number(sourceEdl.revision ?? 1) + 1,
      change: `Preserved opening through ${args.windowIn}s and introduced claim-evidence narration immediately afterward.`,
    }],
  };
  fs.writeFileSync(path.join(args.outDir, "edl.json"), `${JSON.stringify(edl, null, 2)}\n`);
}
console.log(JSON.stringify({ project: args.outDir, ...args }, null, 2));
