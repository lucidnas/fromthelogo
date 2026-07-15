#!/usr/bin/env python3
"""Hourly X clip collector for From The Logo.

Uses the existing Tales Chrome clone/session, scans configured NBA/WNBA X
timelines plus bookmarks, classifies native-video posts for split Shorts or
caption-story Shorts, and stores a durable deduplicated candidate queue.

This tool discovers and queues source leads only. It never renders, uploads, or
publishes a video.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import time
from urllib.parse import urlsplit, urlunsplit

from ftl_x_backlog_policy import (
    COMMENTARY_MAX_AGE_HOURS,
    editorial_class,
    ensure_policy_schema,
    infer_event_key,
    refresh_backlog_policy,
    write_backlog_manifests,
)


REPO = Path(__file__).resolve().parents[1]
SOURCES = REPO / "research" / "sources.json"
CACHE = Path("/Volumes/SSK SSD/fromthelogo-cache/x-hourly-collector")
DB_PATH = CACHE / "candidates.sqlite3"
JSONL_PATH = CACHE / "candidates.jsonl"
REPORT_DIR = CACHE / "reports"
LOCK_PATH = CACHE / "collector.lock"

SPEECH_SIGNALS = (
    "podcast", "interview", "says", "said", "speaks", "talks", "explains",
    "reacts", "reaction", "asked", "believes", "calls out", "criticizes",
    "discusses", "debates", "on caitlin", "on the wnba", "on the nba",
    "according to", "told", "responds", "comments on", "weighs in",
)
STORY_SIGNALS = (
    "highlight", "bucket", "dunk", "three", "3-pointer", "assist", "pass",
    "game-winner", "game winner", "record", "history", "points", "rebounds",
    "steal", "block", "breaking", "signs", "signed", "fined", "fine ",
    "suspension", "trade", "injury", "performance", "final", "wins", "win ",
    "loss", "vs ", "vs.", "stat line", "career-high", "season-high", "clutch",
    "bench", "timeout", "hot mic", "caught", "reaction", "reacts", "laugh",
    "smile", "stare", "gesture", "points at", "pose", "celebrates", "arrival",
    "walkout", "ring girl", "ufc", "dana white", "celebrity", "surprises",
    "roasts", "beef", "shove", "hard foul", "technical", "ejected",
)
SPORTS_SIGNALS = (
    "caitlin", "clark", "fever", "wnba", "nba", "sophie", "cunningham",
    "aliyah", "boston", "kelsey", "basketball", "dunk", "lebron", "jokic",
    "curry", "hoop", "playoff", "all-star", "allstar", "mvp", "reese",
    "bueckers", "referee", "finals", "rookie", "trade", "coach", "ufc",
    "dana white", "ring girl", "bench", "timeout", "hot mic", "hard foul",
)
MICRO_MOMENT_SIGNALS = (
    "bench", "timeout", "hot mic", "caught", "reaction", "reacts", "laugh",
    "smile", "stare", "gesture", "points at", "pose", "celebrates", "arrival",
    "walkout", "ring girl", "ufc", "dana white", "celebrity", "surprises",
    "roasts", "beef", "shove", "hard foul", "technical", "ejected",
)
OFFICIAL_ALWAYS_KEEP = {"indianafever", "wnba", "nba"}
WNBA_LANE_SIGNALS = (
    "caitlin clark", "caitlin", "sophie cunningham", "sophie", "wnba",
    "indiana fever", "fever", "aliyah boston", "kelsey mitchell", "lexie hull",
    "paige bueckers", "angel reese", "aja wilson", "a'ja wilson",
)


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def load_sources() -> dict:
    with SOURCES.open() as fh:
        return json.load(fh)


def parse_compact_number(value: str) -> int:
    text = (value or "").replace(",", "").strip().lower()
    match = re.search(r"(\d+(?:\.\d+)?)\s*([kmb])?", text)
    if not match:
        return 0
    number = float(match.group(1))
    number *= {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}.get(match.group(2), 1)
    return int(number)


def canonical_status_url(href: str) -> tuple[str, str, str] | None:
    match = re.search(r"/(?:i/web/status|([^/]+)/status)/(\d+)", href or "")
    if not match:
        return None
    handle = match.group(1) or "i"
    status_id = match.group(2)
    return status_id, handle, f"https://x.com/{handle}/status/{status_id}"


def normalize_media_url(url: str) -> str:
    if not url:
        return ""
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def media_fingerprint(poster_url: str) -> str:
    normalized = normalize_media_url(poster_url)
    if not normalized:
        return ""
    media_id = re.search(
        r"/(?:ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)/(\d+)", normalized
    )
    if media_id:
        return f"xmedia:{media_id.group(1)}"
    return "poster:" + hashlib.sha256(normalized.encode()).hexdigest()


def text_fingerprint(text: str) -> str:
    normalized = re.sub(r"https?://\S+|@\w+|[^a-z0-9 ]+", " ", (text or "").lower())
    normalized = " ".join(normalized.split())
    if len(normalized) < 35:
        return ""
    return hashlib.sha256(normalized.encode()).hexdigest()


def text_tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def near_duplicate_text(left: str, right: str) -> bool:
    left_tokens = text_tokens(left)
    right_tokens = text_tokens(right)
    if min(len(left_tokens), len(right_tokens)) < 4:
        return False
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens) >= 0.78


def classify(text: str, context_account: bool) -> tuple[str, str]:
    lower = (text or "").lower()
    speech_hits = [signal for signal in SPEECH_SIGNALS if signal in lower]
    story_hits = [signal for signal in STORY_SIGNALS if signal in lower]
    micro_hits = [signal for signal in MICRO_MOMENT_SIGNALS if signal in lower]
    quoted_speaker = any(mark in (text or "") for mark in ('"', "“", "”")) and " on " in lower
    if context_account or quoted_speaker or (speech_hits and not micro_hits):
        reason = "speech/pundit signal" if speech_hits else "configured commentary account"
        if quoted_speaker and not context_account and not speech_hits:
            reason = "quoted player/pundit soundbite"
        return "split_short", reason
    if micro_hits:
        return "caption_story", f"high-retention micro-moment: {micro_hits[0]}"
    if story_hits:
        return "caption_story", f"story/play signal: {story_hits[0]}"
    return "caption_story", "native basketball video suitable for a caption-led angle"


def parse_posted_at(value: str) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS candidates (
          status_id TEXT PRIMARY KEY,
          canonical_url TEXT NOT NULL UNIQUE,
          handle TEXT NOT NULL,
          source_target TEXT NOT NULL,
          lane TEXT NOT NULL,
          tweet_text TEXT NOT NULL,
          views INTEGER NOT NULL DEFAULT 0,
          posted_at TEXT,
          discovered_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          short_format TEXT NOT NULL,
          format_reason TEXT NOT NULL,
          poster_url TEXT,
          media_fingerprint TEXT,
          text_fingerprint TEXT,
          state TEXT NOT NULL DEFAULT 'new'
        );
        CREATE INDEX IF NOT EXISTS candidates_state_idx
          ON candidates(state, discovered_at DESC);
        CREATE INDEX IF NOT EXISTS candidates_media_idx
          ON candidates(media_fingerprint);
        CREATE TABLE IF NOT EXISTS duplicates (
          status_id TEXT PRIMARY KEY,
          canonical_url TEXT NOT NULL,
          duplicate_of TEXT NOT NULL,
          discovered_at TEXT NOT NULL,
          reason TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          targets INTEGER NOT NULL DEFAULT 0,
          scanned INTEGER NOT NULL DEFAULT 0,
          inserted INTEGER NOT NULL DEFAULT 0,
          duplicates INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          error TEXT
        );
        """
    )
    ensure_policy_schema(conn)
    conn.commit()


