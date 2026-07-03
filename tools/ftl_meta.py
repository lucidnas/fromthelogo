#!/usr/bin/env python3
"""FTL metadata generator — SEO + recommendation-optimized title/description/tags
for a rendered short/longform, derived FROM THE VIDEO's context.

Signal: the shorts bank (/Volumes/SSK SSD/clip-library/ftl-shorts-bank.db) holds
each clip's source channel, the exact soundbite quote, and the topic. We feed that
to Codex (live web) to write metadata tuned for BOTH YouTube surfaces:
  - Search: front-loaded primary keyword ("Caitlin Clark"), search-intent phrasing,
    keyword-rich first description line, long-tail tags.
  - Browse/Suggested (recommendation): a curiosity hook + entities the algorithm
    co-associates (Fever, WNBA, the named pundit/player, the beef), hashtags.

Usage:
  ftl_meta.py generate --file /abs/out.mp4 [--kind short|long] [--json]
Prints {title, description, tags:[...]} as JSON on stdout (last line).
Falls back to a deterministic template if Codex is unavailable/malformed.

FTL rules enforced: "Caitlin Clark" MUST appear in the title; Clark-lens framing;
one CTA; shorts get #shorts + <=100 char title.
"""
import argparse, json, os, re, sqlite3, subprocess, sys

BANK = "/Volumes/SSK SSD/clip-library/ftl-shorts-bank.db"
CHANNEL_URL = "https://www.youtube.com/@fromthelogo22"


def bank_row(file):
    if not os.path.isfile(BANK):
        return None
    base = os.path.basename(file)
    c = sqlite3.connect(BANK); c.row_factory = sqlite3.Row
    r = c.execute("SELECT * FROM shorts WHERE out_path=? OR slug=?",
                  (base, os.path.splitext(base)[0])).fetchone()
    return dict(r) if r else None


def codex_meta(ctx, kind):
    prompt = f"""You are the YouTube SEO strategist for "From The Logo" (@fromthelogo22),
a faceless daily channel covering the WNBA through the Caitlin Clark / Indiana Fever lens.

Write metadata for a {"YouTube Short (vertical, <60s)" if kind=="short" else "long-form YouTube video"}
built from this soundbite:
  SPEAKER/SOURCE: {ctx.get('channel','?')}
  QUOTE: "{ctx.get('quote','')}"
  TOPIC: {ctx.get('topic','?')}
  ORIGINAL SOURCE TITLE: {ctx.get('title','')}

Optimize for BOTH YouTube search AND the Browse/Suggested recommendation algorithm:
- TITLE: front-load "Caitlin Clark" (MANDATORY — it must appear), match real search intent,
  add one curiosity/hook element. {"<=100 chars, end with #shorts." if kind=="short" else "<=70 visible chars, no clickbait that the video can't pay off."}
- DESCRIPTION: first 1-2 lines keyword-rich (they show in search) and specific to the quote;
  then 2-3 sentences of Clark-lens context; attribute the speaker/source; one CTA to subscribe;
  end with 3-5 hashtags and the channel link {CHANNEL_URL}.
- TAGS: 12-18 tags mixing broad ("caitlin clark","wnba","indiana fever","fromthelogo"),
  entity-specific (the speaker, any named players/teams, the topic), and long-tail search phrases
  people actually type. Lowercase, no # in tags.

Use current, real WNBA context (browse the web if useful). Do NOT fabricate stats.
Return ONLY a JSON object between <META> and </META> markers, no prose:
<META>{{"title":"...","description":"...","tags":["...","..."]}}</META>"""
    try:
        out = subprocess.run(
            ["codex", "exec", "-c", 'sandbox_permissions=["disk-full-read-access"]', prompt],
            capture_output=True, text=True, timeout=300).stdout
        m = re.search(r"<META>\s*(\{.*?\})\s*</META>", out, re.S)
        if not m:
            m = re.search(r"(\{.*\"tags\".*\})", out, re.S)
        d = json.loads(m.group(1))
        assert d.get("title") and d.get("tags")
        if "caitlin clark" not in d["title"].lower():
            d["title"] = "Caitlin Clark: " + d["title"]
        return d
    except Exception as e:
        print(f"[codex fallback: {e}]", file=sys.stderr)
        return None


def template_meta(ctx, kind):
    speaker = ctx.get("channel", "").split("(")[0].strip() or "Analyst"
    topic = ctx.get("topic", "wnba").replace("-", " ")
    base = f"Caitlin Clark {topic.title()}"
    title = f"{base} — {speaker} Goes Off" + (" #shorts" if kind == "short" else " | From The Logo")
    quote = ctx.get("quote", "")
    desc = (f"{speaker} on Caitlin Clark: \"{quote}\"\n\n"
            f"From The Logo covers the WNBA every day through the Caitlin Clark & Indiana Fever lens. "
            f"Subscribe for daily Caitlin Clark takes.\n\n"
            f"#caitlinclark #wnba #indianafever #fromthelogo\n{CHANNEL_URL}")
    tags = ["caitlin clark", "wnba", "indiana fever", "fromthelogo", "caitlin clark highlights",
            "caitlin clark wnba", speaker.lower(), topic, f"caitlin clark {topic}",
            "wnba news", "indiana fever caitlin clark", "sophie cunningham", "caitlin clark news"]
    return {"title": title[:100], "description": desc, "tags": [t for t in tags if t][:16]}


def generate(file, kind, as_json):
    ctx = bank_row(file) or {"channel": "", "quote": "", "topic": "wnba", "title": os.path.basename(file)}
    meta = codex_meta(ctx, kind) or template_meta(ctx, kind)
    if not as_json:
        print("TITLE:", meta["title"])
        print("\nDESCRIPTION:\n" + meta["description"])
        print("\nTAGS:", ", ".join(meta["tags"]))
    print(json.dumps(meta))
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("generate")
    g.add_argument("--file", required=True)
    g.add_argument("--kind", choices=["short", "long"], default="short")
    g.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.cmd == "generate":
        generate(a.file, a.kind, a.json)
