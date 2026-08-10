#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/minute-04-josh";
const VOICE = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/josh-section-04";
const PREP = "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute04";
const SOURCES = {
  portland: "/Volumes/SSK SSD/ftl/videos/2026-08-01/clark-portland-triple-double-longform/assets/short-deep-three.mp4",
  portlandSlow: path.join(PREP, "portland-release-slow.mp4"),
  portlandAlt: path.join(PREP, "portland-alt-slow.mp4"),
  conDeep: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/source-yFs4tjhvJ58.mp4",
  atlLive: "/Volumes/SSK SSD/ftl/videos/why-two-defenders-still-doesnt-work/section-06-assets/production/atl-action579-live-muted-16x9.mp4",
  minBackdoor: "/Volumes/SSK SSD/ftl/research/daniel-li-bank/sections-08-09/sources/min-q4-0333-mitchell-reverse-landscape.mp4",
};
const STILLS = {
  cushion: path.join(PREP, "portland-cushion.jpg"),
  gather: path.join(PREP, "portland-gather.jpg"),
  reaction: path.join(PREP, "portland-reaction.jpg"),
  atlHigh: "/Volumes/SSK SSD/ftl/workflows/clip-first-clark-celebration/examples/why-two-defenders-still-doesnt-work/sources/prepared-minute01-v2/atl-high-freeze.jpg",
};
function duration(file){const r=spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",file],{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return Number(r.stdout.trim());}
function link(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});try{fs.unlinkSync(target);}catch(e){if(e.code!=="ENOENT")throw e;}fs.symlinkSync(source,target);}
function attrs(start,span,track=0){return `data-start="${start.toFixed(3)}" data-duration="${span.toFixed(3)}" data-track-index="${track}"`;}
function video(id,src,start,span,mediaStart=0,cls=""){return `<video id="${id}" class="clip footage ${cls}" ${attrs(start,span)} src="assets/${src}.mp4" data-media-start="${mediaStart.toFixed(3)}" muted playsinline></video>`;}
function freeze(id,src,start,span,cls=""){return `<img id="${id}" class="clip footage ${cls}" ${attrs(start,span)} src="assets/${src}.jpg" alt="">`;}
fs.mkdirSync(path.join(ROOT,"assets"),{recursive:true});for(const [n,s] of Object.entries(SOURCES))link(s,path.join(ROOT,"assets",`${n}.mp4`));for(const [n,s] of Object.entries(STILLS))link(s,path.join(ROOT,"assets",`${n}.jpg`));
const voiceFiles=Array.from({length:3},(_,i)=>path.join(VOICE,`continuous-${String(i).padStart(2,"0")}.mp3`));const voiceDurations=voiceFiles.map(duration);voiceFiles.forEach((s,i)=>link(s,path.join(ROOT,"assets",`vo-${i}.mp3`)));const starts=[];let cursor=0;for(const d of voiceDurations){starts.push(cursor);cursor+=d;}const total=cursor+.3;
const visuals=[
  // One live approach, one freeze on the pickup cushion, then a slow release and real-time make.
  video("portland-approach","portland",starts[0],6.0,0),
  freeze("portland-cushion-freeze","cushion",starts[0]+6.0,3.0),
  video("portland-release-slow","portlandSlow",starts[0]+9.0,5.0,0),
  video("portland-make","portland",starts[0]+14.0,voiceDurations[0]-14.0,8.5),

  // Study the same geometry through distinct views rather than restarting the live angle.
  freeze("portland-cushion-analysis","cushion",starts[1],3.0,"wide"),
  video("portland-alternate","portlandAlt",starts[1]+3.0,3.54,0),
  video("connecticut-range-study","conDeep",starts[1]+6.54,5.0,31.55),
  freeze("atlanta-high-show-study","atlHigh",starts[1]+11.54,3.0),
  video("portland-reaction-study","portland",starts[1]+14.54,voiceDurations[1]-14.54,8.5),

  // Three concise receipts for the synthesis: range, high show, result.
  video("atlanta-space-payoff","atlLive",starts[2],6.5,0),
  video("minnesota-space-payoff","minBackdoor",starts[2]+6.5,voiceDurations[2]-6.5,0),
];
const audios=voiceFiles.map((_,i)=>`<audio id="voice-${i}" class="clip" ${attrs(starts[i],voiceDurations[i],10+i)} src="assets/vo-${i}.mp3" data-volume="1"></audio>`).join("\n");
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders — Minute 04</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050608}.composition{position:relative;width:1920px;height:1080px;overflow:hidden}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;object-position:center;filter:saturate(1.08) contrast(1.035) brightness(1.02)}.gather-crop{transform:scale(1.08);object-position:46% 50%}.defender-crop{transform:scale(1.08);object-position:61% 50%}.reaction-crop{transform:scale(1.07);object-position:58% 50%}.edge{position:absolute;inset:0;box-shadow:inset 0 0 90px rgba(0,0,0,.22);pointer-events:none}</style></head><body><main id="why-two-defenders-minute-04" class="composition" data-composition-id="why-two-defenders-minute-04" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080"><div id="background-fill" class="clip" ${attrs(0,total,-1)} style="position:absolute;inset:0;background:#050608"></div>${visuals.join("\n")}${audios}<div id="edge-vignette" class="clip edge" ${attrs(0,total,20)}></div></main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-minute-04"]=gsap.timeline({paused:true});</script></body></html>`;
fs.writeFileSync(path.join(ROOT,"index.html"),html);fs.writeFileSync(path.join(ROOT,"hyperframes.json"),JSON.stringify({composition:"index.html",fps:30,width:1920,height:1080},null,2));fs.writeFileSync(path.join(ROOT,"meta.json"),JSON.stringify({title:"Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work",section:"minute-04",duration:total,narration:"Josh",noMusic:true,noBroadcastAudio:true,noDrawings:true},null,2));console.log(JSON.stringify({root:ROOT,duration:total,starts,voiceDurations},null,2));
