#!/usr/bin/env python3
"""FTL researcher — scans a curated list of podcasts (YouTube) and X accounts for
VIRAL clips and shorts ideas, ranks them, and writes a dated research report.

The report feeds the shorts machine across formats (split-clip, slow-mo highlight,
play ranking, NBA crossover). Config: research/sources.json.

Usage:
  ftl_research.py youtube [--days 14] [--per 15]   # scan podcast channels (yt-dlp)
  ftl_research.py report  [--days 14] [--top 40]   # write research/YYYY-MM-DD-shorts-research.md
X-account scanning is browser-based (auth) — run `ftl_research.py x-plan` for the
handles + open them in the logged-in browser to grab viral video posts.
"""
import argparse, json, os, subprocess, sys, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(REPO, "research", "sources.json")
YTDLP = "/opt/homebrew/bin/yt-dlp"


def cfg():
    return json.load(open(SOURCES))


def _views(v):
    try:
        return int(v)
    except Exception:
        return 0


def scan_youtube(days, per):
    """Return a list of recent uploads across the podcast channels with view counts.
    Uses yt-dlp flat-playlist (fast). Newest-first per channel; keep the first `per`."""
    c = cfg()
    kw = [k.lower() for k in c.get("keywords", [])]
    rows = []
    for ch in c["youtube_podcasts"]:
        h = ch["handle"]
        try:
            # non-flat (capped) so view_count is populated -> we can rank virality
            out = subprocess.run(
                [YTDLP, "--no-warnings", "--playlist-end", str(per),
                 "--print", "%(id)s\t%(view_count)s\t%(duration)s\t%(title)s",
                 f"https://www.youtube.com/@{h}/videos"],
                capture_output=True, text=True, timeout=180).stdout.strip()
        except Exception:
            out = ""
        if not out:
            print(f"  [skip] @{h} (unresolved)", file=sys.stderr)
            continue
        n = 0
        for line in out.splitlines():
            p = line.split("\t")
            if len(p) < 4:
                continue
            vid, vc, dur, title = p[0], _views(p[1]), p[2], p[3]
            cc = any(k in title.lower() for k in kw)
            rows.append({"channel": h, "lane": ch["lane"], "id": vid, "views": vc,
                         "dur": dur, "title": title, "cc_relevant": cc})
            n += 1
        print(f"  @{h}: {n} recent", file=sys.stderr)
    rows.sort(key=lambda r: r["views"], reverse=True)
    return rows


def _fmt_suggestion(r):
    t = r["title"].lower()
    if r["lane"] == "wnba" or any(k in t for k in ("caitlin", "clark", "fever", "wnba")):
        return "split_clip (WNBA)"
    return "nba_split_clip"


def report(days, top):
    rows = scan_youtube(days, 15)
    today = datetime.date.today().isoformat()
    path = os.path.join(REPO, "research", f"{today}-shorts-research.md")
    lines = [f"# FTL Shorts Research — {today}", "",
             f"Scanned {len(cfg()['youtube_podcasts'])} podcast channels. Top {top} by views.",
             "Turn the best into shorts (split-clip default; see formats in sources.json).", ""]
    # WNBA/Caitlin-relevant (any lane) first; then the most-VIRAL NBA pod clips
    # (no keyword filter — viral = clippable; the algorithm finds the audience).
    wnba = [r for r in rows if r["lane"] == "wnba" or r["cc_relevant"]]
    nba = [r for r in rows if r["lane"] == "nba" and r not in wnba]
    nba.sort(key=lambda r: r["views"], reverse=True)
    def block(title, rs):
        lines.append(f"## {title}")
        for r in rs[:top]:
            v = f"{r['views']:,}" if r["views"] else "?"
            lines.append(f"- **{v} views** · [{r['title'][:80]}](https://youtu.be/{r['id']}) "
                         f"· @{r['channel']} · _{_fmt_suggestion(r)}_")
        lines.append("")
    block("WNBA / Caitlin Clark — clip these first (by views)", wnba)
    block("NBA crossover — most-viral pod clips (algorithm finds the audience)", nba)
    lines += ["## Other formats to feed the backlog",
              "- **Slow-mo / close-up CC highlight** — top performer. Source game replays / fan clips "
              "(nba_api play clips, X fan accounts). Vertical, music bed.",
              "- **Caitlin Clark play ranking** — multiple plays + rank overlay.",
              "- **X viral video posts** — run `ftl_research.py x-plan` and grab high-engagement clips.", ""]
    open(path, "w").write("\n".join(lines))
    print(f"wrote {path}  ({len(wnba)} WNBA + {len(nba)} NBA candidates)")
    return path


def x_plan():
    c = cfg()
    print("X accounts to scan (open in the logged-in browser, grab high-view video posts):")
    for h in c["x_accounts"]:
        print(f"  https://x.com/{h}/media   (@{h})")
    print("\nFor each: bookmark or note viral video posts (>100k views) about Caitlin/WNBA/NBA;")
    print("download headless with yt-dlp, then build split-clips or slow-mo highlights.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    y = sub.add_parser("youtube"); y.add_argument("--days", type=int, default=14); y.add_argument("--per", type=int, default=15)
    r = sub.add_parser("report"); r.add_argument("--days", type=int, default=14); r.add_argument("--top", type=int, default=40)
    sub.add_parser("x-plan")
    a = ap.parse_args()
    if a.cmd == "youtube":
        for row in scan_youtube(a.days, a.per):
            print(f"{row['views']:>10,}  @{row['channel']:<18} {row['title'][:70]}")
    elif a.cmd == "report":
        report(a.days, a.top)
    elif a.cmd == "x-plan":
        x_plan()
