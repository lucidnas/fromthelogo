#!/usr/bin/env node
// FTL News Recap — trending-story scanner.
// Uses `codex exec` (real-time web) to scan the major Caitlin Clark / Indiana Fever / WNBA
// outlets + social, then renders a ranked, fact-receipted markdown digest that becomes the
// --research input for `tools/ftl-script-pipeline.mjs --mode news`.
//
// Usage:
//   node tools/ftl-news-scan.mjs [--date YYYY-MM-DD] [--limit N] [--outlets a,b,c]
//                                [--out PATH] [--print-prompt]
//
// Output (default): research/news-ideas/YYYY-MM-DD-news-stories.md
// Also writes the raw Codex response next to it as *.codex.txt for debugging.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";

const DEFAULT_OUTLETS = [
  "Yahoo Sports",
  "Sports Illustrated (si.com)",
  "Athlon Sports",
  "Sporting News",
  "USA Today",
  "IndyStar",
  "The Athletic",
  "ESPN",
  "CBS Sports",
  "Bleacher Report",
  "ClutchPoints",
  "Caitlin Clark TikTok/Instagram (@caitlinclark)",
  "Sophie Cunningham TikTok/Instagram",
];

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(`Usage:
  node tools/ftl-news-scan.mjs [--date YYYY-MM-DD] [--limit N] [--outlets a,b,c] [--out PATH] [--print-prompt]

Options:
  --date YYYY-MM-DD   Scan day. Default: today.
  --limit N           Number of ranked stories to return. Default: 6.
  --outlets a,b,c     Comma-separated override of the default outlet set.
  --out PATH          Markdown output. Default: research/news-ideas/<date>-news-stories.md
  --print-prompt      Print the Codex prompt and exit (no scan).`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { limit: 6, outlets: DEFAULT_OUTLETS, printPrompt: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) usage(`${a} needs a value`);
      return v;
    };
    if (a === "--date") args.date = next();
    else if (a === "--limit") args.limit = Number(next());
    else if (a === "--outlets") args.outlets = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--out") args.out = next();
    else if (a === "--print-prompt") args.printPrompt = true;
    else if (a === "--help" || a === "-h") usage();
    else usage(`unknown flag ${a}`);
  }
  if (!args.date) {
    // Default to today in local time without using Date in a way that breaks determinism tests.
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    args.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (!Number.isFinite(args.limit) || args.limit < 1) usage("--limit must be a positive number");
  args.out ||= path.join(REPO, "research/news-ideas", `${args.date}-news-stories.md`);
  return args;
}