def store_candidate(conn: sqlite3.Connection, row: dict) -> tuple[str, str | None]:
    existing = conn.execute(
        "SELECT status_id FROM candidates WHERE status_id=? OR canonical_url=?",
        (row["status_id"], row["canonical_url"]),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE candidates SET views=MAX(views, ?), last_seen_at=? WHERE status_id=?",
            (row["views"], row["last_seen_at"], existing[0]),
        )
        return "seen", existing[0]

    duplicate = None
    reason = ""
    if row["media_fingerprint"]:
        duplicate = conn.execute(
            "SELECT status_id FROM candidates WHERE media_fingerprint=? LIMIT 1",
            (row["media_fingerprint"],),
        ).fetchone()
        reason = "same X media fingerprint"
    if not duplicate and row["text_fingerprint"]:
        duplicate = conn.execute(
            "SELECT status_id FROM candidates WHERE text_fingerprint=? AND handle=? LIMIT 1",
            (row["text_fingerprint"], row["handle"]),
        ).fetchone()
        reason = "same normalized post text from the same account"
    if not duplicate:
        recent = conn.execute(
            "SELECT status_id, tweet_text FROM candidates WHERE handle<>? AND lane=? "
            "ORDER BY discovered_at DESC LIMIT 500",
            (row["handle"], row["lane"]),
        ).fetchall()
        for status_id, tweet_text in recent:
            if near_duplicate_text(row["tweet_text"], tweet_text):
                duplicate = (status_id,)
                reason = "near-identical caption across accounts; probable repost"
                break
    if duplicate:
        conn.execute(
            "INSERT OR IGNORE INTO duplicates(status_id, canonical_url, duplicate_of, discovered_at, reason) "
            "VALUES(?,?,?,?,?)",
            (row["status_id"], row["canonical_url"], duplicate[0], row["discovered_at"], reason),
        )
        return "duplicate", duplicate[0]

    conn.execute(
        """
        INSERT INTO candidates(
          status_id, canonical_url, handle, source_target, lane, tweet_text, views,
          posted_at, discovered_at, last_seen_at, short_format, format_reason,
          poster_url, media_fingerprint, text_fingerprint, state, editorial_class, event_key
        ) VALUES(
          :status_id, :canonical_url, :handle, :source_target, :lane, :tweet_text,
          :views, :posted_at, :discovered_at, :last_seen_at, :short_format,
          :format_reason, :poster_url, :media_fingerprint, :text_fingerprint, 'new',
          :editorial_class, :event_key
        )
        """,
        row,
    )
    return "inserted", row["status_id"]


