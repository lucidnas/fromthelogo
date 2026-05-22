/**
 * FTL Local Studio — filesystem helpers
 * All content lives under SSD_ROOT on the SSD.
 */

import fs from "fs";
import path from "path";

export const SSD_ROOT = "/Volumes/SSK SSD/ftl";
export const VIDEOS_DIR = path.join(SSD_ROOT, "videos");
export const BROLL_DIR = "/Volumes/SSK SSD/broll";
export const RESEARCH_DIR = path.join(SSD_ROOT, "research");

export type VideoStatus = "idea" | "researched" | "scripted" | "vo" | "rendered";
export type ThumbnailFormat = "A" | "B" | "C";

export interface VideoMeta {
  slug: string;
  title: string;
  status: VideoStatus;
  category?: string;
  hookLine?: string;
  thumbnailFormat?: ThumbnailFormat; // A=close-up, B=face-through-type, C=split-screen
  thumbnailWord?: string;            // For format B: the one big word (e.g. "AFRAID")
  thumbnailBubble?: string;          // For format C: speech bubble text
  createdAt: string;
  updatedAt: string;
}

export interface Video extends VideoMeta {
  hasScript: boolean;
  hasBrief: boolean;
  hasVO: boolean;
  hasThumbnail: boolean;
  hasRender: boolean;
  hasCueSheet: boolean;
  thumbnailUrl?: string; // first available thumbnail file
}

function videoDir(slug: string) {
  return path.join(VIDEOS_DIR, slug);
}

function exists(p: string) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function listVideos(): Video[] {
  if (!exists(VIDEOS_DIR)) return [];
  const slugs = fs.readdirSync(VIDEOS_DIR).filter(
    (name) => fs.statSync(path.join(VIDEOS_DIR, name)).isDirectory()
  );

  return slugs.map((slug) => {
    const dir = videoDir(slug);
    const metaPath = path.join(dir, "meta.json");
    let meta: Partial<VideoMeta> = {};
    if (exists(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
    }

    // Find first available thumbnail file
    const thumbCandidates = ["thumbnail.png", "thumbnail-1.png", "thumbnail-2.png", "thumbnail-3.png"];
    const thumbFile = thumbCandidates.find((f) => exists(path.join(dir, f)));

    return {
      slug,
      title: meta.title ?? slug,
      status: meta.status ?? "idea",
      category: meta.category,
      hookLine: meta.hookLine,
      thumbnailFormat: meta.thumbnailFormat,
      thumbnailWord: meta.thumbnailWord,
      thumbnailBubble: meta.thumbnailBubble,
      createdAt: meta.createdAt ?? new Date().toISOString(),
      updatedAt: meta.updatedAt ?? new Date().toISOString(),
      hasScript: exists(path.join(dir, "script.txt")),
      hasBrief: exists(path.join(dir, "brief.txt")),
      hasVO: exists(path.join(dir, "vo.mp3")),
      hasThumbnail: !!thumbFile,
      hasRender: exists(path.join(dir, "render", "final.mp4")),
      hasCueSheet: exists(path.join(dir, "cue-sheet.txt")),
      thumbnailUrl: thumbFile ? `/api/assets/${slug}/${thumbFile}` : undefined,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getVideo(slug: string): Video | null {
  const dir = videoDir(slug);
  if (!exists(dir)) return null;
  const all = listVideos();
  return all.find((v) => v.slug === slug) ?? null;
}

export function readFile(slug: string, filename: string): string | null {
  const p = path.join(videoDir(slug), filename);
  if (!exists(p)) return null;
  return fs.readFileSync(p, "utf8");
}

export function writeVideoMeta(slug: string, meta: Partial<VideoMeta>) {
  const dir = videoDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const metaPath = path.join(dir, "meta.json");
  let existing: Partial<VideoMeta> = {};
  if (exists(metaPath)) {
    try { existing = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {}
  }
  const updated = { ...existing, ...meta, slug, updatedAt: new Date().toISOString() };
  if (!updated.createdAt) updated.createdAt = updated.updatedAt;
  fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2));
  return updated;
}

export function writeVideoFile(slug: string, filename: string, content: string | Buffer) {
  const dir = videoDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
}

export function listResearch(): { name: string; content: string; date: string }[] {
  if (!exists(RESEARCH_DIR)) return [];
  return fs.readdirSync(RESEARCH_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      name: f.replace(".md", ""),
      date: f.split("-").slice(0, 3).join("-"),
      content: fs.readFileSync(path.join(RESEARCH_DIR, f), "utf8"),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getBrollStats() {
  const libraryPath = path.join(BROLL_DIR, "library.json");
  if (!exists(libraryPath)) return null;
  try {
    const lib = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
    const clips = (lib.clips ?? []) as Array<{ durationSecs: number; status: string }>;
    const active = clips.filter((c) => c.status === "active");
    return {
      totalClips: clips.length,
      activeClips: active.length,
      totalSecs: active.reduce((s, c) => s + c.durationSecs, 0),
      sources: Object.keys(lib.sources ?? {}).length,
    };
  } catch { return null; }
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
