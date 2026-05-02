/**
 * FTL Render Script
 *
 * Usage:
 *   bun run render.ts <slug> [broll-group]
 *
 * Example:
 *   bun run render.ts this-is-not-the-same-caitlin-clark broll-1
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import http from "http";

const SSD = "/Volumes/SSK SSD";
const FTL_DIR = `${SSD}/ftl`;
const BROLL_DIR = `${SSD}/broll`;

// Serve the SSD directly via a local HTTP server so Remotion can load files
// without relying on webpack's static serving (which doesn't follow symlinks).
function startSSDServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    const filePath = `${SSD}${decodeURIComponent(req.url ?? "/")}`;
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
      };
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
  server.listen(port);
  return server;
}

// Convert absolute SSD path → URL served by the local SSD HTTP server
const SSD_SERVER_PORT = 19876;
function ssdPath(p: string): string {
  return p.replace(`${SSD}/`, `http://localhost:${SSD_SERVER_PORT}/`);
}

const slug = process.argv[2];
const brollGroup = process.argv[3] ?? "broll-1";

if (!slug) {
  console.error("Usage: bun run render.ts <slug> [broll-group]");
  process.exit(1);
}

const videoDir = `${FTL_DIR}/videos/${slug}`;
const cueSheetJsonPath = `${videoDir}/cue-sheet.json`;
const outDir = `${videoDir}/render`;
const outPath = `${outDir}/final.mp4`;

// Resolve VO: prefer canonical vo.mp3, fall back to most recent vo-*.mp3 take
function resolveVoPath(dir: string): string | null {
  const canonical = `${dir}/vo.mp3`;
  if (fs.existsSync(canonical)) return canonical;
  const takes = fs.readdirSync(dir)
    .filter(f => f.startsWith("vo-") && f.endsWith(".mp3"))
    .map(f => ({ f, mtime: fs.statSync(`${dir}/${f}`).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return takes.length > 0 ? `${dir}/${takes[0].f}` : null;
}

const voPath = resolveVoPath(videoDir);
if (!voPath) {
  console.error(`✗ No VO found in ${videoDir} — generate a voice-over first`);
  process.exit(1);
}

// Load cue sheet JSON
let cues: unknown[] = [];
if (fs.existsSync(cueSheetJsonPath)) {
  const rawCues = JSON.parse(fs.readFileSync(cueSheetJsonPath, "utf8"));
  // Convert absolute SSD paths → HTTP URLs served by local SSD server
  cues = rawCues.map((c: any) => ({
    ...c,
    ...(c.clipPath  ? { clipPath:  ssdPath(c.clipPath)  } : {}),
    ...(c.imagePath ? { imagePath: ssdPath(c.imagePath) } : {}),
  }));
  console.log(`✓ Loaded ${cues.length} cues from cue-sheet.json`);
} else {
  console.log(`⚠ No cue-sheet.json — using broll group ${brollGroup} sequentially`);
  const manifestPath = `${BROLL_DIR}/groups/manifest.json`;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const group = manifest[brollGroup];
    if (group) {
      let t = 0;
      for (const clipName of group.clips) {
        const clipPath = `${BROLL_DIR}/groups/${brollGroup}/${clipName}`;
        const dur = 8;
        cues.push({ startSecs: t, endSecs: t + dur, type: "broll", clipPath: ssdPath(clipPath) });
        t += dur;
      }
      console.log(`✓ Built ${cues.length} sequential broll cues`);
    }
  }
}

// Get VO duration via ffprobe
async function getAudioDuration(audioPath: string): Promise<number> {
  const proc = Bun.spawn(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audioPath]);
  const text = await new Response(proc.stdout).text();
  const data = JSON.parse(text);
  return parseFloat(data.format.duration);
}

async function main() {
  console.log(`\n🎬 Rendering: ${slug}`);
  console.log(`   VO: ${voPath}`);
  console.log(`   Output: ${outPath}\n`);

  const durationSecs = await getAudioDuration(voPath);
  const voPathResolved = ssdPath(voPath);
  console.log(`✓ VO duration: ${Math.floor(durationSecs / 60)}:${Math.round(durationSecs % 60).toString().padStart(2, "0")}`);

  const fps = 30;
  const durationInFrames = Math.ceil(durationSecs * fps);

  fs.mkdirSync(outDir, { recursive: true });

  // Start local HTTP server to serve SSD files
  const ssdServer = startSSDServer(SSD_SERVER_PORT);
  console.log(`✓ SSD file server running on port ${SSD_SERVER_PORT}`);

  try {
    // Bundle the Remotion project (no publicDir needed — files served via SSD server)
    console.log("\n⚙ Bundling...");
    const bundled = await bundle({
      entryPoint: path.join(import.meta.dir, "src", "index.ts"),
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl: bundled,
      id: "FTLVideo",
      inputProps: {
        slug,
        title: slug.replace(/-/g, " "),
        voPath: voPathResolved,
        cues,
        durationSecs,
        fps,
      },
    });

    // Override duration to match actual VO length
    composition.durationInFrames = durationInFrames;

    const tempDir = `${SSD}/remotion-tmp`;
    fs.mkdirSync(tempDir, { recursive: true });

    console.log("⚙ Rendering (this takes a few minutes)...");
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: outPath,
      tempDir,
      inputProps: {
        slug,
        title: slug.replace(/-/g, " "),
        voPath: voPathResolved,
        cues,
        durationSecs,
        fps,
      },
      onProgress: ({ progress }) => {
        process.stdout.write(`\r   ${Math.round(progress * 100)}% complete`);
      },
    });

    console.log(`\n\n✓ Render complete: ${outPath}`);
  } finally {
    ssdServer.close();
  }
}

main().catch((err) => {
  console.error("\n✗ Render failed:", err.message);
  process.exit(1);
});
