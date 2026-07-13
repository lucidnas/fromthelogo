#!/usr/bin/env python3
"""Claim and process one queued X candidate through the FTL Codex workflow.

The worker owns queue state and deduplication. Codex owns media inspection,
HyperFrames authoring/QC, and draft-only YouTube Studio upload. One launchd run
handles at most one candidate so jobs never overlap or flood Studio.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import urllib.request


REPO = Path(__file__).resolve().parents[1]
CACHE = Path("/Volumes/SSK SSD/fromthelogo-cache/x-hourly-collector")
DB_PATH = CACHE / "candidates.sqlite3"
JOBS_DIR = CACHE / "jobs"
LOCK_PATH = CACHE / "queue-agent.lock"
SCHEMA_PATH = REPO / "tools" / "schemas" / "ftl-x-queue-agent-result.schema.json"
NOTIFY_CONFIG = Path.home() / ".config" / "fromthelogo" / "notifications.json"
CODEX = Path("/Users/abdul/.nvm/versions/node/v20.19.0/bin/codex")


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_worker_schema(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(candidates)")}
    additions = {
        "attempts": "INTEGER NOT NULL DEFAULT 0",
        "claimed_at": "TEXT",
        "processed_at": "TEXT",
        "result_json": "TEXT",
        "last_error": "TEXT",
        "final_video": "TEXT",
        "youtube_title": "TEXT",
        "priority": "INTEGER NOT NULL DEFAULT 0",
        "source_path": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE candidates ADD COLUMN {name} {definition}")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS processed_sources (
          status_id TEXT PRIMARY KEY,
          canonical_url TEXT NOT NULL,
          media_fingerprint TEXT,
          source_sha256 TEXT,
          final_sha256 TEXT,
          authoritative_format TEXT NOT NULL,
          final_video TEXT NOT NULL,
          youtube_title TEXT NOT NULL,
          draft_verified INTEGER NOT NULL,
          processed_at TEXT NOT NULL,
          result_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS processed_media_idx
          ON processed_sources(media_fingerprint);
        CREATE INDEX IF NOT EXISTS processed_source_sha_idx
          ON processed_sources(source_sha256);
        """
    )
    conn.commit()


def reset_stale_claims(conn: sqlite3.Connection, hours: int = 6) -> int:
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)).isoformat(timespec="seconds")
    cursor = conn.execute(
        "UPDATE candidates SET state='new', claimed_at=NULL, last_error='stale processing claim reset' "
        "WHERE state='processing' AND claimed_at<?",
        (cutoff,),
    )
    conn.commit()
    return cursor.rowcount


def claim_candidate(conn: sqlite3.Connection, status_id: str | None = None) -> dict | None:
    conn.execute("BEGIN IMMEDIATE")
    params: list[str] = []
    where = "c.state='new'"
    if status_id:
        where += " AND c.status_id=?"
        params.append(status_id)
    row = conn.execute(
        f"""
        SELECT c.status_id, c.canonical_url, c.handle, c.source_target, c.lane,
               c.tweet_text, c.views, c.posted_at, c.discovered_at,
               c.short_format, c.format_reason, c.poster_url,
               c.media_fingerprint, COALESCE(c.attempts, 0),
               COALESCE(c.priority, 0), COALESCE(c.source_path, '')
        FROM candidates c
        WHERE {where}
          AND NOT EXISTS (
            SELECT 1 FROM processed_sources p
            WHERE p.status_id=c.status_id
               OR (c.media_fingerprint<>'' AND p.media_fingerprint=c.media_fingerprint)
          )
        ORDER BY COALESCE(c.priority, 0) DESC,
                 CASE c.lane WHEN 'wnba' THEN 0 WHEN 'mixed' THEN 1 ELSE 2 END,
                 c.views DESC, c.discovered_at ASC
        LIMIT 1
        """,
        params,
    ).fetchone()
    if not row:
        conn.commit()
        return None
    fields = (
        "status_id", "canonical_url", "handle", "source_target", "lane",
        "tweet_text", "views", "posted_at", "discovered_at", "preliminary_format",
        "preliminary_reason", "poster_url", "media_fingerprint", "attempts",
        "priority", "source_path",
    )
    candidate = dict(zip(fields, row))
    claimed = now_utc()
    conn.execute(
        "UPDATE candidates SET state='processing', claimed_at=?, attempts=attempts+1, last_error=NULL "
        "WHERE status_id=?",
        (claimed, candidate["status_id"]),
    )
    conn.commit()
    candidate["claimed_at"] = claimed
    candidate["attempts"] += 1
    return candidate


