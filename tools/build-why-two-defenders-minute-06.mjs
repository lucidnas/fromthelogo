#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/minute-06-josh";
const VOICE = "/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/voice/josh-section-06";
const ASSETS = "/Volumes/SSK SSD/ftl/videos/why-two-defenders-still-doesnt-work/section-06-assets/production";
const SOURCE = "/Volumes/SSK SSD/ftl/videos/caitlin-clark-eight-minute-genius/assets/sources/portland-dime-mitchell.mp4";
const SOURCES = {
  portland: SOURCE,
  portlandSlow: path.join(ASSETS, "pdx-action215-release-slow-055x-muted.mp4"),
  atlantaLive: path.join(ASSETS, "atl-action579-live-muted-16x9.mp4"),
  atlantaReplay: path.join(ASSETS, "atl-action579-replay-muted-16x9.mp4"),
};
const STILLS = {
  release: path.join(ASSETS, "pdx-action215-freeze-release.jpg"),
  precatch: path.join(ASSETS, "pdx-action215-freeze-precatch.jpg"),
};
function duration(file){const r=spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",file],{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return Number(r.stdout.trim());}
function link(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});try{fs.unlinkSync(target);}catch(e){if(e.code!=="ENOENT")throw e;}fs.symlinkSync(source,target);}
function attrs(start,span,track=0){return `data-start="${start.toFixed(3)}" data-duration="${span.toFixed(3)}" data-track-index="${track}"`;}
function video(id,src,start,span,mediaStart=0,cls=""){return `<video id="${id}" class="clip footage ${cls}" ${attrs(start,span)} src="assets/${src}.mp4" data-media-start="${mediaStart.toFixed(3)}" muted playsinline></video>`;}
function freeze(id,src,start,span,cls=""){return `<img id="${id}" class="clip footage freeze ${cls}" ${attrs(start,span)} src="assets/${src}.jpg" alt="">`;}

fs.mkdirSync(path.join(ROOT,"assets"),{recursive:true});
for(const [name,source] of Object.entries(SOURCES))link(source,path.join(ROOT,"assets",`${name}.mp4`));
for(const [name,source] of Object.entries(STILLS))link(source,path.join(ROOT,"assets",`${name}.jpg`));
const voiceFiles=Array.from({length:3},(_,i)=>path.join(VOICE,`continuous-${String(i).padStart(2,"0")}.mp3`));
const voiceDurations=voiceFiles.map(duration);voiceFiles.forEach((source,i)=>link(source,path.join(ROOT,"assets",`vo-${i}.mp3`)));
const starts=[];let cursor=0;for(const span of voiceDurations){starts.push(cursor);cursor+=span;}const total=cursor+.3;

const visuals=[
  // Portland: live setup -> exact release freeze -> slow resume -> payoff -> reaction.
  video("pdx-setup","portland",starts[0],1.65,0,"vertical"),
  freeze("pdx-release-freeze","release",starts[0]+1.65,2.0,"vertical"),
  video("pdx-release-slow","portlandSlow",starts[0]+3.65,1.80,0,"vertical"),
  video("pdx-payoff","portland",starts[0]+5.45,2.20,2.65,"vertical"),
  video("pdx-reaction","portland",starts[0]+7.65,3.80,4.85,"vertical"),
  freeze("pdx-precatch-bridge","precatch",starts[0]+11.45,voiceDurations[0]-11.45,"vertical"),

  // Study the delivery once more through a held pre-catch frame, then move to a distinct verified example.
  freeze("pdx-precatch-study","precatch",starts[1],3.0,"vertical"),
  video("pdx-route-slow","portlandSlow",starts[1]+3.0,1.80,0,"vertical"),
  video("pdx-finish-study","portland",starts[1]+4.80,2.20,2.65,"vertical"),
  video("atlanta-live-comparison","atlantaLive",starts[1]+7.0,6.50,0),
  video("atlanta-replay-lead","atlantaReplay",starts[1]+13.50,voiceDurations[1]-13.50,0),

  // Fresh replay angle, then return to the Portland teaching frames for the synthesis.
  video("atlanta-replay","atlantaReplay",starts[2],5.50,0),
  freeze("pdx-route-receipt","release",starts[2]+5.50,3.0,"vertical"),
  freeze("pdx-destination-receipt","precatch",starts[2]+8.50,3.0,"vertical"),
  video("pdx-reaction-resolution","portland",starts[2]+11.50,voiceDurations[2]-11.50,4.85,"vertical"),
];
const audios=voiceFiles.map((_,i)=>`<audio id="voice-${i}" class="clip" ${attrs(starts[i],voiceDurations[i],10+i)} src="assets/vo-${i}.mp3" data-volume="1"></audio>`).join("\n");
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Why Two Defenders — Minute 06</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050608}.composition{position:relative;width:1920px;height:1080px;overflow:hidden;background:#050608}.footage{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;object-position:center;filter:saturate(1.08) contrast(1.035) brightness(1.02)}.vertical{left:555px;right:auto;width:810px;height:1080px;object-fit:cover;object-position:center;box-shadow:0 0 70px rgba(0,0,0,.8)}.vertical::before{content:"";position:absolute;inset:0}.side{position:absolute;inset:0;background:linear-gradient(90deg,#050608 0 28.8%,transparent 28.8% 71.2%,#050608 71.2%)}.edge{position:absolute;inset:0;box-shadow:inset 0 0 90px rgba(0,0,0,.28);pointer-events:none}</style></head><body><main id="why-two-defenders-minute-06" class="composition" data-composition-id="why-two-defenders-minute-06" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080"><div id="background-fill" class="clip" ${attrs(0,total,-1)} style="position:absolute;inset:0;background:#050608"></div>${visuals.join("\n")}${audios}<div id="edge-vignette" class="clip edge" ${attrs(0,total,20)}></div></main><script>window.__timelines=window.__timelines||{};window.__timelines["why-two-defenders-minute-06"]=gsap.timeline({paused:true});</script></body></html>`;
fs.writeFileSync(path.join(ROOT,"index.html"),html);fs.writeFileSync(path.join(ROOT,"hyperframes.json"),JSON.stringify({composition:"index.html",fps:30,width:1920,height:1080},null,2));fs.writeFileSync(path.join(ROOT,"meta.json"),JSON.stringify({title:"Why Guarding Caitlin Clark With Two Defenders Still Doesn't Work",section:"minute-06",duration:total,narration:"Josh",noMusic:true,noBroadcastAudio:true,noDrawings:true},null,2));console.log(JSON.stringify({root:ROOT,duration:total,starts,voiceDurations},null,2));
