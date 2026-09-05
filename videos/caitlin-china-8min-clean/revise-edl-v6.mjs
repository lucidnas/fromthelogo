#!/usr/bin/env node
import fs from "node:fs";

const project = process.argv[2];
if (!project) throw new Error("Usage: node revise-edl-v6.mjs /absolute/production/project");
const edlPath = `${project}/edl.json`;
const edl = JSON.parse(fs.readFileSync(edlPath, "utf8"));
if (edl.revision !== 5) throw new Error(`Revision 6 must be based on revision 5, found ${edl.revision}`);

const shift = 15;
const truth = `${project}/qc/source-truth/possession-truth-log-v2.md`;
const stageTruth = `${project}/qc/stage-progression/STAGE-PROGRESSION-TRUTH-LOG.md`;
const graphicTruth = `${project}/qc/revision-6/GRAPHIC-TRUTH-LOG.md`;

edl.revision = 6;
edl.status = "truth-approved";
edl.updatedAt = new Date().toISOString();
edl.duration = Number((edl.duration + shift).toFixed(3));
edl.narration.path = `${project}/audio/chronological-recap-v6-josh-normal/vo-master-stage-pauses.mp3`;
edl.narration.duration = edl.duration;
edl.changeLog = [...(edl.changeLog ?? []),
  "Revision 6: replaced the college/WNBA/USA grid with three five-second full-screen proof clips and preserved each source's original commentator audio while Josh pauses.",
  "Revision 6: added approved 16:9 FTL stat, 33-point-win, and TISSOT MVP posters with restrained fade transitions."
];

