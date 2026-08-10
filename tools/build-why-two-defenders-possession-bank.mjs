#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const root = "/Users/abdul/code/fromthelogo/research/daniel-li-bank";
const db = "/Volumes/SSK SSD/ftl-data/caitlin-clark-pbp.sqlite3";

const games = [
  ["2024-05-30","1022400038","SEA","https://www.youtube.com/watch?v=7FDbLBr3-28",[[188,"range gravity"],[91,"weak-side tag"]]],
  ["2024-06-07","1022400056","WAS","https://www.youtube.com/watch?v=aKr2RPAW3p4",[[427,"range gravity"],[38,"pocket/bounce pass"]]],
  ["2024-06-23","1022400096","CHI","https://www.youtube.com/watch?v=hNFXf9Oj1V4",[[392,"range gravity"],[253,"weak-side tag"]]],
  ["2024-07-06","1022400121","NYL","https://www.youtube.com/watch?v=Di3rlyeGRFU",[[10,"range gravity"],[229,"pocket/bounce pass"]]],
  ["2024-07-17","1022400148","DAL","https://www.youtube.com/watch?v=W9zwG9O6gzg",[[452,"third-defender read"],[499,"weak-side tag"]]],
  ["2024-08-16","1022400153","PHO","https://www.youtube.com/watch?v=hRDmcxojDEU",[[124,"range gravity"],[508,"weak-side tag"]]],
  ["2024-09-06","1022400204","MIN","https://www.youtube.com/watch?v=Fjoh-y9myDw",[[150,"range gravity"],[226,"third-defender read"]]],
  ["2025-05-17","1022500004","CHI","https://www.youtube.com/watch?v=nY-EhFGFvy4",[[513,"range gravity"],[339,"weak-side tag"]]],
  ["2025-05-20","1022500011","ATL","https://www.youtube.com/watch?v=LFC6S3BV5iE",[[504,"range gravity"],[579,"transition drag screen"]]],
  ["2025-05-24","1022500021","NYL","https://www.youtube.com/watch?v=nSWsjygG8Nw",[[438,"range gravity"],[9,"pocket/bounce pass"]]],
  ["2025-06-14","1022500066","NYL","https://www.youtube.com/watch?v=UoAP_L3Ao20",[[117,"range gravity"],[564,"weak-side tag"]]],
  ["2026-05-15","1022600022","WAS","https://www.youtube.com/watch?v=C2D8zbYbdMo",[[513,"third-defender read"],[555,"weak-side tag"]]],
  ["2026-05-22","1022600039","GSV","https://www.youtube.com/watch?v=lIMGX7vDPuM",[[509,"range gravity"],[419,"weak-side tag"]]],
  ["2026-06-16","1022600106","TOR","https://www.youtube.com/watch?v=2O7M9u_xFjE",[[576,"range gravity"]]],
  ["2026-06-24","1022600128","PHX","https://www.youtube.com/watch?v=lo7foKnQ1Ao",[[39,"range gravity"],[80,"pocket/bounce pass"]]],
  ["2026-07-17","1022600184","SEA","https://www.youtube.com/watch?v=dn6Gpxhj-7s",[[211,"range gravity"]]],
  ["2026-07-22","1022600201","CON","https://www.youtube.com/watch?v=yFs4tjhvJ58",[[55,"range gravity"],[397,"third-defender read"]]],
  ["2026-07-28","1022600205","SEA","https://www.youtube.com/watch?v=L52jp4Qr5rU",[[29,"transition drag screen"],[597,"third-defender read"]]],
  ["2026-07-31","1022600215","PDX","https://www.youtube.com/watch?v=zFlelIoxYB4",[[215,"weak-side tag"],[256,"range gravity"],[331,"pocket/bounce pass"],[650,"pocket/bounce pass"]]],
  ["2026-08-02","1022600218","MIN","https://www.youtube.com/watch?v=SaNkNIQhLCU",[[59,"transition drag screen"],[490,"weak-side tag"]]],
];

