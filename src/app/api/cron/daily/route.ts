import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { fetchAllNewsSources } from "@/lib/news-sources";

async function getAlreadyCoveredTopics(): Promise<string> {
  const channelVideos = await prisma.channelStat.findMany({ select: { title: true }, orderBy: { views: "desc" } });
  const pastPitches = await prisma.pitch.findMany({ select: { title: true, status: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const covered = channelVideos.map(v => `- ${v.title} (PUBLISHED)`);
  const pitched = pastPitches.map(p => `- ${p.title} (${p.status})`);
  return [...covered, ...pitched].join("\n");
}

const SYSTEM_PROMPT = `You are a content strategist for "From The Logo" — a YouTube channel about Caitlin Clark and the Indiana Fever. Generate 5 evergreen narrative pitches in the Hoop Reports / DKM Sports style. Frame news as timeless stories. NEVER repeat already-covered topics.

Title patterns that work:
- "The Day [Person] [DRAMATIC VERB] [Target]" — avg 800K views
- "[Thing].. but they get increasingly [ADJECTIVE]" — avg 500K views
- "The [Entity] [Action].. But it Backfired [SPECTACULARLY]" — avg 200K views
- DKM: "When You're The Best [X] But [contrast]", "How [person] Became [achievement]"

Respond in JSON: { "pitches": [{ "title", "format": "evergreen", "pitchType": "evergreen", "angle", "hookLine", "talkingPoints": [], "performanceScore": 1-100 }] }`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [freshNews, coveredTopics] = await Promise.all([fetchAllNewsSources(), getAlreadyCoveredTopics()]);

    const prompt = `Generate 5 new video pitches.

=== TODAY'S FRESH NEWS ===
${freshNews}

=== DO NOT REPEAT — ALREADY COVERED ===
${coveredTopics}

3 pitches from fresh news (framed as evergreen). 2 pure evergreen deep dives. All must be NEW topics not in the covered list. Return ONLY JSON.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    let pitches;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      pitches = JSON.parse(jsonMatch[0]).pitches;
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: result.text }, { status: 500 });
    }

    const provider = process.env.AI_PROVIDER || "anthropic";
    const model = process.env.AI_MODEL || "claude-opus-4-7";

    const created = await Promise.all(
      pitches.map((p: { title: string; format: string; pitchType?: string; angle: string; hookLine: string; talkingPoints: string[]; performanceScore: number }) =>
        prisma.pitch.create({
          data: {
            title: p.title, format: "evergreen", pitchType: "evergreen",
            angle: p.angle, hookLine: p.hookLine, talkingPoints: p.talkingPoints,
            performanceScore: p.performanceScore || 0, status: "pending",
            aiProvider: provider, aiModel: model,
          },
        })
      )
    );

    // Channel stats refresh note:
    // yt-dlp with --cookies-from-browser chrome won't work on Railway (no browser).
    // Channel stats must be refreshed manually from the dashboard or via POST to /api/channel/refresh
    // with video data in the request body. Consider using YouTube Data API for automated refresh.
    console.log("[cron/daily] Channel stats refresh requires manual trigger or YouTube Data API integration");

    return NextResponse.json({ success: true, pitchesCreated: created.length, newsFound: !freshNews.includes("No fresh news"), channelStatsNote: "Manual refresh required - use dashboard button or POST to /api/channel/refresh", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Cron daily error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cron job failed" }, { status: 500 });
  }
}