const intro = edl.beats.find((beat) => beat.id === "B00-INTRO");
intro.program.out = Number((intro.program.out + shift).toFixed(3));
intro.pictureOperations = [
  {id:"B00-P01",programRelative:{in:0,out:4.2},source:{in:1,out:5.2},speed:1,kind:"teaser",visibleDetail:"Brief chronological game setup before the opening statistic receipt.",approval:"TRUTH_APPROVED",evidence:[truth]},
  {id:"B00-STATS-POSTER",programRelative:{in:4.2,out:8.74},source:{in:0,out:0},speed:0,kind:"hold",treatmentType:"graphic-poster",sourceAsset:{path:"sources/graphics/revision-6/caitlin-stats-16x9.png"},fadeIn:0.3,visibleDetail:"Approved 16:9 Caitlin Clark stat poster displays 14 points, 11 assists, 3 rebounds, 3/7 from three, zero turnovers, plus 30, and 25 minutes during the matching narration.",approval:"TRUTH_APPROVED",evidence:[graphicTruth]},
  {id:"B00-WIN-POSTER",programRelative:{in:8.74,out:15.7},source:{in:0,out:0},speed:0,kind:"hold",treatmentType:"graphic-poster",sourceAsset:{path:"sources/graphics/revision-6/usa-china-33-point-win-16x9.png"},fadeIn:0.3,visibleDetail:"Approved 16:9 result poster displays USA 94, China 61, and the 33-point margin during the matching narration.",approval:"TRUTH_APPROVED",evidence:[graphicTruth]},
  {id:"B00-P04",programRelative:{in:15.7,out:20.9},source:{in:35,out:40.2},speed:1,kind:"teaser",visibleDetail:"Game action supports the control argument after the opening receipts.",approval:"TRUTH_APPROVED",evidence:[truth]},
  {id:"B00-P05",programRelative:{in:20.9,out:28.86},source:{in:74,out:81.96},speed:1,kind:"teaser",visibleDetail:"World Cup game footage carries the senior-debut setup through the March Madness phrase.",approval:"TRUTH_APPROVED",evidence:[truth]},
  {id:"B00-COLLEGE-FULLSCREEN",programRelative:{in:28.86,out:33.86},source:{in:4.9,out:9.9},speed:1,kind:"stage-fullscreen-native",sourceAsset:{path:"sources/stage-progression/college-iowa-deep-three-i7aM979td7w.mp4"},nativeAudio:true,visibleDetail:"Full-screen Iowa clip visibly follows Caitlin's deep-three setup, release, make, and commentator call.",approval:"TRUTH_APPROVED",evidence:[stageTruth]},
  {id:"B00-P06",programRelative:{in:33.86,out:35.16},source:{in:153,out:154.3},speed:1,kind:"teaser",visibleDetail:"Short World Cup bridge under Josh's phrase leading into the WNBA proof clip.",approval:"TRUTH_APPROVED",evidence:[truth]},
  {id:"B00-WNBA-FULLSCREEN",programRelative:{in:35.16,out:40.16},source:{in:1,out:6},speed:1,kind:"stage-fullscreen-native",sourceAsset:{path:"sources/stage-progression/wnba-fever-deep-three-jANcTPAOIYQ.mp4"},nativeAudio:true,visibleDetail:"Full-screen Indiana Fever clip visibly follows Caitlin's logo-three setup, release, make, and commentator call.",approval:"TRUTH_APPROVED",evidence:[stageTruth]},
  {id:"B00-P07",programRelative:{in:40.16,out:42.1},source:{in:154.3,out:156.24},speed:1,kind:"teaser",visibleDetail:"Short World Cup bridge under Josh's phrase leading into the USA Basketball proof clip.",approval:"TRUTH_APPROVED",evidence:[truth]},
  {id:"B00-USA-FULLSCREEN",programRelative:{in:42.1,out:47.1},source:{in:1.8,out:6.8},speed:1,kind:"stage-fullscreen-native",sourceAsset:{path:"sources/stage-progression/usa-qualifying-deep-three-rOWGkfWSmgc.mp4"},nativeAudio:true,visibleDetail:"Full-screen USA qualifying clip visibly follows Caitlin's sidestep deep-three release, make, and complete commentator call.",approval:"TRUTH_APPROVED",evidence:[stageTruth]},
  {id:"B00-P08",programRelative:{in:47.1,out:49.488},source:{in:156.24,out:158.628},speed:1,kind:"teaser",visibleDetail:"World Cup footage resumes as Josh concludes the stage-progression thought.",approval:"TRUTH_APPROVED",evidence:[truth]},
  ...intro.pictureOperations.filter((op) => op.programRelative.in >= 34.488).map((op) => ({...op,programRelative:{in:Number((op.programRelative.in+shift).toFixed(3)),out:Number((op.programRelative.out+shift).toFixed(3))}}))
];
intro.treatment.graphics = ["Approved stat and 33-point result posters", "Three full-screen college / WNBA / USA deep-three proof clips"];
intro.audio.source = "Original commentator audio at 28.86-33.86, 35.16-40.16, and 42.10-47.10 while Josh pauses";
intro.qcChecks = ["Stat and result posters match official FIBA data", "College, WNBA, and USA clips are full-screen and each lasts five seconds", "Each proof clip includes its original commentator call without Josh overlap"];

for (const beat of edl.beats.filter((beat) => beat.id !== "B00-INTRO")) {
  beat.program.in = Number((beat.program.in + shift).toFixed(3));
  beat.program.out = Number((beat.program.out + shift).toFixed(3));
}

for (const [index, section] of edl.reviewSections.entries()) {
  if (index > 0) section.program.in = Number((section.program.in + shift).toFixed(3));
  section.program.out = Number((section.program.out + shift).toFixed(3));
}

const outro = edl.beats.find((beat) => beat.id === "B20-OUTRO");
const award = outro.pictureOperations.find((op) => op.treatmentType === "award-grid");
award.id = "B20-MVP-POSTER";
award.treatmentType = "graphic-poster";
award.sourceAsset = {path:"sources/graphics/revision-6/caitlin-tissot-mvp-16x9.png"};
delete award.sourceAssets;
award.fadeIn = 0.3;
award.visibleDetail = "Approved 16:9 TISSOT MVP poster preserves the official trophy photograph and identifies Caitlin Clark and San Juan 2026 during the award narration.";
award.evidence = [graphicTruth];
outro.treatment.graphics = ["Approved full-screen 16:9 TISSOT MVP poster"];
outro.qcChecks = ["MVP poster is full-screen, legible, and appears during the matching award narration"];

fs.writeFileSync(edlPath, `${JSON.stringify(edl, null, 2)}\n`);
console.log(`Updated ${edlPath} to revision ${edl.revision} (${edl.status}, ${edl.duration}s)`);
