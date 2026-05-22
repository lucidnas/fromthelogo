#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , slugArg] = process.argv;
const slug = slugArg || "fever-mystics-2026-05-15";
const SSD = "/Volumes/SSK SSD";
const videoDir = `${SSD}/ftl/videos/${slug}`;
const manifestPath = `${videoDir}/clips/caitlin-selects-manifest.json`;
const voPath = `${videoDir}/vo.mp3`;
const outPath = `${videoDir}/edit-script-johnny-v2.json`;
const cleanMovingOnly = process.env.FTL_CLEAN_MOVING_ONLY === "1";

if (!fs.existsSync(manifestPath)) throw new Error(`Missing clip manifest: ${manifestPath}`);
if (!fs.existsSync(voPath)) throw new Error(`Missing VO: ${voPath}`);

function duration(filePath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  return Number(out.trim());
}

const voiceDuration = duration(voPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const byLabel = new Map((manifest.clips || []).map((clip) => [clip.label, clip]));

function clip(label) {
  const found = byLabel.get(label);
  if (!found) throw new Error(`Missing clip label: ${label}`);
  return found;
}

const C = {
  gameTying: "Clark_GameTying_3_Sequence",
  screen3: "Clark_Screen_3",
  stepback: "Clark_Stepback_3",
  assistHines: "Clark_Assist_Hines-Allen_Layup",
  goAhead: "Clark_GoAhead_3",
  noLook: "Clark_NoLook_Assist_Mitchell",
  late3: "Clark_Deep_3_LateQ",
  assistCunningham: "Clark_Assist_Cunningham_3",
  mitchellJumper: "Clark_Assist_Mitchell_Jumper",
  otReaction: "OT_Missed_BuzzerBeater_Reaction",
  otAssist: "Clark_Assist_Mitchell_OT",
  otReverse: "Clark_ReverseLayup_OT",
  otHull: "Clark_Assist_Hull_3_OT",
  loss: "Fever_Loss_Reaction_OT",
};

const beats = [
  [0, 7, C.gameTying, "Run the 1.7-second shot once", ["1.7 SECONDS", "EVERYBODY KNOWS"], "scorebug-cover", "live", 0],
  [7, 18, C.gameTying, "Freeze the catch and show the tiny gap", ["FREEZE IT", "THE GAP"], "default", "freeze", 1.1],
  [18, 30, C.gameTying, "Hold the release window", ["TINY GAP", "STILL TOO LATE"], "default", "freeze", 2.4],
  [30, 42, C.gameTying, "Hold the made-shot payoff", ["TIE GAME", "UNREAL"], "default", "freeze", 4.3],

  [42, 48, C.screen3, "Run the first fourth-quarter warning", ["UP 11", "FIRST WARNING"], "scorebug-cover", "live", 0],
  [48, 61, C.screen3, "Freeze Clark before the screen contact", ["START ACTION", "DEFENSE LEANS"], "default", "freeze", 1.0],
  [61, 73, C.screen3, "Freeze the clean shot window", ["CLEAN WINDOW", "BANG"], "default", "freeze", 3.0],
  [73, 85, C.screen3, "Freeze the spacing effect", ["FLOOR GETS BIGGER"], "default", "freeze", 1.8],

  [85, 91, C.assistCunningham, "Run the first assist receipt", ["PASS FIRST", "CORNER READY"], "scorebug-cover", "live", 0],
  [91, 103, C.assistCunningham, "Freeze the help decision", ["HELP FREEZES", "CLARK SEES IT"], "default", "freeze", 1.5],
  [103, 115, C.assistCunningham, "Freeze the pass lane", ["ONE READ AHEAD", "OPEN THREE"], "default", "freeze", 3.0],
  [115, 121, C.goAhead, "Run the go-ahead three setup", ["SAME PROBLEM", "DIFFERENT SIDE"], "scorebug-cover", "live", 0],
  [121, 133, C.goAhead, "Freeze the screen coverage", ["RESPECT THE SCREEN", "NO GOOD OPTION"], "default", "freeze", 1.2],
  [133, 145, C.goAhead, "Freeze the hesitation she punishes", ["PUNISHES HESITATION"], "default", "freeze", 2.6],
  [145, 157, C.assistHines, "Run the help-and-cut assist", ["CAN'T SELL OUT", "HELP LEANS"], "default", "live", 0],
  [157, 169, C.assistHines, "Freeze the cutter opening", ["ONE STEP TOO FAR", "CUTTER OPEN"], "default", "freeze", 1.8],
  [169, 175, C.assistHines, "Freeze the easy layup result", ["THE READ", "EASY LAYUP"], "default", "freeze", 3.4],

  [175, 181, C.stepback, "Run the stepback three once", ["BACK TO THREE", "SHOT CLOCK LOW"], "scorebug-cover", "live", 0],
  [181, 194, C.stepback, "Freeze the stepback window", ["STEPBACK WINDOW", "LEANING DEFENDER"], "default", "freeze", 1.5],
  [194, 207, C.stepback, "Freeze the release", ["SPLASH", "NOT A BAD SHOT"], "default", "freeze", 3.0],
  [207, 213, C.noLook, "Run the no-look assist once", ["GRAVITY", "COUNT THE EYES"], "default", "live", 0],
  [213, 226, C.noLook, "Freeze the drive sell", ["SELLS DRIVE", "PULLS HELP"], "default", "freeze", 1.5],
  [226, 239, C.noLook, "Freeze the pass timing", ["RIGHT ON TIME", "EASY BUCKET"], "default", "freeze", 3.0],
  [239, 251, C.noLook, "Freeze the simple fast mean read", ["SIMPLE", "FAST", "MEAN"], "default", "freeze", 4.4],
  [251, 266, C.mitchellJumper, "Use the jumper assist as the extra proof", ["MIDRANGE PUNISH", "SAME GRAVITY"], "default", "freeze", 2.2],

  [266, 272, C.goAhead, "Run the go-ahead three again only as setup", ["GO-AHEAD THREE", "CONTROLLED SPEED"], "scorebug-cover", "live", 0],
  [272, 286, C.goAhead, "Freeze Clark's feet before the rise", ["WATCH HER FEET", "THE POCKET"], "default", "freeze", 1.3],
  [286, 300, C.goAhead, "Freeze the release window", ["RELEASE WINDOW", "CONTEST LATE"], "default", "freeze", 2.7],
  [300, 311, C.noLook, "Freeze Clark gravity pulling help", ["INDIANA LEADS", "BANG"], "default", "freeze", 1.6],
  [311, 317, C.late3, "Run the late deficit three once", ["DOWN SEVEN", "MATH CHANGES"], "scorebug-cover", "live", 0],
  [317, 330, C.late3, "Freeze the trailing defender", ["DEFENDER BEHIND", "HELP LOW"], "default", "freeze", 1.6],
  [330, 343, C.late3, "Freeze the live-three window", ["NOT ENOUGH", "THREE IS ALIVE"], "default", "freeze", 3.0],
  [343, 356, C.late3, "Freeze why the lead never feels safe", ["LEAD NEVER SAFE"], "default", "freeze", 1.8],

  [356, 362, C.gameTying, "Return to final shot, quick live reset", ["BACK TO 1.7", "NO MYSTERY"], "scorebug-cover", "live", 0],
  [362, 376, C.gameTying, "Freeze the handoff choice", ["HANDOFF", "STEPBACK", "PASS"], "default", "freeze", 0.9],
  [376, 390, C.gameTying, "Freeze the ball going to Clark", ["THE BALL IS GOING TO 22"], "default", "freeze", 1.7],
  [390, 404, C.gameTying, "Freeze how she still gets it off", ["STILL GETS IT OFF"], "default", "freeze", 2.8],
  [404, 418, C.gameTying, "Freeze the clean-enough window", ["FREEZE IT", "CLEAN ENOUGH"], "default", "freeze", 3.2],
  [418, 432, C.gameTying, "Freeze one tiny window", ["ONE TINY WINDOW"], "default", "freeze", 3.7],
  [432, 446, C.gameTying, "Freeze the three-point result", ["THREE POINTS"], "default", "freeze", 4.6],

  [446, 452, C.otReaction, "Quick loss context only", ["WASHINGTON SURVIVED OT"], "scorebug-cover", "live", 0],
  [452, 464, C.loss, "Hold the reaction, frame the bigger point", ["LOSS STILL MATTERS"], "default", "freeze", 1.5],
  [464, 476, C.otReaction, "Freeze the broadcast stat-line value", ["32 PTS", "8 AST", "7 THREES"], "scorebug-cover", "freeze", 2.2],
  [476, 488, C.otAssist, "Freeze the OT assist proof", ["OT READ", "STILL CREATING"], "default", "freeze", 2.8],
  [488, 500, C.otReverse, "Freeze the reverse-layup pressure", ["RIM PRESSURE", "TOUGH FINISH"], "default", "freeze", 2.7],
  [500, 512, C.otHull, "Freeze the Hull three assist", ["HELP LATE", "CORNER OPEN"], "default", "freeze", 4.5],
  [512, 524, C.late3, "Freeze the chase-over problem", ["CHASE OVER", "SHE TURNS"], "default", "freeze", 2.8],
  [524, 536, C.gameTying, "Freeze the defense knowing and still losing", ["THEY KNEW"], "default", "freeze", 1.9],
  [536, voiceDuration, C.gameTying, "Final title callback freeze", ["COULD NOT TAKE IT AWAY", "UNREAL"], "default", "freeze", 4.3],
];

function graphicSet(kind) {
  const yellow = "#FFE84D";
  if (kind === "live") {
    return [];
  }
  if (kind === "final") {
    return [
      { type: "ring", startOffset: 0.15, duration: 7.5, x: 60, y: 47, w: 9, h: 16, color: yellow },
    ];
  }
  return [
    { type: "ring", startOffset: 0.15, duration: 7.5, x: 57, y: 50, w: 10, h: 16, color: yellow },
  ];
}

function freezeSet(dur, label) {
  if (dur < 8) return [];
  return [
    {
      startOffset: Math.min(2.2, Math.max(0.8, dur * 0.25)),
      duration: Math.min(2.0, Math.max(1.1, dur * 0.18)),
      sourceTime: 1.2,
      zoomFrom: 1.03,
      zoomTo: 1.12,
      x: 56,
      y: 48,
      label: label.toUpperCase().slice(0, 26),
    },
  ];
}

const cues = beats.map(([start, endRaw, label, beat, overlays, overlayPosition, backgroundMode, holdFrameTime]) => {
  const end = Math.min(Number(endRaw), voiceDuration);
  const source = clip(label);
  const dur = end - start;
  const isFreeze = !cleanMovingOnly && backgroundMode === "freeze";
  return {
    start: +Number(start).toFixed(3),
    end: +end.toFixed(3),
    beat,
    vo: beat,
    asset: path.basename(source.clipPath),
    assetPath: source.clipPath,
    sourceIn: 0,
    sourceOut: cleanMovingOnly
      ? null
      : isFreeze
        ? Math.min(Number(source.durationSecs || 6), Math.max(0.1, Number(holdFrameTime ?? 1.2) + 0.1))
        : Math.min(Number(source.durationSecs || 6), Math.max(3, Math.min(dur, 6))),
    audioVolume: 0,
    backgroundMode: isFreeze ? "freeze" : "live",
    holdFrameTime: isFreeze ? Number(holdFrameTime ?? 1.2) : null,
    treatment: cleanMovingOnly
      ? "Clean moving-video pass: no freeze frames, no rings, no circles, no arrows, no text overlays. Muted source audio."
      : isFreeze
      ? "Awful-style film-room analysis hold: frozen game frame, minimal nonverbal ring only. Muted source audio."
      : "Awful-style film-room live setup: play the moment once, then move to freeze-frame analysis. Muted source audio.",
    overlays: [],
    overlayPosition: overlayPosition || "default",
    graphics: cleanMovingOnly ? [] : graphicSet(isFreeze ? (label === C.gameTying ? "final" : "default") : "live"),
    freezeFrames: [],
    hideOverlays: true,
    editorNote: `Show ${beat} with ${label}.`,
  };
}).filter((cue) => cue.end > cue.start);

for (let i = 1; i < cues.length; i += 1) {
  cues[i].start = cues[i - 1].end;
}
cues[0].start = 0;
cues[cues.length - 1].end = +voiceDuration.toFixed(3);

const edl = {
  title: "This Caitlin Clark Fourth Quarter Was UNREAL",
  slug,
  voiceDuration: +voiceDuration.toFixed(3),
  scriptPath: "/Users/abdul/transcripts/script-fever-mystics-2026-05-15-unreal-awful-style-elevenlabs.txt",
  editorialPhilosophy: "Awful Coaching mechanics with FTL Clark hype: simple language, freeze/replay/read/payoff, never anti-Clark.",
  sourceAssets: [...new Set(cues.map((cue) => cue.assetPath))].map((assetPath) => ({
    asset: path.basename(assetPath),
    assetPath,
    role: "verified Caitlin Clark game cut",
  })),
  cues,
  sectionBreaks: [
    { name: "S01", start: 0, end: 85, purpose: "Hook and first warning" },
    { name: "S02", start: 85, end: 175, purpose: "Screen coverage and help problem" },
    { name: "S03", start: 175, end: 266, purpose: "Stepback and gravity passing" },
    { name: "S04", start: 266, end: 356, purpose: "Go-ahead three and late math" },
    { name: "S05", start: 356, end: 446, purpose: "Final 1.7 seconds payoff" },
    { name: "S06", start: 446, end: +voiceDuration.toFixed(3), purpose: "Conclusion and title callback" },
  ],
};

fs.writeFileSync(outPath, `${JSON.stringify(edl, null, 2)}\n`);
console.log(JSON.stringify({ outPath, cues: cues.length, voiceDuration: edl.voiceDuration }, null, 2));
