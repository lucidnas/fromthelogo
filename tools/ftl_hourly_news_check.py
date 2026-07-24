#!/usr/bin/env python3
"""Quick hourly From The Logo news monitor.

The monitor combines:
  * a shallow X/bookmark collector pass when the warm Tales CDP browser exists;
  * the existing real-time FTL web-news scanner;
  * persistent URL deduplication and compact per-run reports;
  * low-noise ntfy alerts for a newly ranked top lead, or three failures in a row.

It never renders, uploads, publishes, or schedules channel content.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request


REPO = Path("/Users/abdul/code/fromthelogo")
CACHE = Path("/Volumes/SSK SSD/fromthelogo-cache/hourly-news-check")
RUNS = CACHE / "runs"
STATE_PATH = CACHE / "state.json"
LOCK_PATH = CACHE / "monitor.lock"
NOTIFY_CONFIG = Path.home() / ".config" / "fromthelogo" / "notifications.json"
PYTHON = Path("/Users/abdul/.pyenv/versions/tiktok-browser-agents/bin/python")
NODE = Path("/opt/homebrew/bin/node")
CDP_VERSION_URL = "http://127.0.0.1:9337/json/version"
PROCESSOR_LOG = Path.home() / "Library" / "Logs" / "FromTheLogo" / "hourly-review-processor.log"


def local_now() -> dt.datetime:
    return dt.datetime.now().astimezone()


def load_state() -> dict:
    try:
        data = json.loads(STATE_PATH.read_text())
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return {"seen_urls": {}, "consecutive_failures": 0}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def notify(title: str, message: str, click_url: str = "", priority: str = "default") -> bool:
    try:
        config = json.loads(NOTIFY_CONFIG.read_text())
        server = str(config.get("ntfy_server", "https://ntfy.sh")).rstrip("/")
        topic = str(config.get("ntfy_topic", "")).strip()
        if not topic:
            return False
        headers = {
            "Title": title,
            "Priority": priority,
            "Tags": "newspaper,basketball",
        }
        if click_url:
            headers["Click"] = click_url
        request = urllib.request.Request(
            f"{server}/{topic}",
            data=message.encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            return 200 <= response.status < 300
    except (OSError, json.JSONDecodeError, urllib.error.URLError):
        return False


def warm_tales_browser_ready() -> bool:
    try:
        with urllib.request.urlopen(CDP_VERSION_URL, timeout=2) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def run_command(command: list[str], timeout: int) -> dict:
    started = local_now()
    try:
        result = subprocess.run(
            command,
            cwd=REPO,
            text=True,
            capture_output=True,
            timeout=timeout,
            env={
                **os.environ,
                "HOME": str(Path.home()),
                "PATH": (
                    "/Users/abdul/.nvm/versions/node/v20.19.0/bin:"
                    "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
                ),
                "PYTHONUNBUFFERED": "1",
            },
        )
        return {
            "command": command,
            "started_at": started.isoformat(timespec="seconds"),
            "finished_at": local_now().isoformat(timespec="seconds"),
            "returncode": result.returncode,
            "stdout": result.stdout[-20_000:],
            "stderr": result.stderr[-20_000:],
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "command": command,
            "started_at": started.isoformat(timespec="seconds"),
            "finished_at": local_now().isoformat(timespec="seconds"),
            "returncode": 124,
            "stdout": (exc.stdout or "")[-20_000:] if isinstance(exc.stdout, str) else "",
            "stderr": "timed out",
        }


def trigger_review_processor(batch_size: int = 5) -> dict:
    """Launch one review-only batch worker after the research commit.

    A single fcntl lock prevents overlapping production sessions. The worker
    claims up to ``batch_size`` candidates and handles them in one coordinated
    Codex/HyperFrames session rather than launching competing render agents.
    """
    PROCESSOR_LOG.parent.mkdir(parents=True, exist_ok=True)
    try:
        log = PROCESSOR_LOG.open("a")
        process = subprocess.Popen(
            [
                str(PYTHON),
                str(REPO / "tools" / "ftl_x_queue_agent.py"),
                "--batch-size",
                str(batch_size),
            ],
            cwd=REPO,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            close_fds=True,
            env={
                **os.environ,
                "HOME": str(Path.home()),
                "CODEX_HOME": str(Path.home() / ".codex"),
                "PATH": (
                    "/Users/abdul/.nvm/versions/node/v20.19.0/bin:"
                    "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
                ),
                "PYTHONUNBUFFERED": "1",
            },
        )
        log.close()
        return {
            "status": "started",
            "batch_size": batch_size,
            "pid": process.pid,
            "log": str(PROCESSOR_LOG),
        }
    except OSError as exc:
        return {"status": "error", "error": str(exc), "log": str(PROCESSOR_LOG)}


def parse_ranked_stories(markdown_path: Path) -> list[dict]:
    try:
        text = markdown_path.read_text()
    except OSError:
        return []
    sections = re.split(r"(?m)^---\s*$", text)
    stories: list[dict] = []
    for section in sections:
        heading = re.search(r"(?m)^##\s+(\d+)\.\s+(.+?)\s*$", section)
        url = re.search(r"(?m)^\*\*URL:\*\*\s+(https?://\S+)", section)
        outlet = re.search(r"(?m)^\*\*Outlet:\*\*\s+(.+?)\s*$", section)
        published = re.search(r"(?m)^\*\*Published:\*\*\s+(.+?)\s*$", section)
        if not heading or not url:
            continue
        stories.append(
            {
                "rank": int(heading.group(1)),
                "title": heading.group(2).strip(),
                "url": url.group(1).strip(),
                "outlet": outlet.group(1).strip() if outlet else "",
                "published": published.group(1).strip() if published else "",
            }
        )
    return sorted(stories, key=lambda story: story["rank"])


def prune_runs(now: dt.datetime, keep_days: int = 7) -> None:
    cutoff = now.timestamp() - keep_days * 86_400
    if not RUNS.exists():
        return
    for child in RUNS.iterdir():
        try:
            if child.is_dir() and child.stat().st_mtime < cutoff:
                shutil.rmtree(child)
        except OSError:
            continue


def check_environment() -> int:
    checks = {
        "repo": REPO.is_dir(),
        "ssd_cache_parent": CACHE.parent.is_dir(),
        "python": PYTHON.is_file(),
        "node": NODE.is_file(),
        "codex": shutil.which("codex") is not None
        or Path("/Users/abdul/.nvm/versions/node/v20.19.0/bin/codex").is_file(),
        "news_scanner": (REPO / "tools" / "ftl-news-scan.mjs").is_file(),
        "x_collector": (REPO / "tools" / "ftl_x_hourly_collector.py").is_file(),
        "review_processor": (REPO / "tools" / "ftl_x_queue_agent.py").is_file(),
        "ntfy_config": NOTIFY_CONFIG.is_file(),
        "warm_tales_browser": warm_tales_browser_ready(),
    }
    for name, ok in checks.items():
        print(f"{'ok  ' if ok else 'MISS'} {name}")
    required = {key: value for key, value in checks.items() if key not in {"ntfy_config", "warm_tales_browser"}}
    return 0 if all(required.values()) else 1


def run_monitor() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    RUNS.mkdir(parents=True, exist_ok=True)
    lock = LOCK_PATH.open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("hourly news check already running; skipping this invocation")
        return 0

    now = local_now()
    run_id = now.strftime("%Y-%m-%dT%H%M%S%z")
    run_dir = RUNS / run_id
    run_dir.mkdir()
    report: dict = {
        "run_id": run_id,
        "started_at": now.isoformat(timespec="seconds"),
        "x_scan": {"status": "skipped_no_warm_tales_browser"},
        "news_scan": {},
        "stories": [],
    }
    state = load_state()
    state.setdefault("seen_urls", {})
    failures: list[str] = []

    if warm_tales_browser_ready():
        x_result = run_command(
            [
                str(PYTHON),
                str(REPO / "tools" / "ftl_x_hourly_collector.py"),
                "--rounds",
                "1",
                "--stagnant-rounds",
                "1",
                "--min-account-seconds",
                "0",
                "--limit-per-round",
                "18",
                "--max-age-hours",
                "72",
                "--min-views",
                "1000",
                "--report-top",
                "60",
            ],
            timeout=15 * 60,
        )
        match = re.search(r"inserted=(\d+)", x_result.get("stdout", ""))
        x_result["inserted"] = int(match.group(1)) if match else 0
        x_result["status"] = "ok" if x_result["returncode"] == 0 else "error"
        report["x_scan"] = x_result
        if x_result["returncode"] != 0:
            failures.append("X/bookmark scan failed")

    markdown_path = run_dir / "news-stories.md"
    news_result = run_command(
        [
            str(NODE),
            str(REPO / "tools" / "ftl-news-scan.mjs"),
            "--limit",
            "6",
            "--out",
            str(markdown_path),
        ],
        timeout=25 * 60,
    )
    news_result["status"] = "ok" if news_result["returncode"] == 0 else "error"
    report["news_scan"] = news_result
    if news_result["returncode"] != 0:
        failures.append("live web-news scan failed")

    stories = parse_ranked_stories(markdown_path)
    report["stories"] = stories
    new_stories = [story for story in stories if story["url"] not in state["seen_urls"]]
    report["new_story_urls"] = [story["url"] for story in new_stories]
    for story in stories:
        state["seen_urls"][story["url"]] = now.isoformat(timespec="seconds")

    processor = trigger_review_processor(batch_size=5)
    report["review_processor"] = processor
    if processor["status"] != "started":
        failures.append("review processor could not be started")

    cutoff = now - dt.timedelta(days=14)
    state["seen_urls"] = {
        url: seen_at
        for url, seen_at in state["seen_urls"].items()
        if dt.datetime.fromisoformat(seen_at) >= cutoff
    }

    if failures:
        state["consecutive_failures"] = int(state.get("consecutive_failures", 0)) + 1
        report["status"] = "error"
        report["failures"] = failures
        if state["consecutive_failures"] == 3:
            notify(
                "FTL hourly monitor needs attention",
                "Three hourly checks failed in a row: " + "; ".join(failures),
                priority="high",
            )
    else:
        state["consecutive_failures"] = 0
        report["status"] = "ok"
        if new_stories:
            top = new_stories[0]
            x_inserted = int(report.get("x_scan", {}).get("inserted", 0))
            suffix = f" X queue also added {x_inserted} fresh clip(s)." if x_inserted else ""
            notify(
                "New FTL news lead",
                f"{top['title']} ({top['outlet']}).{suffix}",
                click_url=top["url"],
                priority="default",
            )

    report["finished_at"] = local_now().isoformat(timespec="seconds")
    (run_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (CACHE / "latest.json").write_text(json.dumps(report, indent=2) + "\n")
    save_state(state)
    prune_runs(now)
    print(
        json.dumps(
            {
                "status": report["status"],
                "run": str(run_dir),
                "ranked_stories": len(stories),
                "new_stories": len(new_stories),
                "x_status": report["x_scan"].get("status"),
                "x_inserted": report["x_scan"].get("inserted", 0),
                "review_processor": report["review_processor"],
            },
            indent=2,
        )
    )
    return 0 if not failures else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the quick hourly FTL news monitor")
    parser.add_argument("--check", action="store_true", help="validate prerequisites without scanning")
    args = parser.parse_args()
    return check_environment() if args.check else run_monitor()


if __name__ == "__main__":
    raise SystemExit(main())