def append_jsonl(rows: list[dict]) -> None:
    if not rows:
        return
    with JSONL_PATH.open("a") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_report(conn: sqlite3.Connection, top: int = 150) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / f"{dt.date.today().isoformat()}-x-candidates.md"
    rows = conn.execute(
        """
        SELECT short_format, lane, views, handle, tweet_text, canonical_url,
               format_reason, discovered_at, state
        FROM candidates
        WHERE state IN ('new', 'reviewing')
        ORDER BY views DESC, discovered_at DESC
        LIMIT ?
        """,
        (top,),
    ).fetchall()
    totals = conn.execute(
        "SELECT short_format, COUNT(*) FROM candidates WHERE state IN ('new','reviewing') GROUP BY short_format"
    ).fetchall()
    lines = [
        f"# FTL Hourly X Candidates — {dt.date.today().isoformat()}",
        "",
        "Source queue only. Every item requires editorial review before download, rendering, or upload.",
        "",
        "Queue: " + ", ".join(f"{name}={count}" for name, count in totals),
        "",
    ]
    for short_format, title in (
        ("split_short", "Split-short candidates — speaker on top, relevant footage below"),
        ("caption_story", "Caption-story candidates — clip-first HyperFrames story treatment"),
    ):
        lines.extend([f"## {title}", ""])
        selected = [row for row in rows if row[0] == short_format]
        if not selected:
            lines.append("- No new candidates yet.")
        for _, lane, views, handle, text, url, reason, discovered, state in selected:
            view_text = f"{views:,}" if views else "unknown"
            excerpt = " ".join((text or "native video post").split())[:180]
            lines.append(
                f"- **{view_text} views** · `{lane}` · @{handle} · [{excerpt}]({url}) "
                f"· _{reason}_ · `{state}` · discovered {discovered}"
            )
        lines.append("")
    path.write_text("\n".join(lines) + "\n")
    return path


def get_attr(locator, name: str, timeout: int = 700) -> str:
    try:
        return locator.get_attribute(name, timeout=timeout) or ""
    except Exception:
        return ""


def get_text(locator, timeout: int = 700) -> str:
    try:
        return locator.inner_text(timeout=timeout).replace("\n", " ").strip()
    except Exception:
        return ""


