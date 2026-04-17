import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";

const SYSTEM_PROMPT = `You are a scriptwriter for a YouTube channel called "From The Logo" focused on Caitlin Clark and WNBA content.

Writing style rules:
- Dramatic narrative storytelling, NOT dry reporting
- Use "The Day..." framing for game narratives
- Strategic use of ALL CAPS for emphasis (2-3 words max, not entire sentences)
- Fan perspective — passionate, opinionated, never neutral
- Build tension through acts, then deliver payoff
- HOOK with a surprising stat or statement
- Short paragraphs. Some one sentence. For impact.
- Stats then BOLD TAKE — "14.2% worse" then "That's not defense. That's a force field."
- End with ONE SHARP closing sentence
- Target 7-8 minutes of speaking (approximately 1000-1200 words)

Script structure:
[HOOK] - Opening that grabs attention (surprising stat or statement)
[INTRO] - "What's up everyone, welcome back to From The Logo..." + brief setup
[BODY - ACT 1] - Set the scene, build context
[BODY - ACT 2] - Escalate, the turning point
[BODY - ACT 3] - Climax/payoff with stats
[OUTRO] - One sharp closing line + "Subscribe for more From The Logo"`;

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

    let prompt = `Write a full YouTube video script for a video titled: "${title}"

Hook line to build from: "${hookLine}"
Format: ${format || "the-day"}`;

    if (angle) {
      prompt += `\nAngle/context: ${angle}`;
    }

    if (talkingPoints && talkingPoints.length > 0) {
      prompt += `\n\nKey talking points to cover:\n${talkingPoints.map((tp: string, i: number) => `${i + 1}. ${tp}`).join("\n")}`;
    }

    prompt += `\n\nWrite the complete script now. Follow the script structure exactly. Make it approximately 1000-1200 words.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    return NextResponse.json({
      script: result.text,
      provider: process.env.AI_PROVIDER || "anthropic",
      model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
    });
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
