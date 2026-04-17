import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function detectFormat(title: string): string {
  if (/The Day/i.test(title)) return "the-day";
  if (/increasingly/i.test(title)) return "increasingly";
  if (/Backfired/i.test(title)) return "backfired";
  if (/This Caitlin Clark/i.test(title) || /Caitlin Clark (Play|Skill|Dribble)/i.test(title))
    return "highlight";
  return "other";
}

interface VideoEntry {
  id: string;
  title: string;
  views: number;
  duration: number;
}

async function fetchFromYtDlp(): Promise<VideoEntry[]> {
  const { stdout } = await execAsync(
    `python3 -m yt_dlp --cookies-from-browser chrome --flat-playlist --print "%(id)s|||%(title)s|||%(view_count)s|||%(duration)s" "https://www.youtube.com/@fromthelogo22/videos"`,
    { timeout: 60000 }
  );

  return stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [id, title, viewsStr, durationStr] = line.split("|||");
      return {
        id,
        title,
        views: parseInt(viewsStr) || 0,
        duration: parseInt(durationStr) || 0,
      };
    });
}

export async function POST(request: Request) {
  try {
    let videoEntries: VideoEntry[];

    // Check if video data was provided in body (fallback for Railway)
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body.videos && Array.isArray(body.videos)) {
        videoEntries = body.videos;
      } else {
        // Try yt-dlp locally
        videoEntries = await fetchFromYtDlp();
      }
    } else {
      videoEntries = await fetchFromYtDlp();
    }

    let updated = 0;
    let newCount = 0;

    for (const entry of videoEntries) {
      if (!entry.id || !entry.title) continue;

      const existing = await prisma.channelStat.findUnique({
        where: { youtubeId: entry.id },
      });

      if (existing) {
        await prisma.channelStat.update({
          where: { youtubeId: entry.id },
          data: {
            views: entry.views,
            title: entry.title,
            duration: entry.duration || existing.duration,
            lastChecked: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.channelStat.create({
          data: {
            youtubeId: entry.id,
            title: entry.title,
            views: entry.views,
            duration: entry.duration,
            format: detectFormat(entry.title),
            tags: [],
            publishedAt: new Date(),
            lastChecked: new Date(),
          },
        });
        newCount++;
      }
    }

    const total = await prisma.channelStat.count();

    return NextResponse.json({
      success: true,
      updated,
      new: newCount,
      total,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Channel refresh error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Refresh failed",
        hint: "If running on Railway, POST video data as JSON body instead of using yt-dlp",
      },
      { status: 500 }
    );
  }
}
