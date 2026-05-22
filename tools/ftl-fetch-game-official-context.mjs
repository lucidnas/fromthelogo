#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-fetch-game-official-context.mjs --slug SLUG (--wnba-game-id GAME_ID | --bref-id GAME_ID) [options]

Fetches box score and play-by-play context into local files for fact-checking Gemini analysis.

Options:
  --source-name NAME   Default: Basketball-Reference
  --wnba-game-id ID    WNBA game ID. Preferred when available.
  --box-url URL        Override box score URL.
  --pbp-url URL        Override play-by-play URL.
  --out-json FILE      Default: /Volumes/SSK SSD/ftl/videos/{slug}/analysis/official-game-context.json
  --out-md FILE        Default: /Volumes/SSK SSD/ftl/videos/{slug}/analysis/official-game-context.md

Example:
  node tools/ftl-fetch-game-official-context.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --wnba-game-id 1022600022`);
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

const slug = args.get("slug");
const brefId = args.get("bref-id");
const wnbaGameId = args.get("wnba-game-id");
if (!slug || (!brefId && !wnbaGameId)) usage();

const sourceName = args.get("source-name") || (wnbaGameId ? "WNBA liveData CDN" : "Basketball-Reference");
const boxUrl = args.get("box-url") || (wnbaGameId
  ? `https://cdn.wnba.com/static/json/liveData/boxscore/boxscore_${wnbaGameId}.json`
  : `https://www.basketball-reference.com/wnba/boxscores/${brefId}.html`);
const pbpUrl = args.get("pbp-url") || (wnbaGameId
  ? `https://cdn.wnba.com/static/json/liveData/playbyplay/playbyplay_${wnbaGameId}.json`
  : `https://www.basketball-reference.com/wnba/boxscores/pbp/${brefId}.html`);
const outJson = args.get("out-json") || `/Volumes/SSK SSD/ftl/videos/${slug}/analysis/official-game-context.json`;
const outMd = args.get("out-md") || `/Volumes/SSK SSD/ftl/videos/${slug}/analysis/official-game-context.md`;