def article_row(article, target: dict, discovered_at: str) -> dict | None:
    videos = article.locator('[data-testid="videoComponent"], [data-testid="videoPlayer"], video')
    if videos.count() == 0:
        return None

    status_links = article.locator('a[href*="/status/"]')
    href = ""
    for index in range(min(status_links.count(), 8)):
        candidate = get_attr(status_links.nth(index), "href")
        if canonical_status_url(candidate):
            href = candidate
            break
    canonical = canonical_status_url(href)
    if not canonical:
        return None
    status_id, actual_handle, canonical_url = canonical

    text_locator = article.locator('[data-testid="tweetText"]')
    text = get_text(text_locator.nth(0)) if text_locator.count() else ""
    time_locator = article.locator("time[datetime]")
    posted_at = get_attr(time_locator.nth(0), "datetime") if time_locator.count() else ""

    views = 0
    analytics = article.locator('a[href$="/analytics"], [aria-label*="views" i]')
    for index in range(min(analytics.count(), 4)):
        label = get_attr(analytics.nth(index), "aria-label")
        if "view" in label.lower():
            views = max(views, parse_compact_number(label))

    poster_url = ""
    video_tags = article.locator("video")
    if video_tags.count():
        poster_url = get_attr(video_tags.nth(0), "poster")
    if not poster_url:
        images = article.locator('img[src*="pbs.twimg.com"]')
        for index in range(min(images.count(), 5)):
            src = get_attr(images.nth(index), "src")
            if "profile_images" not in src:
                poster_url = src
                break

    short_format, format_reason = classify(text, bool(target.get("context")))
    lane = target["lane"]
    if any(signal in text.lower() for signal in WNBA_LANE_SIGNALS):
        lane = "wnba"
    return {
        "status_id": status_id,
        "canonical_url": canonical_url,
        "handle": actual_handle,
        "source_target": target["handle"],
        "lane": lane,
        "tweet_text": text[:600],
        "views": views,
        "posted_at": posted_at or None,
        "discovered_at": discovered_at,
        "last_seen_at": discovered_at,
        "short_format": short_format,
        "format_reason": format_reason,
        "poster_url": normalize_media_url(poster_url),
        "media_fingerprint": media_fingerprint(poster_url),
        "text_fingerprint": text_fingerprint(text),
    }


def eligible(row: dict, target: dict, highlight_max_age_hours: int, min_views: int) -> bool:
    lower = (row["tweet_text"] or "").lower()
    if target["lane"] == "mixed" and not any(signal in lower for signal in SPORTS_SIGNALS):
        return False
    posted = parse_posted_at(row.get("posted_at") or "")
    if not posted:
        return False
    age = dt.datetime.now(dt.timezone.utc) - posted
    max_age_hours_for_row = (
        COMMENTARY_MAX_AGE_HOURS if row["short_format"] == "split_short" else highlight_max_age_hours
    )
    if age.total_seconds() > max_age_hours_for_row * 3600:
        return False
    if row["views"] and row["views"] < min_views:
        if row["handle"].lower() not in OFFICIAL_ALWAYS_KEEP:
            return False
    return True


def targets_from_config(include_bookmarks: bool) -> list[dict]:
    config = load_sources()
    targets = [
        {
            "handle": account["handle"],
            "lane": account["lane"],
            "context": bool(account.get("context")),
            "url": f"https://x.com/{account['handle']}",
        }
        for account in config["x_accounts"]
        if account["lane"] in ("nba", "wnba", "mixed")
    ]
    if include_bookmarks and config.get("scan_bookmarks"):
        targets.append(
            {"handle": "bookmarks", "lane": "mixed", "context": False, "url": "https://x.com/i/bookmarks"}
        )
    return targets


