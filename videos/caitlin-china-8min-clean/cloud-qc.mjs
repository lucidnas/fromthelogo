#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
const root=path.dirname(new URL(import.meta.url).pathname);
const renderDir=path.join(root,"renders");
const files=(process.env.FTL_QC_FILES||"caitlin-clark-vs-china-8min-clean.mp4,caitlin-clark-vs-china-8min-hyperframes.mp4").split(",").filter(Boolean);
const cleanOnly=files.length===1;
const manifestName=process.env.FTL_QC_MANIFEST||"qc-manifest.json";
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const probe=file=>JSON.parse(spawnSync("ffprobe",["-v","error","-show_streams","-show_format","-of","json",file],{encoding:"utf8",maxBuffer:20e6}).stdout);
const silence=file=>spawnSync("ffmpeg",["-hide_banner","-i",file,"-af","silencedetect=noise=-45dB:d=1.0","-f","null","-"],{encoding:"utf8",maxBuffer:20e6}).stderr.split("\n").filter(line=>line.includes("silence_")).map(line=>line.trim());
const keyframes=file=>{
  const packets=spawnSync("ffprobe",["-v","error","-select_streams","v:0","-show_entries","packet=pts_time,flags","-of","csv=p=0",file],{encoding:"utf8",maxBuffer:50e6}).stdout.split("\n").filter(line=>line.includes("K")).map(line=>Number(line.split(",")[0])).filter(Number.isFinite);
  let maxInterval=0;
  for(let i=1;i<packets.length;i++) maxInterval=Math.max(maxInterval,packets[i]-packets[i-1]);
  return {keyframeCount:packets.length,maxKeyframeInterval:Number(maxInterval.toFixed(3))};
};
const artifacts=files.map(name=>{const file=path.join(renderDir,name);const data=probe(file);const video=data.streams.find(stream=>stream.codec_type==="video");const audio=data.streams.find(stream=>stream.codec_type==="audio");return {name,sizeBytes:fs.statSync(file).size,sha256:sha(file),duration:Number(data.format.duration),videoDuration:Number(video.duration),audioDuration:audio?Number(audio.duration):null,frameCount:Number(video.nb_frames),resolution:`${video.width}x${video.height}`,videoCodec:video.codec_name,audioCodec:audio?.codec_name??null,...keyframes(file),silenceFindings:silence(file)};});
const durationDelta=cleanOnly?0:Math.abs(artifacts[0].duration-artifacts[1].duration);
const streamGap=Math.max(...artifacts.map(item=>Math.abs(item.videoDuration-(item.audioDuration??item.videoDuration))));
const expected=Number(process.env.FTL_QC_EXPECTED_DURATION||481.99);
const expectedGap=Math.max(...artifacts.map(item=>Math.abs(item.videoDuration-expected)));
const avSyncFinding=streamGap<=0.1?"Automated duration/stream check passed; video and audio streams cover the same span. Final human audiovisual review still required before publication.":`FAIL: video and audio stream durations differ by ${streamGap.toFixed(3)}s in at least one master.`;
const comparisonFinding=cleanOnly?"N/A: clean-only QC; not paired with the revision-3 HyperFrames comparison master.":durationDelta<=0.05?"PASS: labeled and clean masters have matching durations.":"FAIL: duration mismatch.";
const expectedFinding=expectedGap<=0.1?`PASS: video stream lands within 0.1s of the canonical ${expected}s timeline.`:`FAIL: a video stream is ${expectedGap.toFixed(3)}s away from the canonical ${expected}s timeline.`;
const maxGop=Math.max(...artifacts.map(item=>item.maxKeyframeInterval??0));
const expectedFrames=Math.round(expected*30);
const frameFinding=artifacts.every(item=>item.frameCount===expectedFrames)?`PASS: ${expectedFrames.toLocaleString("en-US")} frames.`:`FAIL: expected ${expectedFrames.toLocaleString("en-US")} frames; got ${artifacts.map(item=>item.frameCount).join(" / ")}.`;
const gopFinding=maxGop<=1.05?`PASS: densest keyframe interval is ${maxGop.toFixed(3)}s (GOP 30 / 1.00s target).`:`FAIL: sparse keyframes; max interval ${maxGop.toFixed(3)}s exceeds 1.05s.`;
const output={schemaVersion:"1.1",generatedAt:new Date().toISOString(),mode:cleanOnly?"clean-only":"comparison",revision:process.env.FTL_QC_REVISION||null,expectedDuration:expected,artifacts,durationDelta,streamGap,expectedGap,maxGop,avSyncFinding,comparisonFinding,expectedFinding,frameFinding,gopFinding,cursorArtifacts:files.concat(manifestName).map(name=>({path:`artifacts/${name}`,sizeBytes:name.endsWith(".json")?null:artifacts.find(item=>item.name===name)?.sizeBytes??null}))};
const manifest=path.join(renderDir,manifestName);
fs.writeFileSync(manifest,`${JSON.stringify(output,null,2)}\n`);
output.cursorArtifacts.find(item=>item.path.endsWith(manifestName)).sizeBytes=fs.statSync(manifest).size;
fs.writeFileSync(manifest,`${JSON.stringify(output,null,2)}\n`);
console.log(manifest);
if([avSyncFinding,comparisonFinding,expectedFinding,frameFinding,gopFinding].some(finding=>finding.startsWith("FAIL"))){
  console.error(JSON.stringify({avSyncFinding,comparisonFinding,expectedFinding,frameFinding,gopFinding},null,2));
  process.exit(1);
}
