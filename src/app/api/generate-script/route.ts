import { NextResponse } from "next/server";
import { callGeminiWithTools } from "@/lib/ai";
import { prisma } from "@/lib/db";
import type { ResearchSummaryShape } from "@/lib/research";
import { FTL_VOICE_PROFILE } from "@/lib/voice-profile";

async function getResearchBriefForPitch(pitchTitle: string): Promise<string> {
  // Best-effort: pull recent research summaries whose title fuzzy-matches the pitch
  const rows = await prisma.researchSummary.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 30,
  });
  const lowered = pitchTitle.toLowerCase();
  const keywords = lowered.split(/\s+/).filter((w) => w.length > 4);

  const relevant = rows
    .map((r) => {
      const matches = keywords.filter((k) => r.title.toLowerCase().includes(k)).length;
      return { row: r, matches };
    })
    .filter((x) => x.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 5);

  if (relevant.length === 0) return "";

  return relevant
    .map(({ row }) => {
      const s = row.summary as unknown as ResearchSummaryShape;
      const views = row.viewCount ? ` (${row.viewCount.toLocaleString()} views)` : "";
      return [
        `— "${row.title}" — ${row.source}${views}`,
        `  Angle: ${s.angle}`,
        s.villain ? `  Villain: ${s.villain}` : null,
        s.keyMoments?.length ? `  Key moments: ${s.keyMoments.slice(0, 3).join(" | ")}` : null,
        s.quotes?.length ? `  Quotes: ${s.quotes.slice(0, 3).join(" | ")}` : null,
        s.stats?.length ? `  Stats: ${s.stats.slice(0, 4).join(" | ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildSystemPrompt(): string {
  return `You are the scriptwriter for "From The Logo" — a YouTube channel covering Caitlin Clark, the Indiana Fever, and the bigger NBA/WNBA stories that intersect with them. You are FTL's staff voice.

This is a SPOKEN VIDEO ESSAY, not a written article. The final output is a voiceover someone will read aloud.

${FTL_VOICE_PROFILE}

=== HARD FACTUAL RULES ===

- Every stat, quote, date, and name must come from the RESEARCH BRIEF in the user prompt. Do not invent numbers. If the brief doesn't have a specific number, skip it — don't make one up.
- If you use a quote, attribute it to the person who said it.
- Target 1000-1200 words (7-8 minutes speaking). Tight is better than padded.
- Always pro-Caitlin-Clark perspective, but earned — backed by receipts, not vibes.
- Your final output is the script text only. No preamble. No "Here's your script:". Start with the cold open.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, hookLine, format, angle, talkingPoints } = body;

    if (!title || !hookLine) {
      return NextResponse.json(
        { error: "title and hookLine are required" },
        { status: 400 }
      );
    }

    const researchBrief = await getResearchBriefForPitch(title);
    const systemPrompt = buildSystemPrompt();

    const userPrompt = `Write the voiceover script for this pitch.

PITCH TITLE: "${title}"
HOOK LINE: "${hookLine}"
FORMAT: ${format || "evergreen"}${angle ? `\nANGLE: ${angle}` : ""}${
      talkingPoints && talkingPoints.length > 0
        ? `\n\nTALKING POINTS:\n${talkingPoints
            .map((tp: string, i: number) => `${i + 1}. ${tp}`)
            .join("\n")}`
        : ""
    }

=== RESEARCH BRIEF (use only these facts for specifics) ===
${
  researchBrief ||
  "(No specific research bundle matched this pitch. Rely on well-known public facts about Caitlin Clark / the Indiana Fever that you're highly confident on, and keep specifics minimal rather than inventing numbers.)"
}

Now write the complete script as continuous prose, top to bottom, no headers, no labels. Apply the voice profile — cold open one of the four modes, five mental beats, callback or metaphor close, sign-off line. End with one natural sign-off like "New videos every week on From The Logo. See you next time."`;

    const model = process.env.SCRIPT_MODEL || "gemini-2.5-pro";
    const result = await callGeminiWithTools(userPrompt, systemPrompt, model, {
      maxOutputTokens: 16384,
    });

    return NextResponse.json({
      script: result.text,
      provider: "gemini",
      model,
    });
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
