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
function framesFor(seconds){return Math.round(seconds*30);}
const common="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30";
const encode=["-an","-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-g","30","-keyint_min","30","-pix_fmt","yuv420p"];
const outputs=[]; const schedule=[];
function renderStageProgression(operation,duration,file){
  const clips=operation.sourceAssets.map((item)=>path.join(production,item.path));
  for(const clip of clips) if(!fs.existsSync(clip)) throw new Error(`Missing stage-progression asset: ${clip}`);
  const items=operation.sourceAssets;
  const filters=items.map((item,index)=>`[${index}:v]trim=start=${item.in}:end=${item.out},setpts=PTS-STARTPTS,scale=640:360:force_original_aspect_ratio=increase,crop=640:360,fps=30,tpad=stop_mode=clone:stop_duration=${duration}[p${index}]`);
  filters.push(`[p0][p1][p2]hstack=inputs=3,scale=1920:1080,setsar=1,trim=duration=${duration}[v]`);
  const args=["-y","-hide_banner","-loglevel","error"];
  for(const clip of clips) args.push("-i",clip);
  run([...args,"-filter_complex",filters.join(";"),"-map","[v]","-frames:v",String(framesFor(duration)),...encode,file]);
}
function renderAwardGrid(operation,duration,file){
  const images=operation.sourceAssets.map((item)=>path.join(production,item.path));
  for(const image of images) if(!fs.existsSync(image)) throw new Error(`Missing award image: ${image}`);
  const filter=`color=c=#07101f:s=1920x1080:d=${duration}[bg];[0:v]scale=850:850:force_original_aspect_ratio=decrease,pad=850:850:(ow-iw)/2:(oh-ih)/2:color=#111827[a];[1:v]scale=850:850:force_original_aspect_ratio=decrease,pad=850:850:(ow-iw)/2:(oh-ih)/2:color=#111827[b];[bg][a]overlay=70:115[tmp];[tmp][b]overlay=1000:115,trim=duration=${duration},fps=30,setsar=1[v]`;
  run(["-y","-hide_banner","-loglevel","error","-loop","1","-i",images[0],"-loop","1","-i",images[1],"-filter_complex",filter,"-map","[v]","-frames:v",String(framesFor(duration)),...encode,file]);
}
for (const [beatIndex,beat] of edl.beats.entries()) {
  const beatParts=[];
  for (const [opIndex,operation] of beat.pictureOperations.entries()) {
    const source = beat.source.asset === "official-postgame" || operation.kind === "closing-receipt" || operation.kind === "transition" ? press : game;
    const duration = operation.programRelative.out-operation.programRelative.in;
    const file=path.join(segments,`${String(beatIndex).padStart(2,"0")}-${String(opIndex).padStart(2,"0")}.mp4`);
    if(operation.kind==="stage-progression-grid"){
      renderStageProgression(operation,duration,file);
    } else if(operation.treatmentType==="award-grid"){
      renderAwardGrid(operation,duration,file);
    // tpad first so a later -frames:v cap cannot collapse cloned freeze/hold frames.
    } else if(operation.speed===0){
      run(["-y","-hide_banner","-loglevel","error","-ss",String(operation.source.in),"-i",source,"-vf",`trim=end_frame=1,setpts=PTS-STARTPTS,${common},tpad=stop_mode=clone:stop_duration=${duration.toFixed(3)}`,"-frames:v",String(framesFor(duration)),...encode,file]);
    } else {
      run(["-y","-hide_banner","-loglevel","error","-ss",String(operation.source.in),"-to",String(operation.source.out),"-i",source,"-vf",`${common},setpts=(PTS-STARTPTS)/${operation.speed},tpad=stop_mode=clone:stop_duration=${duration.toFixed(3)}`,"-frames:v",String(framesFor(duration)),...encode,file]);
    }
    beatParts.push(file);
  }
  const beatDuration=beat.program.out-beat.program.in;
  const list=path.join(work,`beat-${String(beatIndex).padStart(2,"0")}.txt`); fs.writeFileSync(list,beatParts.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join("\n"));
  const output=path.join(work,`beat-${String(beatIndex).padStart(2,"0")}.mp4`);
  run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",list,"-vf",`fps=30,tpad=stop_mode=clone:stop_duration=${beatDuration.toFixed(3)}`,"-frames:v",String(framesFor(beatDuration)),...encode,output]);
  outputs.push(output); schedule.push({id:beat.id,start:beat.program.in,duration:beatDuration,editorialRole:beat.editorialRole,treatment:beat.treatment});
}
const pictureList=path.join(work,"picture.txt"); fs.writeFileSync(pictureList,outputs.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join("\n"));
const pictureRaw=path.join(work,"picture-raw.mp4");
const picture=path.join(work,"picture.mp4");
run(["-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",pictureList,"-c","copy",pictureRaw]);
run(["-y","-hide_banner","-loglevel","error","-i",pictureRaw,"-vf",`fps=30,tpad=stop_mode=clone:stop_duration=${edl.duration}`,"-frames:v",String(framesFor(edl.duration)),...encode,picture]);
const clean=process.env.FTL_CLEAN_OUTPUT||path.join(root,"renders/caitlin-clark-vs-china-8min-clean.mp4");
run(["-y","-hide_banner","-loglevel","error","-i",picture,"-i",vo,"-i",press,"-stream_loop","-1","-i",music,"-filter_complex",`[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[vo];[2:a]atrim=start=35.48:end=41.92,asetpts=PTS-STARTPTS[p1];[2:a]atrim=start=120.36:end=138.18,asetpts=PTS-STARTPTS[p2];[2:a]atrim=start=145.72:end=167.14,asetpts=PTS-STARTPTS[p3];[p1][p2][p3]concat=n=3:v=0:a=1,adelay=396860|396860,loudnorm=I=-16:TP=-1.5:LRA=11[press];[3:a]atrim=0:${edl.duration},volume=0.06[music];[vo][press][music]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95[a]`,"-map","0:v","-map","[a]","-t",String(edl.duration),"-c:v","libx264","-preset","veryfast","-crf","18","-r","30","-g","30","-keyint_min","30","-pix_fmt","yuv420p","-c:a","aac","-ar","48000","-b:a","192k","-movflags","+faststart",clean]);
fs.copyFileSync(clean,path.join(assets,"clean-base-8min.mp4"));
fs.writeFileSync(path.join(assets,"timeline.json"),`${JSON.stringify({duration:edl.duration,schedule},null,2)}\n`);
console.log(clean);