function fetchHtml(url) {
  return execFileSync("curl", ["-L", "-s", "--max-time", "30", url], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
}

function fetchJson(url) {
  return JSON.parse(fetchHtml(url));
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractTable(html, tableId) {
  const re = new RegExp(`<table[^>]+id="${tableId}"[\\s\\S]*?<\\/table>`, "i");
  const match = html.match(re);
  return match ? match[0] : "";
}

function parseDataStatRow(rowHtml) {
  const cells = {};
  for (const match of rowHtml.matchAll(/<(?:th|td)\b([^>]*)>([\s\S]*?)<\/(?:th|td)>/gi)) {
    const attrs = match[1];
    const dataStat = attrs.match(/data-stat="([^"]+)"/)?.[1];
    if (!dataStat) continue;
    cells[dataStat] = stripTags(match[2]);
  }
  return cells;
}

function parsePlayerTable(html, tableId) {
  const table = extractTable(html, tableId);
  if (!table) return [];
  return [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => parseDataStatRow(match[0]))
    .filter((row) => row.player);
}

function parseLineScore(html) {
  const table = extractTable(html, "line-score");
  return [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => parseDataStatRow(match[0]))
    .filter((row) => row.team);
}

function parsePbp(html) {
  const table = extractTable(html, "pbp");
  const rows = [];
  let period = "";
  for (const match of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const attrs = match[1];
    const body = match[2];
    const periodId = attrs.match(/id="q([0-9]+)"/)?.[1];
    if (periodId) {
      period = periodId === "5" ? "OT" : `${periodId}`;
      continue;
    }
    if (/class=['"]thead['"]/.test(attrs) || /aria-label="Time"/.test(body)) continue;

    const cells = [...body.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((cell) => ({
      attrs: cell[1],
      text: stripTags(cell[2]),
      colspan: Number(cell[1].match(/colspan=['"]?([0-9]+)/)?.[1] || "1"),
    }));
    if (!cells.length) continue;

    if (cells.length === 2 && cells[1].colspan >= 5) {
      rows.push({
        period,
        time: cells[0].text,
        score: "",
        awayPlay: cells[1].text,
        homePlay: "",
        eventText: cells[1].text,
      });
      continue;
    }

    if (cells.length >= 6) {
      const awayPlay = cells[1]?.text === "" ? "" : cells[1]?.text;
      const score = cells[3]?.text || "";
      const homePlay = cells[5]?.text === "" ? "" : cells[5]?.text;
      rows.push({
        period,
        time: cells[0]?.text || "",
        score,
        awayPlay,
        homePlay,
        eventText: [awayPlay, homePlay].filter(Boolean).join(" | "),
      });
    }
  }
  return rows.filter((row) => row.time || row.eventText);
}

function findPlayer(rows, player) {
  return rows.find((row) => row.player === player) || null;
}

function selectedStats(playerRow) {
  if (!playerRow) return {};
  const keys = ["mp", "fg", "fga", "fg_pct", "fg3", "fg3a", "fg3_pct", "ft", "fta", "trb", "ast", "stl", "blk", "tov", "pf", "pts", "plus_minus"];
  return Object.fromEntries(keys.map((key) => [key, playerRow[key] ?? ""]));
}

function formatIsoClock(clock) {
  const match = String(clock || "").match(/PT(?:(\d+)M)?([0-9.]+)S/);
  if (!match) return String(clock || "");
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const secondsText = seconds % 1 === 0 ? String(seconds).padStart(2, "0") : seconds.toFixed(1).padStart(4, "0");
  return `${minutes}:${secondsText}`;
}

function wnbaStats(row) {
  const s = row?.statistics || {};
  return {
    mp: s.minutes || "",
    fg: String(s.fieldGoalsMade ?? ""),
    fga: String(s.fieldGoalsAttempted ?? ""),
    fg_pct: String(s.fieldGoalsPercentage ?? ""),
    fg3: String(s.threePointersMade ?? ""),
    fg3a: String(s.threePointersAttempted ?? ""),
    fg3_pct: String(s.threePointersPercentage ?? ""),
    ft: String(s.freeThrowsMade ?? ""),
    fta: String(s.freeThrowsAttempted ?? ""),
    trb: String(s.reboundsTotal ?? ""),
    ast: String(s.assists ?? ""),
    stl: String(s.steals ?? ""),
    blk: String(s.blocks ?? ""),
    tov: String(s.turnovers ?? ""),
    pf: String(s.foulsPersonal ?? ""),
    pts: String(s.points ?? ""),
    plus_minus: String(s.plusMinusPoints ?? ""),
  };
}

function buildWnbaContext() {
  const box = fetchJson(boxUrl);
  const play = fetchJson(pbpUrl);
  const game = box.game;
  const home = game.homeTeam;
  const away = game.awayTeam;
  const clarkPlayer = home.players.find((player) => player.personId === 1642286 || player.name === "Caitlin Clark");
  const actions = play.game.actions || [];
  const normalizeAction = (action) => ({
    period: action.period === 5 ? "OT" : String(action.period),
    time: formatIsoClock(action.clock),
    score: `${action.scoreAway || ""}-${action.scoreHome || ""}`,
    awayPlay: action.teamTricode === away.teamTricode ? action.description || "" : "",
    homePlay: action.teamTricode === home.teamTricode ? action.description || "" : "",
    eventText: action.description || "",
    actionType: action.actionType || "",
    subType: action.subType || "",
    descriptor: action.descriptor || "",
    shotDistance: action.shotDistance ?? null,
    personId: action.personId ?? null,
    assistPersonId: action.assistPersonId ?? null,
    actionNumber: action.actionNumber,
  });

  const pbpRows = actions.map(normalizeAction);
  const clarkEventsRows = actions
    .filter((action) => action.personIdsFilter?.includes(1642286) || action.personId === 1642286 || action.assistPersonId === 1642286)
    .map(normalizeAction);
  const clarkMadeThreeRows = actions
    .filter((action) => action.personId === 1642286 && action.actionType === "3pt" && action.shotResult === "Made")
    .map(normalizeAction);
  const clarkAssistRows = actions
    .filter((action) => action.assistPersonId === 1642286)
    .map(normalizeAction);

  return {
    slug,
    createdAt: new Date().toISOString(),
    sourceName,
    sources: { boxUrl, pbpUrl },
    lineScore: [
      {
        team: away.teamCity ? `${away.teamCity} ${away.teamName}` : away.teamName,
        1: away.periods?.[0]?.score ?? "",
        2: away.periods?.[1]?.score ?? "",
        3: away.periods?.[2]?.score ?? "",
        4: away.periods?.[3]?.score ?? "",
        "1OT": away.periods?.[4]?.score ?? "",
        T: away.score,
      },
      {
        team: home.teamCity ? `${home.teamCity} ${home.teamName}` : home.teamName,
        1: home.periods?.[0]?.score ?? "",
        2: home.periods?.[1]?.score ?? "",
        3: home.periods?.[2]?.score ?? "",
        4: home.periods?.[3]?.score ?? "",
        "1OT": home.periods?.[4]?.score ?? "",
        T: home.score,
      },
    ],
    clark: {
      game: wnbaStats(clarkPlayer),
      q1: {},
      q4: {},
      ot: {},
    },
    clarkMadeThrees: clarkMadeThreeRows,
    clarkAssists: clarkAssistRows,
    clarkEvents: clarkEventsRows,
    pbp: pbpRows,
  };
}

function buildBasketballReferenceContext() {
  const boxHtml = fetchHtml(boxUrl);
  const pbpHtml = fetchHtml(pbpUrl);

  const indGame = parsePlayerTable(boxHtml, "box-IND-game-basic");
  const indQ1 = parsePlayerTable(boxHtml, "box-IND-q1-basic");
  const indQ4 = parsePlayerTable(boxHtml, "box-IND-q4-basic");
  const indOT = parsePlayerTable(boxHtml, "box-IND-ot1-basic");
  const lineScore = parseLineScore(boxHtml);
  const pbp = parsePbp(pbpHtml);

  const clarkName = "Caitlin Clark";
  const clark = {
    game: selectedStats(findPlayer(indGame, clarkName)),
    q1: selectedStats(findPlayer(indQ1, clarkName)),
    q4: selectedStats(findPlayer(indQ4, clarkName)),
    ot: selectedStats(findPlayer(indOT, clarkName)),
  };

  const clarkEvents = pbp.filter((row) => /C\. Clark/.test(row.eventText));
  const clarkMadeThrees = clarkEvents.filter((row) => /C\. Clark makes 3-pt/.test(row.eventText));
  const clarkAssists = pbp.filter((row) => /assist by C\. Clark/.test(row.eventText));

  return {
    slug,
    createdAt: new Date().toISOString(),
    sourceName,
    sources: { boxUrl, pbpUrl },
    lineScore,
    clark,
    clarkMadeThrees,
    clarkAssists,
    clarkEvents,
    pbp,
  };
}

const context = wnbaGameId ? buildWnbaContext() : buildBasketballReferenceContext();

const md = [];
md.push(`# Official Game Context - ${slug}`);
md.push("");
md.push(`Generated: ${context.createdAt}`);
md.push("");
md.push(`Source: ${sourceName}`);
md.push(`Box score: ${boxUrl}`);
md.push(`Play-by-play: ${pbpUrl}`);
md.push("");
md.push("## Line Score");
for (const row of context.lineScore) {
  md.push(`- ${row.team}: Q1 ${row["1"]}, Q2 ${row["2"]}, Q3 ${row["3"]}, Q4 ${row["4"]}, OT ${row["1OT"] || ""}, Final ${row.T}`);
}
md.push("");
md.push("## Caitlin Clark Box");
md.push(`- Game: ${context.clark.game.pts} PTS, ${context.clark.game.ast} AST, ${context.clark.game.trb} REB, ${context.clark.game.fg}-${context.clark.game.fga} FG, ${context.clark.game.fg3}-${context.clark.game.fg3a} 3PT, ${context.clark.game.ft}-${context.clark.game.fta} FT, ${context.clark.game.plus_minus} plus/minus`);
if (context.clark.q4.pts) md.push(`- Q4: ${context.clark.q4.pts} PTS, ${context.clark.q4.ast} AST, ${context.clark.q4.fg}-${context.clark.q4.fga} FG, ${context.clark.q4.fg3}-${context.clark.q4.fg3a} 3PT`);
if (context.clark.ot.pts) md.push(`- OT: ${context.clark.ot.pts} PTS, ${context.clark.ot.ast} AST, ${context.clark.ot.fg}-${context.clark.ot.fga} FG, ${context.clark.ot.fg3}-${context.clark.ot.fg3a} 3PT`);
md.push("");
md.push("## Clark Made Threes");
for (const row of context.clarkMadeThrees) md.push(`- Q${row.period} ${row.time} | ${row.score} | ${row.eventText}`);
md.push("");
md.push("## Clark Assists");
for (const row of context.clarkAssists) md.push(`- Q${row.period} ${row.time} | ${row.score} | ${row.eventText}`);
md.push("");
md.push("## Clark PBP Events");
for (const row of context.clarkEvents) md.push(`- Q${row.period} ${row.time} | ${row.score} | ${row.eventText}`);
md.push("");

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(context, null, 2)}\n`);
fs.writeFileSync(outMd, `${md.join("\n")}\n`);

console.log(`json=${outJson}`);
console.log(`markdown=${outMd}`);
