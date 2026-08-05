#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function loadEnv(file){if(!fs.existsSync(file))return;for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){const t=line.trim();if(!t||t.startsWith("#")||!t.includes("="))continue;const [k,...v]=t.split("=");if(!process.env[k])process.env[k]=v.join("=").replace(/^["']|["']$/g,"");}}
const [scriptPath,outDir,voiceId]=process.argv.slice(2);
if(!scriptPath||!outDir||!voiceId)throw new Error("usage: generate-ftl-continuous-essay-voice.mjs SCRIPT_MD OUT_DIR VOICE_ID");
loadEnv(path.resolve(".env")); loadEnv("/Users/abdul/.gemini/.env");
const key=process.env.ELEVENLABS_API_KEY;if(!key)throw new Error("ELEVENLABS_API_KEY is not set");
const source=fs.readFileSync(scriptPath,"utf8").split(/^## Script\s*$/m)[1];if(!source)throw new Error("Missing ## Script section");
const paragraphs=source.trim().split(/\n\s*\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
fs.mkdirSync(outDir,{recursive:true});
for(let i=0;i<paragraphs.length;i++){
 const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,{method:"POST",headers:{"xi-api-key":key,"content-type":"application/json",accept:"audio/mpeg"},body:JSON.stringify({text:paragraphs[i],model_id:"eleven_v3",voice_settings:{stability:.65,speed:.98,similarity_boost:.8,style:.02,use_speaker_boost:true}})});
 if(!response.ok)throw new Error(`${i}: ${response.status} ${await response.text()}`);
 const output=path.join(outDir,`continuous-${String(i).padStart(2,"0")}.mp3`);fs.writeFileSync(output,Buffer.from(await response.arrayBuffer()));console.log(output);
}