const verified = new Map([
  ["1022500011:579",{categories:["transition drag screen","high show/blitz","pocket/bounce pass"],sourceTimestamp:{start:277,end:284,replayStart:284},confidence:"high",evidence:"Gemini 3.6 Flash visual pass on official Fever 16:9 upload; Q4 1:21 visible. Clark uses a drag screen, Atlanta's big shows high, and Clark bounces to Boston's roll."}],
  ["1022400204:226",{categories:["third-defender read","pocket/bounce pass"],eventUrl:"https://videos.nba.com/wnba/pbp/media/2024/09/06/1022400204/226/c2c5030d-fb06-844b-f694-63ba29af5764_1280x720.mp4",confidence:"high",evidence:"Exact official WNBA event clip verified. A second defender is loaded toward the nail; Clark passes behind the help to Boston. Not a high trap."}],
  ["1022600128:39",{categories:["range gravity"],sourceTimestamp:{start:5,end:9},confidence:"high",evidence:"Gemini 3.6 Flash visual pass on official Fever 16:9 upload; scoreboard shows Q1 6:35 and the 31.2-foot step-back."}],
  ["1022600201:55",{categories:["range gravity"],confidence:"high",evidence:"Exact Q1 6:05 30.0-foot make verified against the official Fever source and extracted source frames."}],
  ["1022600201:397",{categories:["third-defender read","weak-side tag"],confidence:"high",evidence:"Verified rejected spread pick-and-roll: low defender rotates toward Clark and Hull cuts behind the rotation for the reverse layup."}],
  ["1022600215:215",{categories:["weak-side tag","pocket/bounce pass"],sourceUrl:"https://www.youtube.com/shorts/-emBYtRIIn8",sourceTimestamp:{start:0,end:8.73,freeze:4},confidence:"high",evidence:"Verified official Fever Short. Clark's drive turns two nearby defenders toward the ball and Mitchell cuts behind them."}],
  ["1022600215:256",{categories:["range gravity"],confidence:"high",evidence:"Verified 28.6-foot transition step-back. Defender retreats to ordinary arc pickup space; Clark treats it as shooting space."}],
  ["1022600215:331",{categories:["pocket/bounce pass","third-defender read"],eventUrl:"https://videos.nba.com/wnba/pbp/media/2026/07/31/1022600215/331/b07691eb-187c-e70e-4502-41461854aa2a_1280x720.mp4",sourceTimestamp:{start:0,end:6.8,freeze:[2.6,4.1,4.6]},confidence:"high",evidence:"Exact official WNBA event clip. Baseline drive moves the helper; Clark changes the delivery angle with a hook pass to Mitchell behind the play."}],
  ["1022600215:650",{categories:["pocket/bounce pass","third-defender read"],sourceTimestamp:{start:0,end:5,freeze:1.2},confidence:"high",evidence:"Verified exact event. Defense shifts toward Clark; Timpson cuts through the pocket for Clark's 10th assist. Do not run beyond 5.133 seconds."}],
  ["1022600218:59",{categories:["transition drag screen"],sourceUrl:"https://www.youtube.com/shorts/ADyeGGr2INQ",sourceTimestamp:{start:0,end:7.64,freeze:1},confidence:"high",evidence:"Verified official Fever Short and PBP identity. Clark advances the ball before Minnesota can build its half-court shell; receiver identity comes from official metadata."}],
  ["1022600218:490",{categories:["weak-side tag","pocket/bounce pass"],sourceUrl:"https://www.youtube.com/shorts/tP44kSKHzMk",sourceTimestamp:{start:0,end:11.35,freeze:1.5},confidence:"high",evidence:"Verified official Fever Short. Interior defender steps toward Clark; Mitchell cuts baseline behind the help and receives the bounce pass."}],
]);

function row(gameId, action) {
  const q = `select json_object('period',period,'clock',clock,'description',description,'shotDistance',shot_distance,'actionType',action_type,'subType',sub_type,'descriptor',descriptor) from plays where game_id='${gameId}' and action_number=${action}`;
  const raw = execFileSync("sqlite3", [db, q], {encoding:"utf8"}).trim();
  if (!raw) throw new Error(`Missing PBP ${gameId}:${action}`);
  return JSON.parse(raw);
}

const possessions = [];
for (const [date, gameId, opponent, officialUrl, candidates] of games) {
  for (const [actionNumber, proposedCategory] of candidates) {
    const pbp = row(gameId, actionNumber);
    const key = `${gameId}:${actionNumber}`;
    const v = verified.get(key);
    possessions.push({
      id:key,
      gameId,date,opponent,actionNumber,
      period:pbp.period,
      gameClock:pbp.clock.replace(/^PT|\.00S$|S$/g,"").replace("M",":"),
      officialEvent:pbp.description,
      shotDistanceFeet:pbp.shotDistance,
      officialGameSourceUrl:officialUrl,
      clipSpecificSourceUrl:v?.sourceUrl || null,
      officialSourceUrl:v?.sourceUrl || officialUrl,
      officialEventUrl:v?.eventUrl || null,
      officialSourceTimestampSeconds:v?.sourceTimestamp || null,
      categories:v?.categories || [proposedCategory],
      classificationStatus:v ? "visually_verified" : "candidate_from_pbp_event_visual_pending",
      confidence:v?.confidence || "medium_event_identity_low_coverage",
      evidence:v?.evidence || "WNBA play-by-play verifies the event and official Fever upload verifies the game source. Coverage classification remains a film question and must not enter narration until visually confirmed.",
      usableInScript:v ? true : proposedCategory === "range gravity",
      scriptBoundary:v ? null : (proposedCategory === "range gravity" ? "May state the measured shot distance; may not infer pickup coverage until visual review." : "Do not state the proposed coverage category until visual review locates the exact possession."),
    });
  }
}

