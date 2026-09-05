#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
const root=path.dirname(new URL(import.meta.url).pathname);
const renderDir=path.join(root,"renders");
const files=["caitlin-clark-vs-china-8min-clean.mp4","caitlin-clark-vs-china-8min-hyperframes.mp4"];
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const probe=file=>JSON.parse(spawnSync("ffprobe",["-v","error","-show_streams","-show_format","-of","json",file],{encoding:"utf8",maxBuffer:20e6}).stdout);
const silence=file=>spawnSync("ffmpeg",["-hide_banner","-i",file,"-af","silencedetect=noise=-45dB:d=1.0","-f","null","-"],{encoding:"utf8",maxBuffer:20e6}).stderr.split("\n").filter(line=>line.includes("silence_")).map(line=>line.trim());
const artifacts=files.map(name=>{const file=path.join(renderDir,name);const data=probe(file);const video=data.streams.find(stream=>stream.codec_type==="video");const audio=data.streams.find(stream=>stream.codec_type==="audio");return {name,sizeBytes:fs.statSync(file).size,sha256:sha(file),duration:Number(data.format.duration),videoDuration:Number(video.duration),audioDuration:audio?Number(audio.duration):null,frameCount:Number(video.nb_frames),resolution:`${video.width}x${video.height}`,videoCodec:video.codec_name,audioCodec:audio?.codec_name??null,silenceFindings:silence(file)};});
const durationDelta=Math.abs(artifacts[0].duration-artifacts[1].duration);
const streamGap=Math.max(...artifacts.map(item=>Math.abs(item.videoDuration-(item.audioDuration??item.videoDuration))));
const expected=481.99;
const expectedGap=Math.max(...artifacts.map(item=>Math.abs(item.videoDuration-expected)));
const avSyncFinding=streamGap<=0.1?"Automated duration/stream check passed; video and audio streams cover the same span in both masters. Final human audiovisual review still required before publication.":`FAIL: video and audio stream durations differ by ${streamGap.toFixed(3)}s in at least one master.`;
const comparisonFinding=durationDelta<=0.05?"PASS: labeled and clean masters have matching durations.":"FAIL: duration mismatch.";
const expectedFinding=expectedGap<=0.1?`PASS: both video streams land within 0.1s of the canonical ${expected}s timeline.`:`FAIL: a video stream is ${expectedGap.toFixed(3)}s away from the canonical ${expected}s timeline.`;
const output={schemaVersion:"1.1",generatedAt:new Date().toISOString(),expectedDuration:expected,artifacts,durationDelta,streamGap,expectedGap,avSyncFinding,comparisonFinding,expectedFinding,cursorArtifacts:files.concat("qc-manifest.json").map(name=>({path:`artifacts/${name}`,sizeBytes:name.endsWith(".json")?null:artifacts.find(item=>item.name===name)?.sizeBytes??null}))};
const manifest=path.join(renderDir,"qc-manifest.json");
fs.writeFileSync(manifest,`${JSON.stringify(output,null,2)}\n`);
output.cursorArtifacts.find(item=>item.path.endsWith("qc-manifest.json")).sizeBytes=fs.statSync(manifest).size;
fs.writeFileSync(manifest,`${JSON.stringify(output,null,2)}\n`);
console.log(manifest);
if(avSyncFinding.startsWith("FAIL")||comparisonFinding.startsWith("FAIL")||expectedFinding.startsWith("FAIL")){
  console.error(JSON.stringify({avSyncFinding,comparisonFinding,expectedFinding},null,2));
  process.exit(1);
}
