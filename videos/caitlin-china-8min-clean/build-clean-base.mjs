#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
const production=process.env.FTL_PRODUCTION_DIR;
if(!production) throw new Error("FTL_PRODUCTION_DIR is required");
const manifest=JSON.parse(fs.readFileSync(path.join(production,"selected-play-manifest-v2.json"),"utf8"));
const source=process.env.FTL_SOURCE_VIDEO||manifest.sourcePath;
const voiceRoot=path.join(production,"audio/chronological-recap-v4-8min");
const work=fs.readdirSync(voiceRoot).filter(n=>n.startsWith("vo-johnny-pause-work-")).sort().at(-1);
if(!work) throw new Error("Narration chunks are missing");
const root=path.dirname(new URL(import.meta.url).pathname);
const assets=path.join(root,"assets");const workDir=path.join(root,".build");const beatDir=path.join(workDir,"beats");
fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(beatDir,{recursive:true});
function run(a){const r=spawnSync("ffmpeg",a,{stdio:"inherit"});if(r.status!==0)process.exit(r.status??1);}
function dur(f){return Number(spawnSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",f],{encoding:"utf8"}).stdout.trim());}
const common="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1";
const chunks=Array.from({length:17},(_,i)=>path.join(voiceRoot,work,`chunk-${String(i+1).padStart(2,"0")}.mp3`));
const beats=[];const schedule=[];let rawCursor=0;
function add(file,entry){beats.push(file);schedule.push({...entry,rawStart:rawCursor});rawCursor+=entry.rawDuration;}
const introDuration=dur(chunks[0])+2;const intro=path.join(beatDir,"beat-00.mp4");
run(["-y","-hide_banner","-loglevel","error","-stream_loop","-1","-ss","44","-i",source,"-t",introDuration.toFixed(3),"-an","-vf",common,"-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-pix_fmt","yuv420p",intro]);add(intro,{kind:"intro",rawDuration:introDuration});
for(const p of manifest.plays){
 const setup=p.freezeFrame-p.sourceIn,hold=5,slow=(p.sourceOut-p.sourceIn)/0.70,base=setup+hold+slow,target=Math.max(base,dur(chunks[p.playNumber])+2),pad=target-base;
 const file=path.join(beatDir,`beat-${String(p.playNumber).padStart(2,"0")}.mp4`);
 const filter=[`[0:v]trim=start=${p.sourceIn}:end=${p.freezeFrame},setpts=PTS-STARTPTS,${common}[a]`,`[0:v]trim=start=${p.freezeFrame}:end=${p.freezeFrame+0.04},setpts=PTS-STARTPTS,${common},tpad=stop_mode=clone:stop_duration=4.96[b]`,`[0:v]trim=start=${p.sourceIn}:end=${p.sourceOut},setpts=(PTS-STARTPTS)/0.70,${common}[c]`,`[a][b][c]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=${pad}[v]`].join(";");
 run(["-y","-hide_banner","-loglevel","error","-i",source,"-filter_complex",filter,"-map","[v]","-an","-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-pix_fmt","yuv420p",file]);
 add(file,{kind:"play",playNumber:p.playNumber,label:p.label,period:p.period,gameClock:p.gameClock,type:p.type,read:p.read,rawDuration:target,freezeRawStart:setup,freezeRawDuration:hold,slowRawStart:setup+hold,slowRawDuration:slow});
}
const outroDuration=dur(chunks[16]);const outro=path.join(beatDir,"beat-16.mp4");
run(["-y","-hide_banner","-loglevel","error","-stream_loop","-1","-ss","300","-i",source,"-t",outroDuration.toFixed(3),"-an","-vf",common,"-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-pix_fmt","yuv420p",outro]);add(outro,{kind:"outro",rawDuration:outroDuration});
const pictureList=path.join(workDir,"picture.txt");fs.writeFileSync(pictureList,beats.map(f=>`file '${f.replaceAll("'","'\\''")}'`).join("\n"));
const rawPicture=path.join(workDir,"picture-raw.mp4");run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",pictureList,"-c","copy",rawPicture]);
const audioParts=[];for(let i=0;i<17;i++){audioParts.push(chunks[i]);const gap=Math.max(0,schedule[i].rawDuration-dur(chunks[i]));if(gap>.03){const s=path.join(workDir,`gap-${i}.wav`);run(["-y","-hide_banner","-loglevel","error","-f","lavfi","-i","anullsrc=r=48000:cl=mono","-t",gap.toFixed(3),s]);audioParts.push(s);}}
const aa=["-y","-hide_banner","-loglevel","error"];audioParts.forEach(f=>aa.push("-i",f));const chains=audioParts.map((_,i)=>`[${i}:a]aresample=48000,asetpts=PTS-STARTPTS[a${i}]`).join(";");const ins=audioParts.map((_,i)=>`[a${i}]`).join("");const rawVoice=path.join(workDir,"voice-raw.m4a");aa.push("-filter_complex",`${chains};${ins}concat=n=${audioParts.length}:v=0:a=1[a]`,"-map","[a]","-c:a","aac","-b:a","192k",rawVoice);run(aa);
const factor=rawCursor/480;const clean=path.join(assets,"clean-base-8min.mp4");
run(["-y","-hide_banner","-loglevel","error","-i",rawPicture,"-i",rawVoice,"-filter_complex",`[0:v]setpts=PTS/${factor}[v];[1:a]atempo=${factor},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,"-map","[v]","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-pix_fmt","yuv420p","-c:a","aac","-ar","48000","-b:a","192k","-t","480","-movflags","+faststart",clean]);
const scaled=schedule.map(x=>({...x,start:x.rawStart/factor,duration:x.rawDuration/factor,freezeStart:x.freezeRawStart==null?null:(x.rawStart+x.freezeRawStart)/factor,freezeDuration:x.freezeRawDuration==null?null:x.freezeRawDuration/factor,slowStart:x.slowRawStart==null?null:(x.rawStart+x.slowRawStart)/factor,slowDuration:x.slowRawDuration==null?null:x.slowRawDuration/factor}));
fs.writeFileSync(path.join(assets,"timeline.json"),JSON.stringify({duration:480,factor,schedule:scaled},null,2)+"\n");console.log(clean);