const rejected = [
  {id:"1022400204:226-fever-upload",reason:"The official Fever highlight Fjoh-y9myDw does not contain the Q2 3:28 Boston target. Use only the exact WNBA event clip."},
  {id:"1022600215:256-31-foot-label",reason:"PBP measures 28.6 feet, not 31. Reject the older 31-foot label."},
  {id:"1022600215:horn-pump-fake",reason:"Video supports a right-to-left directional counter, not a pump fake/side-step description."},
  {id:"1022600218:59-receiver-visual-id",reason:"Pixel-only model checks conflicted on receiver identity. Official Fever metadata/PBP identify Billings; visual narration should say teammate/runner."},
];

const bank = {
  schemaVersion:2,
  title:"Why Defenses Have to Guard Caitlin Clark Twice",
  generatedAt:new Date().toISOString(),
  scope:{distinctGames:games.length,possessions:possessions.length,visuallyVerified:possessions.filter(p=>p.classificationStatus==="visually_verified").length,pbpVerifiedVisualPending:possessions.filter(p=>p.classificationStatus!=="visually_verified").length},
  evidenceRules:["PBP proves event identity, clock, and measured distance; it does not prove coverage.","Only visually_verified rows may support high show/blitz, weak-side tag, or third-defender narration.","Range-gravity rows with measured distance may support distance claims before coverage review.","Official 16:9 Fever uploads are preferred; exact official WNBA event clips are canonical when the recap omits a target."],
  possessions,
  rejected,
};

writeFileSync(`${root}/why-two-defenders-possession-bank-v2.json`, JSON.stringify(bank,null,2)+"\n");

const verifiedRows = possessions.filter(p=>p.usableInScript).map(p=> {
  const sourceTime = p.officialSourceTimestampSeconds
    ? JSON.stringify(p.officialSourceTimestampSeconds)
    : p.officialEventUrl
      ? "exact event clip"
      : p.classificationStatus === "visually_verified"
        ? "frame-verified; upload offset not yet recorded"
        : "PBP locator; upload offset pending";
  return `| ${p.date} vs ${p.opponent} | Q${p.period} ${p.gameClock} | ${p.officialEvent} | ${p.categories.join(" + ")} | ${p.confidence} | ${sourceTime} |`;
}).join("\n");
const gameRows = games.map(([date,id,opp,url])=>`| ${date} | ${id} | ${opp} | [official Fever source](${url}) |`).join("\n");
const md = `# Why Defenses Have to Guard Caitlin Clark Twice — possession bank v2\n\nUpdated: ${new Date().toISOString().slice(0,10)}\n\n## Audit result\n\n- ${games.length} distinct games represented.\n- ${possessions.length} PBP-verified possessions.\n- ${possessions.filter(p=>p.classificationStatus==="visually_verified").length} possessions have coverage/action geometry visually verified.\n- Remaining rows are locator candidates, not narration proof. They are deliberately retained with low coverage confidence so the next visual pass has a bounded queue.\n\n## Script-safe core\n\n| Game | Clock | Official event | Verified category | Confidence | Source time |\n|---|---:|---|---|---|---|\n${verifiedRows}\n\nThis core is enough to structure an eight-minute essay without repeating one game: establish range, show the high big, show the pocket, then show the third defender and Clark's counter. Use the pending rows only as B-roll locators until their exact upload timestamps are verified.\n\n## Twenty-game coverage ledger\n\n| Date | Game ID | Opponent | Official 16:9 source |\n|---|---|---|---|\n${gameRows}\n\n## Rejections\n\n${rejected.map(r=>`- **${r.id}:** ${r.reason}`).join("\n")}\n\n## Recommended essay spine\n\n1. **Range changes the pickup point:** CON 2026, PHX 2026, PDX 2026.\n2. **The second defender has to rise:** ATL 2025 drag-screen/high-show possession.\n3. **That opens the first pass:** ATL bounce pass and PDX drive-to-cut.\n4. **The third defender inherits the problem:** MIN 2024 nail load, CON 2026 low rotation, PDX baseline helper.\n5. **Clark solves that defender too:** PDX hook angle, Timpson pocket, MIN baseline bounce pass.\n6. **The defense cannot reset:** MIN full-court hit-ahead as transition coda.\n`;
writeFileSync(`${root}/why-two-defenders-possession-bank-v2.md`, md);
console.log(JSON.stringify(bank.scope));
