import fs from "node:fs";

const project = "/Volumes/SSK SSD/ftl/videos/2026-09-04/caitlin-clark-vs-china-2026";
const audioDir = `${project}/audio/chronological-recap-v5-josh-normal`;
const prior = JSON.parse(fs.readFileSync(`${audioDir}/vo-timeline.json`, "utf8"));
const closing = JSON.parse(fs.readFileSync(`${audioDir}/alignment/closing-final/closing-with-postgame-final.json`, "utf8"));
const closingWords = closing.segments.flatMap((segment) => segment.words ?? []);
const shiftedWords = closingWords.map((word) => ({
  ...word,
  start: Number((word.start + 392.22).toFixed(3)),
  end: Number((word.end + 392.22).toFixed(3)),
}));

const sections = prior.sections.slice(0, 16).concat([
  {
    id: "B16-PRESS-BRIDGE",
    playNumber: null,
    text: "And after the game, coach Kara Lawson and Caitlin explained exactly how she changed it.",
    audioFile: "closing-josh-normal-final-work-20260905053344/chunk-01.mp3",
    start: 392.22,
    end: 396.86,
    duration: 4.64,
    pauseAfter: 0,
  },
  {
    id: "B17-COACH-RECEIPT",
    playNumber: null,
    text: null,
    visualOnly: true,
    reason: "Official USA Basketball clip: Kara Lawson says Caitlin changed the tempo and cites her 11 assists.",
    start: 396.86,
    end: 403.3,
    duration: 6.44,
    sourceIn: 35.48,
    sourceOut: 41.92,
  },
  {
    id: "B18-CAITLIN-BIG-STAGE",
    playNumber: null,
    text: null,
    visualOnly: true,
    reason: "Official USA Basketball clip: Caitlin describes the global crowd and excitement around the women's game.",
    start: 403.3,
    end: 421.12,
    duration: 17.82,
    sourceIn: 120.36,
    sourceOut: 138.18,
  },
  {
    id: "B19-CAITLIN-PLAYMAKING",
    playNumber: null,
    text: null,
    visualOnly: true,
    reason: "Official USA Basketball clip: Caitlin explains her goal to facilitate, play fast, penetrate the zone, and create open looks.",
    start: 421.12,
    end: 442.54,
    duration: 21.42,
    sourceIn: 145.72,
    sourceOut: 167.14,
  },
  {
    id: "B20-OUTRO",
    playNumber: null,
    text: "That answer is why the Player-of-the-Game award fits. Fourteen points and eleven assists tell you what happened. Zero turnovers tell you how completely she controlled it. And the history matters. Caitlin was MVP of the 2021 Under-19 World Cup, then TISSOT MVP of her first senior qualifying tournament. In her senior World Cup debut, she added a USA assist record and another Player-of-the-Game award. The competition changes. The stage keeps getting bigger. Caitlin Clark stays confident, sees the answer first, and makes the whole floor play on her terms. That is what brilliance looks like when the lights are brightest.",
    audioFile: "closing-josh-normal-final-work-20260905053344/chunk-02.mp3",
    start: 442.54,
    end: 481.74,
    duration: 39.2,
    pauseAfter: 0.25,
  },
]);

const output = {
  schemaVersion: "1.1",
  voice: {
    name: "Josh Australian",
    voiceId: "YCMlNeY0UBmxCWADNMyB",
    model: "eleven_v3",
    speed: 1,
    globalTimeStretch: false,
  },
  narrationMaster: "vo-master-postgame-final.mp3",
  narrationMasterDuration: 481.99,
  masterDuration: 481.99,
  pressConferenceGap: {
    start: 396.86,
    end: 442.54,
    duration: 45.68,
    finalMixReplacementRequired: true,
  },
  sections,
  words: prior.words.filter((word) => word.end <= 392.22).concat(shiftedWords),
};

fs.writeFileSync(`${audioDir}/vo-timeline-postgame.json`, `${JSON.stringify(output, null, 2)}\n`);
console.log(`${audioDir}/vo-timeline-postgame.json`);
