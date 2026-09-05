#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const project = process.argv[2];
if (!project) throw new Error("Usage: generate-ftl-chronological-edl.mjs PROJECT_DIR");
const manifest = JSON.parse(fs.readFileSync(path.join(project, "selected-play-manifest-v2.json"), "utf8"));
const timelinePath = path.join(project, "audio/chronological-recap-v5-josh-normal/vo-timeline-postgame.json");
const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
const game = manifest.sourcePath;
const press = path.join(project, "sources/official/postgame/USA-Basketball-mWNTPDreG1k.mp4");
const playEvidence = path.join(project, "qc/source-truth/possession-truth-log-v2.md");
const pressEvidence = path.join(project, "qc/postgame-receipt/POSTGAME-RECEIPT-TRUTH-LOG.md");
const scriptPath = path.join(project, "SCRIPT-CHRONOLOGICAL-RECAP-V4-8MIN.md");
const sectionById = new Map(timeline.sections.map((section) => [section.id, section]));
const round = (value) => Number(value.toFixed(3));
const sourceRef = (asset, sourcePath, sourceIn, sourceOut) => ({asset, path: sourcePath, in: sourceIn, out: sourceOut});
const op = (id, pin, pout, sourceIn, sourceOut, speed, kind, visibleDetail, evidence) => ({id, programRelative:{in:round(pin), out:round(pout)}, source:{in:round(sourceIn), out:round(sourceOut)}, speed, kind, visibleDetail, approval:"TRUTH_APPROVED", evidence:[evidence]});
const audio = (source = "mute") => ({vo:"Josh Australian, ElevenLabs YCMlNeY0UBmxCWADNMyB, eleven_v3, speed 1.00; no global time stretch", source, music:"low instrumental bed; duck under narration and native press audio", ambience:source === "native foreground" ? "included in source" : "none", effects:[]});
const beats = [];

const intro = sectionById.get("B00-INTRO");
const introOut = sectionById.get("B01-PLAY-01").start;
const introDuration = round(introOut - intro.start);
let introCursor = 0;
const introOps = manifest.plays.map((play, index) => {
  const remaining = introDuration - introCursor;
  const duration = index === manifest.plays.length - 1 ? remaining : Math.min(4.311, remaining);
  const operation = op(`B00-P${String(index + 1).padStart(2,"0")}`, introCursor, introCursor + duration, play.sourceIn, play.sourceIn + duration, 1, "teaser", `Brief chronological setup fragment from play ${play.playNumber}; the complete possession is reserved for its analysis beat.`, playEvidence);
  introCursor += duration;
  return operation;
});
beats.push({id:"B00-INTRO", program:{in:0,out:introOut}, editorialRole:"opening-promise", narration:intro.text, primaryAppearance:true, source:sourceRef("chronological-highlight",game,1,312), visibleAction:"Chronological setup fragments establish all four made field goals and eleven assists without showing any complete possession.", caitlinRole:"Visible primary subject across the chronological teaser.", purpose:"Establish the verified stat line, global-stage thesis, and promise to analyze every scoring and assisted possession in order.", treatment:{playback:[],holds:[],cropPan:"Full broadcast frame",color:"FTL premium grade",graphics:["labeled-version only: 14 PTS • 11 AST • 0 TO"],captions:[],transitionOut:"cut"}, pictureOperations:introOps, audio:audio("ducked native game audio"), truthEvidence:[playEvidence], qcChecks:["No complete possession is spoiled","Fragments remain chronological","Clean version contains no added text"]});

