#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const production=process.env.FTL_PRODUCTION_DIR;
if(!production) throw new Error("FTL_PRODUCTION_DIR is required");
const root=path.dirname(new URL(import.meta.url).pathname);
const timeline=JSON.parse(fs.readFileSync(path.join(root,"assets/timeline.json"),"utf8"));
const manifest=JSON.parse(fs.readFileSync(path.join(production,"selected-play-manifest-v2.json"),"utf8"));
const source=process.env.FTL_SOURCE_VIDEO||manifest.sourcePath;
const master=path.join(root,"assets/clean-base-8min.mp4");
const work=path.join(root,".audio-build");
fs.mkdirSync(work,{recursive:true});

function run(args){const p=spawnSync("ffmpeg",args,{stdio:"inherit"});if(p.status!==0)process.exit(p.status??1);}
function silence(file,duration){run(["-y","-hide_banner","-loglevel","error","-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t",duration.toFixed(3),"-c:a","pcm_s16le",file]);}
function sourceAudio(file,start,duration,tempo=1){
 const filters=["aresample=48000","aformat=channel_layouts=stereo"];
 if(tempo!==1)filters.push(`atempo=${tempo}`);
 run(["-y","-hide_banner","-loglevel","error","-ss",start.toFixed(3),"-i",source,"-t",duration.toFixed(3),"-vn","-af",filters.join(","),"-c:a","pcm_s16le",file]);
}

const parts=[];
const intro=timeline.schedule[0];
sourceAudio(path.join(work,"00.wav"),44,intro.rawDuration);parts.push(path.join(work,"00.wav"));
for(const play of manifest.plays){
 const schedule=timeline.schedule.find(x=>x.kind==="play"&&x.playNumber===play.playNumber);
 const setup=play.freezeFrame-play.sourceIn;
 const slowSource=play.sourceOut-play.sourceIn;
 const pad=Math.max(0,schedule.rawDuration-setup-5-(slowSource/0.70));
 const prefix=String(play.playNumber).padStart(2,"0");
 const setupFile=path.join(work,`${prefix}-setup.wav`);sourceAudio(setupFile,play.sourceIn,setup);parts.push(setupFile);
 const freezeFile=path.join(work,`${prefix}-freeze.wav`);silence(freezeFile,5);parts.push(freezeFile);
 const slowFile=path.join(work,`${prefix}-slow.wav`);sourceAudio(slowFile,play.sourceIn,slowSource,0.70);parts.push(slowFile);
 if(pad>0.02){const padFile=path.join(work,`${prefix}-pad.wav`);silence(padFile,pad);parts.push(padFile);}
}
const outro=timeline.schedule.at(-1);const outroFile=path.join(work,"16.wav");sourceAudio(outroFile,300,outro.rawDuration);parts.push(outroFile);
const list=path.join(work,"list.txt");fs.writeFileSync(list,parts.map(f=>`file '${f.replaceAll("'","'\\''")}'`).join("\n"));
const raw=path.join(work,"game-raw.wav");run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",list,"-c","copy",raw]);
const output=path.join(root,"assets/clean-base-8min-with-game-audio.mp4");
run(["-y","-hide_banner","-loglevel","error","-i",master,"-i",raw,"-filter_complex",`[1:a]atempo=${timeline.factor},volume=0.20[game];[0:a][game]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-t","480","-movflags","+faststart",output]);
fs.renameSync(output,master);
console.log(master);
