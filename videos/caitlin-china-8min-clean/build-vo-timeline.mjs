#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const [,,scriptPath,workDir,whisperPath,outPath]=process.argv;
if(!outPath) throw new Error("Usage: node build-vo-timeline.mjs SCRIPT WORK_DIR WHISPER_JSON OUTPUT_JSON");
const script=fs.readFileSync(scriptPath,"utf8").trim();
const blocks=script.split(/\n\s*\[PAUSE:\s*[\d.]+\s*seconds?\]\s*\n/i).map(x=>x.trim()).filter(Boolean);
const pauses=[...script.matchAll(/\[PAUSE:\s*([\d.]+)\s*seconds?\]/gi)].map(x=>Number(x[1]));
const duration=file=>Number(spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",file],{encoding:"utf8"}).stdout.trim());
const whisper=JSON.parse(fs.readFileSync(whisperPath,"utf8"));
const words=(whisper.segments||[]).flatMap(s=>s.words||[]).map(w=>({word:w.word.trim(),start:w.start,end:w.end,probability:w.probability}));
let cursor=0;
const sections=blocks.map((text,i)=>{
 const audioFile=path.join(workDir,`chunk-${String(i+1).padStart(2,"0")}.mp3`);
 const audioDuration=duration(audioFile);
 const start=cursor,end=start+audioDuration;
 cursor=end+(pauses[i]||0);
 return {id:i===0?"B00-INTRO":i===16?"B16-OUTRO":`B${String(i).padStart(2,"0")}-PLAY-${String(i).padStart(2,"0")}`,playNumber:i>0&&i<16?i:null,text,audioFile:path.basename(audioFile),start:Number(start.toFixed(3)),end:Number(end.toFixed(3)),duration:Number(audioDuration.toFixed(3)),pauseAfter:Number((pauses[i]||0).toFixed(3))};
});
const masterDuration=duration(path.join(path.dirname(workDir),"vo-master.mp3"));
fs.writeFileSync(outPath,JSON.stringify({schemaVersion:1,voice:{name:"Josh Australian",voiceId:"YCMlNeY0UBmxCWADNMyB",modelId:"eleven_v3",speed:1},masterDuration:Number(masterDuration.toFixed(3)),sections,words},null,2)+"\n");
console.log(outPath);
