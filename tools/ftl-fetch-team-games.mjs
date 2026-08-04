#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
const args=new Map(); for(let i=2;i<process.argv.length;i+=2) args.set(process.argv[i].slice(2),process.argv[i+1]);
const season=args.get("season"), seasonType=args.get("season-type"), team=args.get("team"), gameIds=args.get("game-ids"), outDir=args.get("out-dir");
if(gameIds && !outDir) throw new Error("--out-dir is required with --game-ids");
if(!gameIds && (!season||!seasonType||!team)) throw new Error("--season, --season-type and --team are required");
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--disable-blink-features=AutomationControlled"]});
try {
 const page=await browser.newContext({userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36"}).then(c=>c.newPage());
 await page.goto("https://www.wnba.com",{waitUntil:"domcontentloaded",timeout:45000});
 await page.goto("https://stats.wnba.com",{waitUntil:"domcontentloaded",timeout:45000});
 if(gameIds){
  fs.mkdirSync(outDir,{recursive:true});
  for(const gameId of gameIds.split(",").filter(Boolean)){
   const data=await page.evaluate(async gameId=>{
    const get=async url=>{const r=await fetch(url); if(!r.ok) throw new Error(`${r.status} ${url}`); return r.json();};
    return {box:await get(`https://cdn.wnba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`),pbp:await get(`https://cdn.wnba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`)};
   },gameId);
   fs.writeFileSync(path.join(outDir,`${gameId}.json`),JSON.stringify(data));
  }
  process.stdout.write(JSON.stringify({downloaded:gameIds.split(",").filter(Boolean).length}));
 } else {
 const rows=await page.evaluate(async ({season,seasonType,team})=>{
  const u=`https://stats.wnba.com/stats/teamgamelog?TeamID=${team}&Season=${season}&SeasonType=${encodeURIComponent(seasonType)}&LeagueID=10`;
  const r=await fetch(u,{headers:{"x-nba-stats-token":"true","x-nba-stats-origin":"stats","Referer":"https://www.wnba.com/"}});
  if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const d=await r.json(),s=d.resultSets[0],ix=Object.fromEntries(s.headers.map((h,i)=>[h,i]));
  return s.rowSet.map(x=>({game_id:String(x[ix.Game_ID]),date:x[ix.GAME_DATE],matchup:x[ix.MATCHUP],wl:x[ix.WL]}));
 },{season,seasonType,team});
 process.stdout.write(JSON.stringify(rows)); }
} finally { await browser.close(); }