def notify(title: str, message: str, *, priority: str = "default", tags: str = "basketball") -> bool:
    if not NOTIFY_CONFIG.exists():
        print(f"ntfy config missing: {NOTIFY_CONFIG}", file=sys.stderr)
        return False
    config = json.loads(NOTIFY_CONFIG.read_text())
    topic = config.get("ntfy_topic", "").strip()
    server = config.get("ntfy_server", "https://ntfy.sh").rstrip("/")
    if not topic:
        print("ntfy_topic is empty", file=sys.stderr)
        return False
    request = urllib.request.Request(
        f"{server}/{topic}",
        data=message.encode(),
        method="POST",
        headers={"Title": title, "Priority": priority, "Tags": tags},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            print(f"ntfy: {response.status} {title}")
        return True
    except Exception as exc:
        print(f"ntfy failed: {exc}", file=sys.stderr)
        return False


def seed_candidate(
    conn: sqlite3.Connection,
    *,
    url: str,
    text: str,
    lane: str,
    short_format: str,
    priority: int,
    source_path: str,
) -> str:
    existing = conn.execute(
        "SELECT status_id FROM candidates WHERE canonical_url=?",
        (url,),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE candidates SET priority=MAX(COALESCE(priority,0), ?), "
            "tweet_text=CASE WHEN ?<>'' THEN ? ELSE tweet_text END, "
            "short_format=?, source_path=CASE WHEN ?<>'' THEN ? ELSE source_path END, "
            "state=CASE WHEN state IN ('uploaded_draft','processing') THEN state ELSE 'new' END, "
            "last_seen_at=? WHERE status_id=?",
            (priority, text, text, short_format, source_path, source_path, now_utc(), existing[0]),
        )
        conn.commit()
        return existing[0]
    status_id = "manual:" + hashlib.sha256(url.encode()).hexdigest()[:20]
    timestamp = now_utc()
    conn.execute(
        """
        INSERT INTO candidates(
          status_id, canonical_url, handle, source_target, lane, tweet_text, views,
          posted_at, discovered_at, last_seen_at, short_format, format_reason,
          poster_url, media_fingerprint, text_fingerprint, state, priority, source_path
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(status_id) DO UPDATE SET
          tweet_text=excluded.tweet_text,
          lane=excluded.lane,
          short_format=excluded.short_format,
          priority=MAX(candidates.priority, excluded.priority),
          source_path=CASE WHEN excluded.source_path<>'' THEN excluded.source_path ELSE candidates.source_path END,
          state=CASE WHEN candidates.state IN ('uploaded_draft','processing') THEN candidates.state ELSE 'new' END,
          last_seen_at=excluded.last_seen_at
        """,
        (
            status_id, url, "manual", "manual", lane, text, 0, None, timestamp, timestamp,
            short_format, "user-priority manual seed", "", "", "", "new", priority, source_path,
        ),
    )
    conn.commit()
    return status_id


def agent_prompt(candidate: dict, job_dir: Path) -> str:
    candidate_json = json.dumps(candidate, indent=2, ensure_ascii=False)
    return f"""
Process exactly one From The Logo X candidate end to end. The user explicitly authorizes:
downloading this public X media, creating a finished Short, uploading it to the From The Logo
YouTube Studio channel as a DRAFT, and verifying that draft. Never publish or schedule it.

Read and obey /Users/abdul/code/fromthelogo/AGENTS.md and the relevant format docs first.
HyperFrames is mandatory for the final authored MP4. FFmpeg may only prepare media.

Candidate:
{candidate_json}

Job directory: {job_dir}
Candidate database: {DB_PATH}

Required workflow:
1. Recheck the candidates, duplicates, and processed_sources tables before doing work. If this
   status ID, canonical URL, media fingerprint, or downloaded source SHA-256 was already processed,
   return status=duplicate without rendering or uploading.
2. Download the exact public source URL into the job directory, or copy candidate.source_path when
   it points to an existing verified local source. Prefer yt-dlp or the established FTL social-source
   workflow. Do not substitute a different post or video.
3. Run Gemini 2.5 Pro on the actual downloaded video before deciding the format. The preliminary
   database label is only a hint.
4. Authoritative format rules:
   - split_short: a visible, attributable person is speaking, reacting, debating, explaining, or
     delivering a complete thought. Preserve the complete thought, normally 30-45 seconds. Put the
     speaker on top and specifically relevant footage on the bottom. If relevant lower footage
     cannot be sourced and verified, return needs_assets. Never use unrelated filler.
   - caption_story: the footage itself is the story, including a play, performance, record, arrival,
     celebration, news event, or other visual sequence. Use timed story-caption beats, not a single
     static headline. Use FTL navy/white/gold and keep the important action zoomed out and visible.
   - reject: narration-only/AI material, unusable footage, misleading context, duplicate compilation,
     or a clip that supports neither treatment.
5. Build an inspectable HyperFrames HTML composition. Run `npx hyperframes check --json --snapshots`,
   inspect representative snapshots, and render the final MP4 with `npx hyperframes render`.
6. Run Gemini upload-gate QC on the rendered MP4. Do not upload unless QC says upload-ready and there
   are no critical or major issues. Revise within this job when safe; otherwise return failed.
7. Generate lean Shorts metadata with Caitlin Clark and WNBA hashtags when the topic is WNBA/FTL.
   Upload through tools/yt_studio_upload.py as a headed DRAFT only. Verify the exact title appears as
   Draft on the Shorts tab. Never click Publish and never schedule.
8. Return only the JSON object required by the provided output schema. draftVerified may be true only
   after the Studio verification command explicitly confirms Draft. Include absolute paths and SHA-256.
""".strip()


def run_codex(candidate: dict, job_dir: Path) -> tuple[int, dict | None, str]:
    result_path = job_dir / "agent-result.json"
    transcript_path = job_dir / "codex-events.jsonl"
    prompt = agent_prompt(candidate, job_dir)
    command = [
        str(CODEX), "exec",
        "--ephemeral",
        "--json",
        "--sandbox", "danger-full-access",
        "--cd", str(REPO),
        "--add-dir", "/Volumes/SSK SSD",
        "--output-schema", str(SCHEMA_PATH),
        "--output-last-message", str(result_path),
        prompt,
    ]
    with transcript_path.open("w") as transcript:
        process = subprocess.run(
            command,
            cwd=REPO,
            stdout=transcript,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=55 * 60,
            env={**os.environ, "HOME": str(Path.home()), "CODEX_HOME": str(Path.home() / ".codex")},
        )
    if not result_path.exists():
        return process.returncode, None, f"Codex produced no result file; see {transcript_path}"
    raw = result_path.read_text().strip()
    try:
        return process.returncode, json.loads(raw), ""
    except json.JSONDecodeError as exc:
        return process.returncode, None, f"invalid agent result JSON: {exc}; see {result_path}"


def finish_candidate(conn: sqlite3.Connection, candidate: dict, result: dict | None, error: str) -> str:
    status_id = candidate["status_id"]
    attempts = candidate["attempts"]
    if result is None:
        next_state = "new" if attempts < 3 else "failed"
        conn.execute(
            "UPDATE candidates SET state=?, claimed_at=NULL, last_error=? WHERE status_id=?",
            (next_state, error[:2000], status_id),
        )
        conn.commit()
        return next_state

    status = result["status"]
    result_json = json.dumps(result, ensure_ascii=False)
    if status == "uploaded_draft":
        final_video = result.get("finalVideo", "")
        if not result.get("draftVerified") or not final_video or not Path(final_video).is_file():
            status = "failed"
            error = "agent claimed uploaded_draft without a verified draft and existing final video"
        else:
            final_sha = sha256_file(final_video)
            conn.execute(
                """
                INSERT OR REPLACE INTO processed_sources(
                  status_id, canonical_url, media_fingerprint, source_sha256, final_sha256,
                  authoritative_format, final_video, youtube_title, draft_verified,
                  processed_at, result_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    status_id, candidate["canonical_url"], candidate["media_fingerprint"],
                    result.get("sourceSha256", ""), final_sha,
                    result["authoritativeFormat"], final_video, result.get("youtubeTitle", ""),
                    1, now_utc(), result_json,
                ),
            )
            conn.execute(
                "UPDATE candidates SET state='uploaded_draft', processed_at=?, claimed_at=NULL, "
                "result_json=?, final_video=?, youtube_title=?, last_error=NULL WHERE status_id=?",
                (now_utc(), result_json, final_video, result.get("youtubeTitle", ""), status_id),
            )
            conn.commit()
            return "uploaded_draft"

    state_map = {
        "needs_assets": "needs_assets",
        "rejected": "rejected",
        "duplicate": "duplicate",
        "failed": "new" if attempts < 3 else "failed",
    }
    next_state = state_map.get(status, "failed")
    conn.execute(
        "UPDATE candidates SET state=?, processed_at=?, claimed_at=NULL, result_json=?, last_error=? "
        "WHERE status_id=?",
        (next_state, now_utc(), result_json, (error or result.get("reason", ""))[:2000], status_id),
    )
    conn.commit()
    return next_state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", default=None, help="process a specific queued status ID")
    parser.add_argument("--dry-run", action="store_true", help="show the next claim without changing queue state")
    parser.add_argument("--seed-url", default=None, help="add or reprioritize a manual public source")
    parser.add_argument("--seed-text", default="", help="editorial description for --seed-url")
    parser.add_argument("--seed-lane", choices=("wnba", "nba", "mixed"), default="wnba")
    parser.add_argument("--seed-format", choices=("split_short", "caption_story"), default="caption_story")
    parser.add_argument("--seed-priority", type=int, default=100)
    parser.add_argument("--seed-source", default="", help="optional verified local source path")
    args = parser.parse_args()

    CACHE.mkdir(parents=True, exist_ok=True)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        print(f"candidate database does not exist: {DB_PATH}", file=sys.stderr)
        return 1
    lock_handle = LOCK_PATH.open("w")
    try:
        fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("queue agent already running; invocation skipped")
        return 0

    conn = sqlite3.connect(DB_PATH)
    try:
        ensure_worker_schema(conn)
        reset = reset_stale_claims(conn)
        if reset:
            print(f"reset {reset} stale processing claim(s)")
        if args.seed_url:
            status_id = seed_candidate(
                conn,
                url=args.seed_url,
                text=args.seed_text or args.seed_url,
                lane=args.seed_lane,
                short_format=args.seed_format,
                priority=args.seed_priority,
                source_path=args.seed_source,
            )
            print(f"seeded {status_id}: {args.seed_text or args.seed_url}")
            return 0
        if args.dry_run:
            query = "SELECT status_id, canonical_url, lane, short_format, views, priority, tweet_text FROM candidates WHERE state='new'"
            values: tuple[str, ...] = ()
            if args.candidate:
                query += " AND status_id=?"
                values = (args.candidate,)
            query += " ORDER BY priority DESC, CASE lane WHEN 'wnba' THEN 0 WHEN 'mixed' THEN 1 ELSE 2 END, views DESC LIMIT 1"
            row = conn.execute(query, values).fetchone()
            print(json.dumps(row, indent=2, ensure_ascii=False))
            return 0

        candidate = claim_candidate(conn, args.candidate)
        if not candidate:
            print("queue empty — nothing new to process")
            return 0

        job_dir = JOBS_DIR / f"{candidate['status_id']}-attempt-{candidate['attempts']}"
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "candidate.json").write_text(json.dumps(candidate, indent=2, ensure_ascii=False) + "\n")
        print(f"claimed {candidate['status_id']} ({candidate['lane']}, {candidate['preliminary_format']})")
        returncode, result, error = run_codex(candidate, job_dir)
        if returncode and not error:
            error = f"Codex exited {returncode}"
        final_state = finish_candidate(conn, candidate, result, error)

        if final_state == "uploaded_draft" and result:
            title = result.get("youtubeTitle") or candidate["tweet_text"][:70]
            notify(
                "FTL draft ready",
                f"{title}\nFormat: {result['authoritativeFormat']}\nSource: {candidate['canonical_url']}",
                priority="high",
                tags="white_check_mark,basketball",
            )
        elif final_state == "needs_assets":
            notify(
                "FTL clip needs assets",
                f"{candidate['tweet_text'][:120]}\n{candidate['canonical_url']}",
                tags="warning,basketball",
            )
        elif final_state in ("failed", "new"):
            notify(
                "FTL queue worker issue",
                f"Candidate {candidate['status_id']}: {error or (result or {}).get('reason', 'failed')}",
                priority="high",
                tags="x,basketball",
            )
        print(f"candidate {candidate['status_id']} -> {final_state}")
        return 0 if final_state not in ("failed",) else 1
    finally:
        conn.close()
        lock_handle.close()


if __name__ == "__main__":
    raise SystemExit(main())
