#!/usr/bin/env node
import fs from "node:fs";

const project = process.argv[2];
if (!project) throw new Error("Usage: node revise-edl-v5.mjs /absolute/production/project");
const edlPath = `${project}/edl.json`;
const edl = JSON.parse(fs.readFileSync(edlPath, "utf8"));
const truth = `${project}/qc/source-truth/possession-truth-log-v2.md`;
const stageTruth = `${project}/qc/stage-progression/STAGE-PROGRESSION-TRUTH-LOG.md`;

edl.revision = 5;
edl.status = "truth-approved";
edl.updatedAt = new Date().toISOString();
edl.changeLog = [...(edl.changeLog ?? []),
  "Revision 5: moved every freeze 0.50 seconds earlier so it lands before the decisive pass or shot action; slow motion now begins on that held frame and continues through the complete made-basket payoff.",
  "Revision 5: added a timed college-to-WNBA-to-USA deep-three progression using verified official March Madness, Indiana Fever, and FIBA clips.",
  "Revision 5: added official FIBA U19 and senior qualifying MVP imagery during the matching award narration."
];

const intro = edl.beats.find((beat) => beat.id === "B00-INTRO");
const introPrefix = intro.pictureOperations.filter((op) => op.programRelative.out <= 25.866);
const introSuffix = intro.pictureOperations.filter((op) => op.programRelative.in >= 34.488);
intro.pictureOperations = [
  ...introPrefix,
  {
    id: "B00-STAGE-PROGRESSION",
    programRelative: {in: 25.866, out: 34.488},
    source: {in: 0, out: 8.622},
    speed: 1,
    kind: "stage-progression-grid",
    sourceAssets: [
      {label: "COLLEGE", path: "sources/stage-progression/college-iowa-deep-three-i7aM979td7w.mp4", in: 4.2, out: 8.7},
      {label: "WNBA", path: "sources/stage-progression/wnba-fever-deep-three-jANcTPAOIYQ.mp4", in: 1.4, out: 6.4},
      {label: "USA", path: "sources/stage-progression/usa-qualifying-deep-three-rOWGkfWSmgc.mp4", in: 0.8, out: 6.3}
    ],
    visibleDetail: "Progressive three-panel proof: Clark makes a deep three for Iowa, the Indiana Fever, and senior USA Basketball as the narration names each larger stage.",
    approval: "TRUTH_APPROVED",
    evidence: [stageTruth]
  },
  ...introSuffix
];
intro.graphics = ["Progressive three-panel college / WNBA / USA deep-three proof; no text burned into the clean master"];
intro.qcChecks = [...(intro.qcChecks ?? []), "College, WNBA, and USA panels each visibly show Caitlin's deep-three release and made basket"];

for (const beat of edl.beats.filter((item) => /^B\d+-PLAY-/.test(item.id))) {
  const [live, hold, slow, reaction] = beat.pictureOperations;
  const earlier = Number((hold.source.in - 0.5).toFixed(3));
  const holdDuration = hold.programRelative.out - hold.programRelative.in;
  const beatDuration = beat.program.out - beat.program.in;
  const liveDuration = earlier - live.source.in;
  const slowDuration = (slow.source.out - earlier) / slow.speed;
  const reactionDuration = beatDuration - liveDuration - holdDuration - slowDuration;
  if (reactionDuration < 0.05) throw new Error(`${beat.id}: not enough reaction duration after earlier freeze`);

  live.source.out = earlier;
  live.programRelative = {in: 0, out: Number(liveDuration.toFixed(3))};
  live.visibleDetail = "Chronological setup stops one half-second before the previously selected decision frame, before the decisive pass or shot is released.";

  hold.source = {in: earlier, out: earlier};
  hold.programRelative = {in: live.programRelative.out, out: Number((live.programRelative.out + holdDuration).toFixed(3))};
  hold.visibleDetail = "Five-second teaching freeze before the decisive action begins.";

  slow.source.in = earlier;
  slow.programRelative = {in: hold.programRelative.out, out: Number((hold.programRelative.out + slowDuration).toFixed(3))};
  slow.visibleDetail = "Slow motion starts on the exact held frame, follows the release/pass, and continues through the complete made-basket payoff without a source-time jump.";

  reaction.source.in = slow.source.out;
  reaction.source.out = Number((reaction.source.in + reactionDuration).toFixed(3));
  reaction.programRelative = {in: slow.programRelative.out, out: Number(beatDuration.toFixed(3))};
  beat.treatment.playback = [
    {in: 0, out: live.programRelative.out, speed: 1},
    {in: slow.programRelative.in, out: slow.programRelative.out, speed: slow.speed},
    {in: reaction.programRelative.in, out: reaction.programRelative.out, speed: 1}
  ];
  beat.treatment.holds = [{at: hold.programRelative.in, duration: holdDuration}];
  beat.truthEvidence = [...new Set([...(beat.truthEvidence ?? []), truth])];
  beat.qcChecks = [
    "Freeze occurs before the decisive pass or shot release",
    "Hold and slow motion share the exact same source timestamp",
    "Slow motion follows the release/pass through the complete made basket",
    "The post-freeze action is not shown earlier in the beat",
    "Clean version contains no burned-in text"
  ];
}

const outro = edl.beats.find((beat) => beat.id === "B20-OUTRO");
outro.pictureOperations = [
  {
    id: "B20-P01",
    programRelative: {in: 0, out: 12},
    source: {in: 9, out: 21}, speed: 1, kind: "closing-montage",
    visibleDetail: "Chronological highlight proof under the closing statistics.", approval: "TRUTH_APPROVED", evidence: [truth]
  },
  {
    id: "B20-AWARD-GRID",
    programRelative: {in: 12, out: 26},
    source: {in: 0, out: 0}, speed: 0, kind: "hold", treatmentType: "award-grid",
    sourceAssets: [
      {label: "2021 U19 WORLD CUP MVP", path: "sources/official/awards/u19-2021-mvp.png", sourceUrl: "https://www.fiba.basketball/en/news/world-u19women-2021-news-tissot-mvp-clark-headlines-all-star-five-at-the-fiba-u19-women-s-basketball-world-cup"},
      {label: "2026 QUALIFYING MVP", path: "sources/official/awards/san-juan-2026-mvp-trophy.jpg", sourceUrl: "https://www.fiba.basketball/en/events/fiba-womens-basketball-world-cup-2026-qualifying-tournament-san-juan-puerto-rico/news/clark-crowned-tissot-mvp-in-san-juan"}
    ],
    visibleDetail: "Official FIBA U19 MVP portrait and official senior qualifying photo of Caitlin holding the TISSOT MVP trophy stack into a two-card grid during the award history narration.",
    approval: "TRUTH_APPROVED", evidence: [stageTruth]
  },
  {
    id: "B20-P03",
    programRelative: {in: 26, out: 39.45},
    source: {in: 120.36, out: 133.81}, speed: 1, kind: "closing-receipt",
    visibleDetail: "Official USA Basketball postgame image of Caitlin closes the largest-stage argument.",
    approval: "TRUTH_APPROVED", evidence: [`${project}/qc/postgame-receipt/POSTGAME-RECEIPT-TRUTH-LOG.md`]
  }
];
outro.graphics = ["Two-card official FIBA MVP award image grid; no text added beyond text already present in the source images"];
outro.qcChecks = [...(outro.qcChecks ?? []), "Official U19 MVP and senior qualifying trophy images are visible during their matching narration"];

fs.writeFileSync(edlPath, `${JSON.stringify(edl, null, 2)}\n`);
console.log(`Updated ${edlPath} to revision ${edl.revision} (${edl.status})`);