for (const play of manifest.plays) {
  const id = `B${String(play.playNumber).padStart(2,"0")}-PLAY-${String(play.playNumber).padStart(2,"0")}`;
  const section = sectionById.get(id);
  const next = timeline.sections[timeline.sections.indexOf(section) + 1];
  const duration = round(next.start - section.start);
  const liveDuration = round(play.sourceOut - play.sourceIn);
  const slowDuration = round((play.slowMotion.sourceOut - play.slowMotion.sourceIn) / play.slowMotion.speed);
  const holdDuration = play.playNumber === 10 ? round(duration - liveDuration - slowDuration) : 5;
  const aftermathDuration = round(duration - liveDuration - holdDuration - slowDuration);
  let cursor = 0;
  const operations = [];
  operations.push(op(`${id}-P01`,cursor,cursor+liveDuration,play.sourceIn,play.sourceOut,1,"live",`Complete chronological possession: ${play.punishment}.`,playEvidence)); cursor += liveDuration;
  operations.push(op(`${id}-P02`,cursor,cursor+holdDuration,play.freezeFrame,play.freezeFrame,0,"hold",`Long decision freeze: ${play.read}.`,playEvidence)); cursor += holdDuration;
  operations.push(op(`${id}-P03`,cursor,cursor+slowDuration,play.slowMotion.sourceIn,play.slowMotion.sourceOut,play.slowMotion.speed,"analysis-replay","Bounded slow-motion window isolates the read and release before the payoff.",playEvidence)); cursor += slowDuration;
  if (aftermathDuration > 0.001) operations.push(op(`${id}-P04`,cursor,cursor+aftermathDuration,play.sourceOut,play.sourceOut+aftermathDuration,1,"reaction","Immediate broadcast aftermath following the verified payoff; it introduces no additional basketball claim.",playEvidence));
  beats.push({id, program:{in:section.start,out:next.start}, editorialRole:play.type === "assist" ? "playmaking-analysis" : "scoring-analysis", narration:section.text, primaryAppearance:true, source:sourceRef("chronological-highlight",game,play.sourceIn,play.sourceOut+Math.max(0,aftermathDuration)), visibleAction:`Q${play.period} ${play.gameClock}: ${play.punishment}.`, caitlinRole:play.type === "assist" ? "Creates the teammate score and receives the official assist." : "Scores the made field goal.", purpose:`Explain the defensive choice and Caitlin's answer: ${play.read}.`, treatment:{playback:[{in:0,out:liveDuration,speed:1},{in:liveDuration+holdDuration,out:liveDuration+holdDuration+slowDuration,speed:play.slowMotion.speed}],holds:[{at:liveDuration,duration:holdDuration}],cropPan:"Full broadcast frame",color:"FTL premium grade",graphics:[`labeled-version only: ${play.label}`,`labeled-version only: Q${play.period} ${play.gameClock}`],captions:[],transitionOut:"cut"}, pictureOperations:operations, audio:audio("ducked native game audio"), truthEvidence:[playEvidence], qcChecks:["Complete live possession appears once","Decision freeze follows live payoff","Only the named causal window is replayed in slow motion","No FFmpeg text","Clean version contains no added text"]});
}

const bridge = sectionById.get("B16-PRESS-BRIDGE");
beats.push({id:bridge.id,program:{in:bridge.start,out:bridge.end},editorialRole:"transition",narration:bridge.text,primaryAppearance:true,source:sourceRef("official-postgame",press,120.36,125),visibleAction:"Caitlin Clark is visible at the official USA Basketball postgame dais.",caitlinRole:"Introduces her own postgame explanation.",purpose:"Bridge from play analysis to direct postgame evidence.",treatment:{playback:[{in:0,out:4.64,speed:1}],holds:[],cropPan:"Full official frame",color:"source natural",graphics:[],captions:[],transitionOut:"cut"},pictureOperations:[op("B16-P01",0,4.64,120.36,125,1,"transition","Caitlin at the official postgame dais.",pressEvidence)],audio:audio("mute"),truthEvidence:[pressEvidence],qcChecks:["Caitlin is visibly identifiable","Narration ends before native quote begins"]});

const receipts = [
  ["B17-COACH-RECEIPT","Kara Lawson says Caitlin was terrific, changed the tempo, and produced 11 assists.","Kara Lawson","Confirms the control thesis from the head coach.",35.48,41.92],
  ["B18-CAITLIN-BIG-STAGE","Caitlin discusses the fans, global growth, and postgame excitement.","Caitlin Clark","Connects Caitlin's performance to the global stage.",120.36,138.18],
  ["B19-CAITLIN-PLAYMAKING","Caitlin explains her plan to facilitate, play fast, penetrate China's zone, force rotations, and create open looks.","Caitlin Clark","Directly confirms the tactical analysis in Caitlin's own words.",145.72,167.14]
];
for (const [id,visibleAction,caitlinRole,purpose,sourceIn,sourceOut] of receipts) {
  const section = sectionById.get(id); const duration = round(section.end-section.start);
  beats.push({id,program:{in:section.start,out:section.end},editorialRole:"receipt",visualOnly:true,visualOnlyReason:section.reason,primaryAppearance:id!=="B17-COACH-RECEIPT",source:sourceRef("official-postgame",press,sourceIn,sourceOut),visibleAction,caitlinRole,purpose,treatment:{playback:[{in:0,out:duration,speed:1}],holds:[],cropPan:"Full official frame",color:"source natural",graphics:["labeled-version only: speaker identification"],captions:[],transitionOut:id==="B19-CAITLIN-PLAYMAKING"?"cut":"explicit editorial jump"},pictureOperations:[op(`${id}-P01`,0,duration,sourceIn,sourceOut,1,"native-soundbite",visibleAction,pressEvidence)],audio:audio("native foreground"),truthEvidence:[pressEvidence],qcChecks:["Native quote is complete and intelligible","No narration overlap","Omitted source interval is presented as an editorial jump"]});
}