function buildPrompt({ date, limit, outlets }) {
  return `You are the From The Logo (FTL) news scout. FTL is a faceless YouTube channel that covers
the WNBA every single day through ONE lens: what does this mean for Caitlin Clark and the Indiana Fever?

TODAY: ${date}

TASK: Using real-time web search, find the ${limit} strongest TRENDING Caitlin Clark / Indiana Fever / WNBA
news stories from roughly the last 48 hours, drawn from these outlets and social accounts:
${outlets.map((o) => `  - ${o}`).join("\n")}

For EACH story you must:
  1. Read the actual article/post and capture its real headline and URL.
  2. Apply the CLARK LENS: even if the story is about another player/team/the league, frame what it
     means for Caitlin Clark's path, the Fever, or her ability to play her game. Reject any story
     with no genuine Clark/Fever connection.
  3. Pull the CORE FACTS as discrete, verifiable receipts — each with the specific source + URL it
     came from. Quotes must be verbatim. Numbers (stats, salary, dates) must be exact. Do NOT
     paraphrase a fact into something stronger than the source supports.
  4. Treat this story as the VIDEO VERSION of the outlet's article: adopt the article's angle and the
     strength of its hook (don't invent a different story), then rebuild its headline as a CURIOSITY-GAP
     YouTube title. The #1 rule: WITHHOLD THE PAYOFF — name that something big/historic/absurd happened,
     do NOT state the stat/number/punchline (a wire headline spells the fact for SEO; a YouTube title
     hides it for the click). It must be AS SENSATIONAL AS, OR MORE THAN, the outlet's headline, but
     STRICTLY FACTUAL. Caitlin Clark's name MUST appear. NEVER use the Celebration awe/yellow word
     (GENIUS/UNREAL/INSANE/etc.) or the "THIS Caitlin Clark ___ is ___" pattern. (FTL's only spin vs
     the article is delivery — more explicit and casual — never a different angle or invented facts.)
     Hook formulas (pick the best fit, slot in today's facts):
       - Withheld Superlative: "Caitlin Clark Just Set An Absurd WNBA Record No One Saw Coming"
       - Domination: "Caitlin Clark And [teammate] Were Just Too Much For [opponent]"
       - Quote-Tease/Reaction: "Caitlin Clark Wasn't Having It After This '[word]' Call"
       - Found It/Missing Piece: "Caitlin Clark Just Found The One Thing The Fever Were Missing"
       - Hidden Hero/Secret Behind: "The Real Reason Behind Caitlin Clark's [result] Isn't What You Think"
       - Label/New Status: "Caitlin Clark Just Earned A New Title — And It's Not What You'd Guess"
       - Authority/Villain: "The WNBA Just Put Caitlin Clark On The Clock"
       - Prophecy/Open Loop: "Caitlin Clark Just Changed The Fever's Biggest Question"
       - Just Ask/Simple Answer: "The Fever's Fix Was Simple — Just Ask Caitlin Clark"
     Self-check: if a wire service could have written it verbatim, it spells out the fact — rewrite to
     withhold. Provide 2 alt titles using DIFFERENT formulas.
  5. Sketch a VISUAL PLAN: 5-9 beats for an image-led 4-6 minute recap. For each beat give a type:
       - "ai-image"     : conceptual editorial image we will generate (the safe default / majority)
       - "receipt"      : a real screenshot we will show briefly + attribute (headline, tweet, box score)
       - "broll-still"  : a still frame from our own Caitlin Clark game footage
       - "broll-video"  : a short moving insert of our own Caitlin Clark game footage
     and a one-line note on what the beat shows.

RANK strongest first (clip-worthiness, freshness, Clark-lens strength, title ceiling).

When two outlets conflict on a fact, prefer the reporting-heavy outlet (The Athletic, ESPN, IndyStar)
and note the conflict in "cautions".

OUTPUT: As your FINAL message, output ONLY a single fenced \`\`\`json code block (nothing after it)
matching exactly this shape:

\`\`\`json
{
  "date": "${date}",
  "stories": [
    {
      "rank": 1,
      "outlet": "The Athletic",
      "originalHeadline": "...",
      "url": "https://...",
      "publishedDate": "${date}",
      "clarkLensAngle": "1-2 sentences on why this matters for Caitlin Clark / the Fever.",
      "coreFacts": [
        { "fact": "verbatim quote or exact stat", "source": "Outlet name", "url": "https://..." }
      ],
      "proposedTitle": "Curiosity-driven news headline with Caitlin Clark in it (NO 'THIS ... is INSANE' pattern, no yellow word)",
      "altTitles": ["second curiosity-gap option", "third option"],
      "sensationalismNote": "Why this title is more sensational than the outlet's but still 100% factual.",
      "visualPlan": [
        { "beat": 1, "type": "ai-image", "note": "..." },
        { "beat": 2, "type": "receipt", "note": "screenshot of <outlet> headline" }
      ],
      "cautions": "Any unverified angle, conflicting report, or sensitivity. '' if none."
    }
  ]
}
\`\`\`

Do not fabricate URLs, quotes, or numbers. If you cannot verify a story, drop it and find another.`;
}

