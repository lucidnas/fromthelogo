#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const production = process.env.FTL_PRODUCTION_DIR;
if (!production) throw new Error("FTL_PRODUCTION_DIR is required");
const root = path.dirname(new URL(import.meta.url).pathname);
const assets = path.join(root,"assets");
const work = path.join(root,".build");
const segments = path.join(work,"segments");
fs.mkdirSync(assets,{recursive:true}); fs.mkdirSync(segments,{recursive:true}); fs.mkdirSync(path.join(root,"renders"),{recursive:true});
const edl = JSON.parse(fs.readFileSync(path.join(production,"edl.json"),"utf8"));
const game = path.join(production,"sources/official/FIBA-4mhTX8ETAeY.mp4");
const press = path.join(production,"sources/official/postgame/USA-Basketball-mWNTPDreG1k.mp4");
const vo = path.join(production,"audio/chronological-recap-v5-josh-normal/vo-master-postgame-final.mp3");
const music = path.join(production,"audio/music/Illusions - Anno Domini Beats.mp3");
for (const file of [game,press,vo,music]) if (!fs.existsSync(file)) throw new Error(`Missing required bundled asset: ${file}`);
function run(args){const result=spawnSync("ffmpeg",args,{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
const common="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30";
const outputs=[]; const schedule=[];
for (const [beatIndex,beat] of edl.beats.entries()) {
  const beatParts=[];
  for (const [opIndex,operation] of beat.pictureOperations.entries()) {
    const source = beat.source.asset === "official-postgame" || operation.kind === "closing-receipt" || operation.kind === "transition" ? press : game;
    const duration = operation.programRelative.out-operation.programRelative.in;
    const file=path.join(segments,`${String(beatIndex).padStart(2,"0")}-${String(opIndex).padStart(2,"0")}.mp4`);
    if(operation.speed===0){
      run(["-y","-hide_banner","-loglevel","error","-ss",String(operation.source.in),"-i",source,"-frames:v","1","-vf",`${common},tpad=stop_mode=clone:stop_duration=${duration.toFixed(3)}`,"-t",duration.toFixed(3),"-an","-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p",file]);
    } else {
      run(["-y","-hide_banner","-loglevel","error","-ss",String(operation.source.in),"-to",String(operation.source.out),"-i",source,"-an","-vf",`${common},setpts=(PTS-STARTPTS)/${operation.speed}`,"-t",duration.toFixed(3),"-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p",file]);
    }
    beatParts.push(file);
  }
  const list=path.join(work,`beat-${String(beatIndex).padStart(2,"0")}.txt`); fs.writeFileSync(list,beatParts.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join("\n"));
  const output=path.join(work,`beat-${String(beatIndex).padStart(2,"0")}.mp4`); run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",list,"-c","copy",output]);
  outputs.push(output); schedule.push({id:beat.id,start:beat.program.in,duration:beat.program.out-beat.program.in,editorialRole:beat.editorialRole,treatment:beat.treatment});
}
const pictureList=path.join(work,"picture.txt"); fs.writeFileSync(pictureList,outputs.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join("\n"));
const picture=path.join(work,"picture.mp4"); run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",pictureList,"-c","copy",picture]);
const clean=path.join(root,"renders/caitlin-clark-vs-china-8min-clean.mp4");
run(["-y","-hide_banner","-loglevel","error","-i",picture,"-i",vo,"-i",press,"-stream_loop","-1","-i",music,"-filter_complex",`[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[vo];[2:a]atrim=start=35.48:end=41.92,asetpts=PTS-STARTPTS[p1];[2:a]atrim=start=120.36:end=138.18,asetpts=PTS-STARTPTS[p2];[2:a]atrim=start=145.72:end=167.14,asetpts=PTS-STARTPTS[p3];[p1][p2][p3]concat=n=3:v=0:a=1,adelay=396860|396860,loudnorm=I=-16:TP=-1.5:LRA=11[press];[3:a]atrim=0:${edl.duration},volume=0.06[music];[vo][press][music]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95[a]`,"-map","0:v","-map","[a]","-t",String(edl.duration),"-c:v","copy","-c:a","aac","-ar","48000","-b:a","192k","-movflags","+faststart",clean]);
fs.copyFileSync(clean,path.join(assets,"clean-base-8min.mp4"));
fs.writeFileSync(path.join(assets,"timeline.json"),`${JSON.stringify({duration:edl.duration,schedule},null,2)}\n`);
console.log(clean);