const outro = sectionById.get("B20-OUTRO"); const outroDuration = round(timeline.masterDuration-outro.start); let outroCursor=0;
const outroOps = manifest.plays.map((play,index)=>{const duration=2;const operation=op(`B20-P${String(index+1).padStart(2,"0")}`,outroCursor,outroCursor+duration,Math.max(play.sourceIn,play.sourceOut-2),play.sourceOut,1,"closing-montage",`Verified payoff fragment from play ${play.playNumber}.`,playEvidence);outroCursor+=duration;return operation;});
const outroRemainder=round(outroDuration-outroCursor); outroOps.push(op("B20-P16",outroCursor,outroCursor+outroRemainder,120.36,120.36+outroRemainder,1,"closing-receipt","Caitlin at the official postgame dais under the final big-stage thesis.",pressEvidence));
beats.push({id:"B20-OUTRO",program:{in:outro.start,out:timeline.masterDuration},editorialRole:"closing-proof",narration:outro.text,primaryAppearance:true,source:sourceRef("verified-montage",game,1,312),visibleAction:"Every verified payoff returns briefly before Caitlin's official postgame image closes the argument.",caitlinRole:"Primary subject and Player of the Game.",purpose:"Resolve why the award, history, control, and biggest-stage confidence belong together.",treatment:{playback:[],holds:[],cropPan:"Full source frames",color:"FTL premium grade",graphics:["labeled-version only: Player of the Game closing card"],captions:[],transitionOut:"fade"},pictureOperations:outroOps,audio:audio("ducked native audio"),truthEvidence:[playEvidence,pressEvidence],qcChecks:["All montage fragments are from approved possessions","Final picture remains Caitlin","No dead silence","Clean version contains no added text"]});

const edl={$schemaVersion:"1.0",project:"caitlin-clark-vs-china-2026",title:manifest.title,format:"long-form-horizontal",platforms:["youtube"],duration:timeline.masterDuration,status:"truth-approved",revision:3,updatedAt:new Date().toISOString(),titlePromise:"Every Caitlin Clark made basket and assist, in chronological order, showing how she controlled China and why she thrives on the biggest stage.",truthGate:"/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/POSSESSION-TRUTH-QC-GATE.md",scriptPath,narration:{path:path.join(project,"audio/chronological-recap-v5-josh-normal/vo-master-postgame-final.mp3"),duration:481.99,voice:"Josh Australian",voiceId:"YCMlNeY0UBmxCWADNMyB",speed:1,globalTimeStretch:false},variants:[{id:"clean",addedText:false},{id:"hyperframes-labeled",addedText:true,textRenderer:"HyperFrames only"}],changeLog:["Expanded the chronological Josh 1.00x timeline to 8:01.99 without global time compression.","Added verified official USA Basketball postgame receipts from Kara Lawson and Caitlin Clark.","Authored longer decision freezes before bounded slow-motion analysis.","Required identical clean and HyperFrames-labeled variants with no FFmpeg text."],blockedBeats:[],reviewSections:[{id:"S01",program:{in:0,out:64.66},beatIds:["B00-INTRO"]},{id:"S02",program:{in:64.66,out:131.84},beatIds:["B01-PLAY-01","B02-PLAY-02","B03-PLAY-03"]},{id:"S03",program:{in:131.84,out:193.42},beatIds:["B04-PLAY-04","B05-PLAY-05","B06-PLAY-06"]},{id:"S04",program:{in:193.42,out:263.16},beatIds:["B07-PLAY-07","B08-PLAY-08","B09-PLAY-09"]},{id:"S05",program:{in:263.16,out:329.7},beatIds:["B10-PLAY-10","B11-PLAY-11","B12-PLAY-12"]},{id:"S06",program:{in:329.7,out:392.22},beatIds:["B13-PLAY-13","B14-PLAY-14","B15-PLAY-15"]},{id:"S07",program:{in:392.22,out:442.54},beatIds:["B16-PRESS-BRIDGE","B17-COACH-RECEIPT","B18-CAITLIN-BIG-STAGE","B19-CAITLIN-PLAYMAKING"]},{id:"S08",program:{in:442.54,out:481.99},beatIds:["B20-OUTRO"]}],beats};
fs.writeFileSync(path.join(project,"edl.json"),`${JSON.stringify(edl,null,2)}\n`);
const rows=beats.map(beat=>`| ${beat.id} | ${beat.program.in.toFixed(2)}–${beat.program.out.toFixed(2)} | ${beat.editorialRole} | ${beat.visualOnly?"Native source audio":"Josh 1.00×"} | ${beat.source.asset} |`).join("\n");
fs.writeFileSync(path.join(project,"EDL.md"),`# ${manifest.title}\n\nStatus: **truth-approved**  \nRevision: **3**  \nRuntime: **8:01.99**  \nOrder: **strict chronological**  \nCoverage: **4/4 made field goals and 11/11 assists**  \nVO: **Josh Australian at 1.00×; no global speed change**\n\nEach play appears live once, then holds its verified decision frame for five seconds (4.39 seconds on play 10), followed by one bounded 0.65× analysis window and verified broadcast aftermath. The postgame sequence uses three native-audio excerpts from the official USA Basketball upload. The clean and HyperFrames-labeled variants share this exact picture-and-audio contract.\n\n| Beat | Program | Role | Audio | Source |\n|---|---:|---|---|---|\n${rows}\n`);
console.log(path.join(project,"edl.json"));
