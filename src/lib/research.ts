// Gemini-based research extractor for YouTube videos + Athlon articles.
// Sends URLs via the url_context tool so Gemini fetches the page content
// server-side (titles, descriptions, captions for YouTube) without us
// paying for video tokens.

import { callGeminiWithTools } from "./ai";
import { prisma } from "./db";

export type ResearchItem = {
  url: string;
  source: string;
  title: string;
  viewCount?: number;
};

export type CorroborationSource = {
  url: string;
  outlet: string;
  excerpt: string;
};

export type VideoReference = {
  timestamp: string; // "MM:SS" or "HH:MM:SS"
  claim: string;
};

export type ResearchTopic = {
  topic: string;
  summary: string;
  sources: CorroborationSource[];
  videoReferences: VideoReference[];
};

export type ResearchSummaryShape = {
  angle: string;
  villain: string | null;
  keyMoments: string[];
  quotes: string[];
  stats: string[];
  whyItResonated: string;
  topics?: ResearchTopic[];
};

const SYSTEM_PROMPT = `You are a research analyst for a YouTube channel about Caitlin Clark and the Indiana Fever.

You will receive a list of source URLs (YouTube videos and Athlon Sports articles). Use the url_context tool to fetch each URL's content (YouTube captions + metadata, or article text). For each URL, extract a structured summary that a writer could use to pitch a new video.

Focus on what makes this source valuable as RAW MATERIAL for a pitch:
- The angle the creator took (what's the central claim or story?)
- Named villains, opponents, or antagonists (specific people, with what they did or said)
- Key moments (specific plays, quotes, decisions, tweets — concrete, not paraphrased)
- Direct quotes (verbatim when possible, attributed to the speaker)
- Stats and numbers (anything quantitative — scores, records, percentages, dollar amounts)
- Why this resonated (audience reaction, view velocity, what hit a nerve)

Output JSON ONLY, no markdown, no commentary, with this exact shape:
{
  "results": [
    {
      "url": "<exact URL from input>",
      "summary": {
        "angle": "1-2 sentences on the source's central angle",
        "villain": "named person + what they did, or null if no villain",
        "keyMoments": ["3-5 specific concrete moments"],
        "quotes": ["2-4 direct quotes with attribution"],
        "stats": ["2-4 specific numbers or records"],
        "whyItResonated": "1-2 sentences on what hit a nerve or drove engagement"
      }
    }
  ]
}

If url_context fails on a URL, still include it in results but set every summary field to a short error message starting with "UNAVAILABLE:" explaining what failed. Do not skip URLs.

CRITICAL — VALID JSON ONLY:
- Output must be parseable by JSON.parse. No trailing commas, no comments, no markdown fences.
- Inside any string field, escape every internal double quote with a backslash (\\"). Use curly quotes (" ") if you want to show a real quote without escaping.
- Inside any string field, escape every backslash (\\\\), every newline as \\n, every tab as \\t.
- Do not wrap the JSON in a code block. Your first character should be '{' and your last character should be '}'.`;

function buildPrompt(items: ResearchItem[]): string {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. ${item.source} — "${item.title}"${
        item.viewCount ? ` (${item.viewCount.toLocaleString()} views)` : ""
      }\n   URL: ${item.url}`
  );
  return `Research these ${items.length} sources and return structured summaries for each.

${lines.join("\n\n")}

Remember: use url_context on every URL, extract concrete specifics (names, numbers, quotes), return JSON only.`;
}

function parseResponse(raw: string): Array<{ url: string; summary: ResearchSummaryShape }> {
  const cleaned = raw
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  // Try clean parse first (ideal case).
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.results)) return parsed.results;
  } catch {
    // fall through to recovery
  }

  // Trim to outermost braces and try again.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`No JSON object found. First 300 chars: ${cleaned.slice(0, 300)}`);
  }
  const slice = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed.results)) throw new Error("Missing results array");
    return parsed.results;
  } catch (err) {
    // Log the raw output server-side so we can see what Gemini returned.
    console.error("[research] Failed to parse Gemini response. Raw length:", raw.length);
    console.error("[research] First 400 chars:", cleaned.slice(0, 400));
    console.error("[research] Last 400 chars:", cleaned.slice(-400));
    throw new Error(
      `Parse failed: ${err instanceof Error ? err.message : "unknown"}. Response length: ${
        raw.length
      } chars. The model likely returned malformed or truncated JSON — try researching fewer items at once.`
    );
  }
}

export async function researchUrls(
  items: ResearchItem[],
  options: { forceRefresh?: boolean } = {}
): Promise<
  Array<{
    url: string;
    source: string;
    title: string;
    summary: ResearchSummaryShape;
    cached: boolean;
  }>
> {
  if (items.length === 0) return [];

  const model = process.env.RESEARCH_MODEL || "gemini-2.5-pro";

  // Pull cached summaries unless force-refresh
  const urls = items.map((i) => i.url);
  const cached = options.forceRefresh
    ? []
    : await prisma.researchSummary.findMany({ where: { url: { in: urls } } });
  const cachedByUrl = new Map(cached.map((c) => [c.url, c]));

  const toFetch = items.filter((i) => !cachedByUrl.has(i.url));

  let freshResults: Array<{ url: string; summary: ResearchSummaryShape }> = [];
  if (toFetch.length > 0) {
    const result = await callGeminiWithTools(
      buildPrompt(toFetch),
      SYSTEM_PROMPT,
      model,
      {
        urlContext: true,
        // Gemini blocks responseMimeType together with url_context, so we
        // rely on the prompt's "JSON only" instruction + lenient parsing.
        maxOutputTokens: 32768,
      }
    );

    freshResults = parseResponse(result.text);

    // Persist fresh results. Upsert so a force-refresh overwrites the prior row.
    const inputByUrl = new Map(toFetch.map((i) => [i.url, i]));
    await Promise.all(
      freshResults.map((r) => {
        const input = inputByUrl.get(r.url);
        if (!input) return null;
        return prisma.researchSummary.upsert({
          where: { url: r.url },
          create: {
            url: r.url,
            source: input.source,
            title: input.title,
            viewCount: input.viewCount ?? null,
            summary: r.summary as unknown as object,
            rawText: JSON.stringify(r.summary),
            model,
          },
          update: {
            source: input.source,
            title: input.title,
            viewCount: input.viewCount ?? null,
            summary: r.summary as unknown as object,
            rawText: JSON.stringify(r.summary),
            model,
            fetchedAt: new Date(),
          },
        });
      })
    );
  }

  // Merge cached + fresh, preserving input order
  const freshByUrl = new Map(freshResults.map((r) => [r.url, r.summary]));
  return items.map((item) => {
    const cachedRow = cachedByUrl.get(item.url);
    if (cachedRow) {
      return {
        url: item.url,
        source: cachedRow.source,
        title: cachedRow.title,
        summary: cachedRow.summary as unknown as ResearchSummaryShape,
        cached: true,
      };
    }
    const fresh = freshByUrl.get(item.url);
    return {
      url: item.url,
      source: item.source,
      title: item.title,
      summary: (fresh ?? {
        angle: "UNAVAILABLE: Gemini did not return a summary",
        villain: null,
        keyMoments: [],
        quotes: [],
        stats: [],
        whyItResonated: "UNAVAILABLE",
      }) as ResearchSummaryShape,
      cached: false,
    };
  });
}

export async function getResearchedUrls(urls: string[]) {
  if (urls.length === 0) return [];
  return prisma.researchSummary.findMany({
    where: { url: { in: urls } },
    orderBy: { fetchedAt: "desc" },
  });
}