def scan(args) -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    lock_handle = LOCK_PATH.open("w")
    try:
        fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("collector already running; hourly invocation skipped")
        return 0

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    started = now_utc()
    run_id = conn.execute(
        "INSERT INTO runs(started_at, targets, status) VALUES(?,?,?)",
        (started, 0, "running"),
    ).lastrowid
    conn.commit()
    inserted_rows: list[dict] = []
    scanned = inserted = duplicates = 0
    targets = targets_from_config(not args.no_bookmarks)
    conn.execute("UPDATE runs SET targets=? WHERE id=?", (len(targets), run_id))
    conn.commit()

    sys.path.insert(0, str(REPO / "tools"))
    from playwright.sync_api import sync_playwright
    from yt_studio_upload import CDP_URL, _persistent

    browser = context = page = None
    owns_context = False
    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.connect_over_cdp(CDP_URL, timeout=8_000)
                if not browser.contexts:
                    raise RuntimeError("warm Tales browser has no context")
                context = browser.contexts[0]
                print("attached to the existing Tales Chrome session on :9337")
            except Exception:
                browser = None
                context = _persistent(playwright, headed=True)
                owns_context = True
                print("opened the existing Tales Chrome clone for this hourly scan")

            page = context.new_page()
            page.goto("https://x.com/home", wait_until="domcontentloaded", timeout=45_000)
            page.wait_for_timeout(4_000)
            if "/login" in page.url or "/i/flow" in page.url:
                raise RuntimeError("Tales Chrome profile is not logged into X")

            for target in targets:
                target_seen: set[str] = set()
                try:
                    page.goto(target["url"], wait_until="domcontentloaded", timeout=45_000)
                    page.wait_for_timeout(4_000)
                    if page.locator("article").count() == 0:
                        try:
                            page.locator("article").first.wait_for(state="visible", timeout=12_000)
                        except Exception:
                            pass
                except Exception as exc:
                    print(f"[skip] {target['handle']}: navigation failed: {exc}", file=sys.stderr)
                    continue

                stagnant_rounds = 0
                completed_rounds = 0
                target_started = time.monotonic()
                for round_index in range(args.rounds):
                    before_round = len(target_seen)
                    articles = page.locator("article")
                    for index in range(min(articles.count(), args.limit_per_round)):
                        row = article_row(articles.nth(index), target, now_utc())
                        if not row or row["status_id"] in target_seen:
                            continue
                        target_seen.add(row["status_id"])
                        scanned += 1
                        if not eligible(row, target, args.max_age_hours, args.min_views):
                            continue
                        row["editorial_class"] = editorial_class(row["short_format"])
                        row["event_key"] = infer_event_key(row["tweet_text"], row["lane"], row["posted_at"])
                        if args.dry_run:
                            inserted_rows.append(row)
                            continue
                        outcome, duplicate_of = store_candidate(conn, row)
                        if outcome == "inserted":
                            inserted += 1
                            inserted_rows.append(row)
                        elif outcome == "duplicate":
                            duplicates += 1
                            print(f"  duplicate {row['status_id']} -> {duplicate_of}")
                    completed_rounds = round_index + 1
                    # X virtualizes its timeline. Two smaller scrolls with load
                    # waits are more reliable than one large jump, which can
                    # skip posts before their video components enter the DOM.
                    for _ in range(2):
                        page.mouse.wheel(0, 1_900)
                        page.wait_for_timeout(1_500)
                    try:
                        page.wait_for_function(
                            "count => document.querySelectorAll('article').length > count",
                            arg=articles.count(),
                            timeout=3_500,
                        )
                    except Exception:
                        pass
                    if len(target_seen) == before_round:
                        stagnant_rounds += 1
                    else:
                        stagnant_rounds = 0
                    elapsed = time.monotonic() - target_started
                    if elapsed >= args.min_account_seconds and stagnant_rounds >= args.stagnant_rounds:
                        break
                    # A researcher should actually inhabit the feed long enough
                    # for X to hydrate videos and counters. Never leave an
                    # account before the configured minimum dwell time.
                    if round_index == args.rounds - 1 and elapsed < args.min_account_seconds:
                        page.wait_for_timeout(int((args.min_account_seconds - elapsed) * 1000))
                print(
                    f"  @{target['handle']}: {len(target_seen)} native-video posts inspected "
                    f"across {completed_rounds} scroll rounds in "
                    f"{time.monotonic() - target_started:.1f}s"
                )

            if not args.dry_run:
                conn.commit()
                policy_counts = refresh_backlog_policy(conn)
                append_jsonl(inserted_rows)
                active_path, held_path, daily_path = write_backlog_manifests(conn, CACHE)
                report_path = write_report(conn, args.report_top)
                print(f"report: {report_path}")
                print(f"active backlog: {active_path}")
                print(f"held backlog: {held_path}")
                print(f"daily production backlog: {daily_path}")
                print(f"freshness policy: {policy_counts}")
            else:
                print(json.dumps(inserted_rows[: args.report_top], indent=2, ensure_ascii=False))

        status = "dry-run" if args.dry_run else "ok"
        conn.execute(
            "UPDATE runs SET finished_at=?, scanned=?, inserted=?, duplicates=?, status=? WHERE id=?",
            (now_utc(), scanned, inserted, duplicates, status, run_id),
        )
        conn.commit()
        print(
            f"hourly X scan complete: scanned={scanned} inserted={inserted} "
            f"duplicates={duplicates} dry_run={args.dry_run}"
        )
        return 0
    except Exception as exc:
        conn.execute(
            "UPDATE runs SET finished_at=?, scanned=?, inserted=?, duplicates=?, status='error', error=? WHERE id=?",
            (now_utc(), scanned, inserted, duplicates, str(exc)[:1000], run_id),
        )
        conn.commit()
        print(f"hourly X scan failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if page is not None:
            try:
                page.close()
            except Exception:
                pass
        if owns_context and context is not None:
            try:
                context.close()
            except Exception:
                pass
        conn.close()
        lock_handle.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=20)
    parser.add_argument("--stagnant-rounds", type=int, default=2)
    parser.add_argument("--min-account-seconds", type=float, default=60.0)
    parser.add_argument("--limit-per-round", type=int, default=24)
    parser.add_argument("--max-age-hours", type=int, default=72)
    parser.add_argument("--min-views", type=int, default=5_000)
    parser.add_argument("--report-top", type=int, default=150)
    parser.add_argument("--no-bookmarks", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return scan(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