function runCodex(prompt) {
  console.error("Running Codex web scan (this can take a few minutes)...");
  const proc = spawnSync(
    "codex",
    ["exec", "-c", 'sandbox_permissions=["disk-full-read-access"]', prompt],
    { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
  if (proc.error) throw proc.error;
  if (proc.status !== 0) throw new Error(`codex exec exited ${proc.status}`);
  return proc.stdout || "";
}

function extractJson(raw) {
  // Prefer the LAST ```json fenced block; fall back to the last bare {...} object.
  const fences = [...raw.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (fences.length) {
    const candidate = fences[fences.length - 1][1].trim();
    return JSON.parse(candidate);
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  }
  throw new Error("No JSON found in Codex output");
}

function renderMarkdown(data, args) {
  const lines = [];
  lines.push(`# ${args.date} News Recap Candidates — Caitlin Clark / Indiana Fever`);
  lines.push("");
  lines.push(`Generated by \`tools/ftl-news-scan.mjs\` on ${args.date}. Ranked strongest-first.`);
  lines.push("Each story is a candidate for an image-led 4-6 min news recap (see");
  lines.push("`docs/formats/news-recap.md`). Pick one, then run");
  lines.push("`node tools/ftl-script-pipeline.mjs --mode news --slug ... --research <this file> --generate`.");
  lines.push("");
  lines.push("**Rule:** every claim that reaches the screen must trace to a receipt below. The title may");
  lines.push("be more sensational than the outlet's — never less factual.");
  lines.push("");

  const stories = (data.stories || []).slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  if (!stories.length) lines.push("_No stories returned. Re-run, widen --limit, or check the raw Codex output._");

  for (const s of stories) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${s.rank ?? "?"}. ${s.proposedTitle || "(untitled)"}`);
    lines.push("");
    if (Array.isArray(s.altTitles) && s.altTitles.length) {
      lines.push(`**Alt titles:** ${s.altTitles.map((t) => `"${t}"`).join(" · ")}`);
    }
    lines.push(`**Outlet:** ${s.outlet || "—"}`);
    lines.push(`**Original headline:** ${s.originalHeadline || "—"}`);
    lines.push(`**URL:** ${s.url || "—"}`);
    if (s.publishedDate) lines.push(`**Published:** ${s.publishedDate}`);
    lines.push("");
    if (s.clarkLensAngle) {
      lines.push("### Clark Lens");
      lines.push(s.clarkLensAngle);
      lines.push("");
    }
    if (Array.isArray(s.coreFacts) && s.coreFacts.length) {
      lines.push("### Core Facts & Receipts");
      for (const f of s.coreFacts) {
        const src = [f.source, f.url].filter(Boolean).join(" — ");
        lines.push(`- ${f.fact}${src ? `  _(${src})_` : ""}`);
      }
      lines.push("");
    }
    if (s.sensationalismNote) {
      lines.push("### Why the title is fair");
      lines.push(s.sensationalismNote);
      lines.push("");
    }
    if (Array.isArray(s.visualPlan) && s.visualPlan.length) {
      lines.push("### Visual Plan");
      for (const b of s.visualPlan) {
        lines.push(`- Beat ${b.beat ?? "?"} (\`${b.type || "ai-image"}\`): ${b.note || ""}`);
      }
      lines.push("");
    }
    if (s.cautions) {
      lines.push("### Cautions");
      lines.push(s.cautions);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = buildPrompt(args);

  if (args.printPrompt) {
    console.log(prompt);
    return;
  }

  const raw = runCodex(prompt);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const rawPath = `${args.out}.codex.txt`;
  fs.writeFileSync(rawPath, raw);

  let data;
  try {
    data = extractJson(raw);
  } catch (err) {
    console.error(`Failed to parse Codex JSON: ${err.message}`);
    console.error(`Raw output saved to: ${rawPath}`);
    process.exit(2);
  }

  const md = renderMarkdown(data, args);
  fs.writeFileSync(args.out, md);
  console.log(JSON.stringify({
    out: args.out,
    raw: rawPath,
    stories: (data.stories || []).length,
  }, null, 2));
}

main();
