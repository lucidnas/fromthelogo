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
            if ch["lane"] == "mixed" and not cc:
                continue  # general channel (ESPN/Herd): keep only CC/WNBA
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


def x_scan(rounds=6):
    """Scan each X account's timeline + the user's bookmarks. For normal accounts
    collect VIDEO posts (viral clips). For accounts flagged `context:true`
    (@kenswift, @MickTalksHoops) collect ALL posts — their TEXT is narrative
    context on the Caitlin world and they surface podcast clips to pull. Uses the
    cloned Tales profile (real logged-in X session, headed). Returns rows."""
    import re
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from yt_studio_upload import _persistent
    from playwright.sync_api import sync_playwright
    c = cfg()
    targets = [(a["handle"], a["lane"], bool(a.get("context")), f"https://x.com/{a['handle']}")
               for a in c["x_accounts"]]
    if c.get("scan_bookmarks"):
        targets.append(("bookmarks", "mixed", False, "https://x.com/i/bookmarks"))
    found = []
    with sync_playwright() as p:
        ctx = _persistent(p, headed=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://x.com/home", wait_until="domcontentloaded"); page.wait_for_timeout(5000)
        if "/login" in page.url or "i/flow" in page.url:
            print("  [warn] X not logged in on the Tales clone", file=sys.stderr)
        for handle, lane, context, url in targets:
            try:
                page.goto(url, wait_until="domcontentloaded"); page.wait_for_timeout(5000)
            except Exception:
                print(f"  [skip] @{handle}", file=sys.stderr); continue
            seen = set()
            for _ in range(rounds):
                arts = page.locator("article")
                for i in range(min(arts.count(), 30)):
                    a = arts.nth(i)
                    try:
                        has_video = a.locator('[data-testid="videoComponent"], [data-testid="videoPlayer"]').count() > 0
                        # normal accounts: video only. context accounts: every post.
                        if not has_video and not context:
                            continue
                        href = a.locator('a[href*="/status/"]').first.get_attribute("href", timeout=800) or ""
                    except Exception:
                        continue
                    if "/status/" not in href:
                        continue
                    sid = href.split("/status/")[1].split("/")[0].split("?")[0]
                    if sid in seen:
                        continue
                    seen.add(sid)
                    views = 0
                    try:
                        al = a.locator('a[href$="/analytics"], [aria-label*="views"]').first.get_attribute("aria-label", timeout=800) or ""
                        m = re.search(r"([\d,]+)\s+views", al)
                        if m:
                            views = int(m.group(1).replace(",", ""))
                    except Exception:
                        pass
                    try:
                        text = a.locator('[data-testid="tweetText"]').first.inner_text(timeout=600).replace("\n", " ")
                    except Exception:
                        text = ""
                    text = text[:280] if context else text[:110]
                    if not has_video and not text:
                        continue  # nothing to use
                    found.append({"handle": handle, "lane": lane, "context": context, "has_video": has_video,
                                  "sid": sid, "url": "https://x.com" + href.split("?")[0], "views": views, "text": text})
                page.mouse.wheel(0, 4000); page.wait_for_timeout(2500)
            nv = sum(1 for f in found if f["handle"] == handle and f["has_video"])
            print(f"  @{handle}: {len(seen)} posts ({nv} w/ video)", file=sys.stderr)
        ctx.close()
    found.sort(key=lambda r: r["views"], reverse=True)
    return found


def x_report(rounds=6, top=40):
    rows = x_scan(rounds)
    SPORTS = ("caitlin","clark","fever","wnba","nba","sophie","aliyah","kelsey",
              "boston","basketball","dunk","lebron","jokic","curry","hoop","playoff",
              "all-star","allstar","mvp","reese","bueckers","referee","ref ")
    today = datetime.date.today().isoformat()
    path = os.path.join(REPO, "research", f"{today}-x-clips.md")
    # 1) viral video clips (ranked) — sports-relevant, has a pullable clip
    vids = [r for r in rows if r["has_video"] and
            (r["lane"] in ("nba","wnba") or any(k in (r["text"] or "").lower() for k in SPORTS))]
    # 2) context / story leads from the flagged accounts (read for narrative)
    ctxrows = [r for r in rows if r.get("context")]
    lines = [f"# FTL X Research — {today}", "",
             "## Viral video clips — clip these (ranked by views)",
             "Download headless (yt-dlp). Build split-clip, b-roll voiceover, or slow-mo highlight.", ""]
    for r in vids[:top]:
        v = f"{r['views']:,}" if r["views"] else "?"
        lines.append(f"- **{v} views** · @{r['handle']} · [{(r['text'] or r['url'])[:75]}]({r['url']})")
    lines += ["", "## Caitlin Clark world — context & story leads",
              "From @kenswift / @MickTalksHoops etc. READ THESE for what's happening; "
              "⏯ = has a podcast/video clip we can pull for a short.", ""]
    for r in ctxrows[:top]:
        clip = " ⏯" if r["has_video"] else ""
        lines.append(f"- @{r['handle']}{clip}: {(r['text'] or r['url'])[:200]}  ({r['url']})")
    open(path, "w").write("\n".join(lines))
    print(f"wrote {path}  ({len(vids)} clips + {len(ctxrows)} context posts)")
    return path


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    y = sub.add_parser("youtube"); y.add_argument("--days", type=int, default=14); y.add_argument("--per", type=int, default=15)
    r = sub.add_parser("report"); r.add_argument("--days", type=int, default=14); r.add_argument("--top", type=int, default=40)
    xs = sub.add_parser("x-scan"); xs.add_argument("--rounds", type=int, default=6); xs.add_argument("--top", type=int, default=40)
    a = ap.parse_args()
    if a.cmd == "youtube":
        for row in scan_youtube(a.days, a.per):
            print(f"{row['views']:>10,}  @{row['channel']:<18} {row['title'][:70]}")
    elif a.cmd == "report":
        report(a.days, a.top)
    elif a.cmd == "x-scan":
        x_report(a.rounds, a.top)
