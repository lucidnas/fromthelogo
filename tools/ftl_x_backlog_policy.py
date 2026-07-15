#!/usr/bin/env python3
"""Freshness and event-frequency policy for the FTL X Shorts queue.

The policy is intentionally non-destructive. Ineligible rows are moved to a
recoverable hold state; source URLs, media fingerprints, and job files remain
untouched.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import re
import sqlite3


HIGHLIGHT_MAX_AGE_HOURS = 72
COMMENTARY_MAX_AGE_HOURS = 120
MAX_EVENT_ANGLE_CANDIDATES = 2
ACTIVE_STATES = ("new", "reviewing")
POLICY_HOLD_STATES = ("held_stale", "held_angle", "held_unverified_date", "held_evergreen_review")

SUBJECT_ALIASES = {
    "caitlin-clark": ("caitlin clark",),
    "sophie-cunningham": ("sophie cunningham",),
    "kelsey-mitchell": ("kelsey mitchell",),
    "aliyah-boston": ("aliyah boston",),
    "candace-parker": ("candace parker",),
    "dana-white": ("dana white",),
    "lebron-james": ("lebron james", "lebron"),
    "caleb-wilson": ("caleb wilson",),
    "labaron-philon": ("labaron philon",),
    "kiki-iriafen": ("kiki iriafen",),
    "paige-bueckers": ("paige bueckers",),
    "lamelo-ball": ("lamelo ball", "lamelo"),
}

TOPIC_ALIASES = {
    "ufc-ring-girl": ("ring girl", "ufc", "dana white"),
    "assist-record": ("600 assist", "600th assist", "assist record", "fastest"),
    "three-pointer": ("three", "3-pointer", "triple", "from deep"),
    "dunk": ("dunk", "poster", "put back", "putback"),
    "game-result": ("final", "defeat", "win at home", "statement win"),
    "performance": ("points", "rebounds", "assists", "stat line", "tonight"),
    "reaction": ("reaction", "reacts", "responds", "caught", "stare"),
    "interview": ("interview", "podcast", "says", "said", "asked", "explains"),
    "golf": ("golf", "golfing"),
}


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_timestamp(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def editorial_class(short_format: str) -> str:
    return "commentary" if short_format == "split_short" else "highlight"


def max_age_hours(short_format: str) -> int:
    return COMMENTARY_MAX_AGE_HOURS if editorial_class(short_format) == "commentary" else HIGHLIGHT_MAX_AGE_HOURS


def _first_alias(text: str, aliases: dict[str, tuple[str, ...]]) -> str:
    lower = text.lower()
    for canonical, phrases in aliases.items():
        if any(phrase in lower for phrase in phrases):
            return canonical
    return ""


def infer_event_key(text: str, lane: str, posted_at: str | None) -> str:
    """Return a conservative same-event key, or blank when confidence is low."""
    posted = parse_timestamp(posted_at)
    subject = _first_alias(text or "", SUBJECT_ALIASES)
    topic = _first_alias(text or "", TOPIC_ALIASES)
    if not posted or not subject or not topic:
        return ""
    return f"{posted.date().isoformat()}:{lane}:{subject}:{topic}"


def references_historical_year(text: str, current_year: int) -> bool:
    years = {int(value) for value in re.findall(r"\b(?:19|20)\d{2}\b", text or "")}
    return any(year < current_year - 1 for year in years)


def ensure_policy_schema(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(candidates)")}
    additions = {
        "priority": "INTEGER NOT NULL DEFAULT 0",
        "editorial_class": "TEXT",
        "event_key": "TEXT",
        "is_evergreen": "INTEGER NOT NULL DEFAULT 0",
        "hold_reason": "TEXT",
        "held_at": "TEXT",
    }
    for name, definition in additions.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE candidates ADD COLUMN {name} {definition}")
    conn.execute("CREATE INDEX IF NOT EXISTS candidates_event_idx ON candidates(event_key, state)")
    conn.commit()


def refresh_backlog_policy(conn: sqlite3.Connection, *, at: dt.datetime | None = None) -> dict[str, int]:
    """Re-evaluate claimable rows and put stale/overused angles on hold."""
    ensure_policy_schema(conn)
    at = at or now_utc()
    stamp = at.isoformat(timespec="seconds")

    # Policy-owned holds can be reconsidered on every pass. Other workflow
    # states (processing, uploaded, rejected, needs_review, etc.) are untouched.
    conn.execute(
        "UPDATE candidates SET state='new', hold_reason=NULL, held_at=NULL "
        "WHERE state IN ('held_stale','held_angle','held_unverified_date','held_evergreen_review')"
    )
    # Keep policy metadata current for the entire ledger so already produced
    # work counts toward the two-angle ceiling.
    metadata_rows = conn.execute(
        "SELECT status_id, lane, tweet_text, posted_at, short_format FROM candidates"
    ).fetchall()
    for status_id, lane, text, posted_at, short_format in metadata_rows:
        conn.execute(
            "UPDATE candidates SET editorial_class=?, event_key=? WHERE status_id=?",
            (editorial_class(short_format), infer_event_key(text, lane, posted_at), status_id),
        )

    rows = conn.execute(
        """
        SELECT status_id, lane, tweet_text, posted_at, discovered_at, short_format,
               COALESCE(priority,0), views, COALESCE(is_evergreen,0)
        FROM candidates
        WHERE state IN ('new','reviewing')
        """
    ).fetchall()

    eligible: list[dict] = []
    counts = {"active": 0, "held_stale": 0, "held_angle": 0, "held_unverified_date": 0, "held_evergreen_review": 0}
    for status_id, lane, text, posted_at, discovered_at, short_format, priority, views, evergreen in rows:
        klass = editorial_class(short_format)
        event_key = infer_event_key(text, lane, posted_at)
        posted = parse_timestamp(posted_at)
        if not posted and not evergreen:
            conn.execute(
                "UPDATE candidates SET state='held_unverified_date', hold_reason=?, held_at=? WHERE status_id=?",
                ("source post date is missing; freshness cannot be verified", stamp, status_id),
            )
            counts["held_unverified_date"] += 1
            continue
        if not evergreen and references_historical_year(text, at.year):
            conn.execute(
                "UPDATE candidates SET state='held_evergreen_review', hold_reason=?, held_at=? WHERE status_id=?",
                ("story references a historical year and needs explicit evergreen approval", stamp, status_id),
            )
            counts["held_evergreen_review"] += 1
            continue
        if posted and not evergreen:
            age_hours = max(0.0, (at - posted).total_seconds() / 3600)
            limit = max_age_hours(short_format)
            if age_hours > limit:
                conn.execute(
                    "UPDATE candidates SET state='held_stale', hold_reason=?, held_at=? WHERE status_id=?",
                    (f"{klass} is {age_hours:.1f}h old; limit is {limit}h", stamp, status_id),
                )
                counts["held_stale"] += 1
                continue
        eligible.append({
            "status_id": status_id,
            "event_key": event_key,
            "priority": priority,
            "views": views,
            "posted": posted or parse_timestamp(discovered_at) or at,
        })

    grouped: dict[str, list[dict]] = {}
    for row in eligible:
        if row["event_key"]:
            grouped.setdefault(row["event_key"], []).append(row)
    held_angle_ids: set[str] = set()
    for event_key, group in grouped.items():
        consumed = conn.execute(
            "SELECT COUNT(*) FROM candidates WHERE event_key=? "
            "AND state IN ('processing','uploaded_draft')",
            (event_key,),
        ).fetchone()[0]
        available_slots = max(0, MAX_EVENT_ANGLE_CANDIDATES - consumed)
        group.sort(key=lambda row: (row["priority"], row["views"], row["posted"]), reverse=True)
        for row in group[available_slots:]:
            conn.execute(
                "UPDATE candidates SET state='held_angle', hold_reason=?, held_at=? WHERE status_id=?",
                (f"event/angle cap is {MAX_EVENT_ANGLE_CANDIDATES}: {event_key}", stamp, row["status_id"]),
            )
            held_angle_ids.add(row["status_id"])
            counts["held_angle"] += 1
    counts["active"] = len(eligible) - len(held_angle_ids)
    conn.commit()
    return counts


def write_backlog_manifests(conn: sqlite3.Connection, cache: Path) -> tuple[Path, Path, Path]:
    ensure_policy_schema(conn)
    columns = "status_id, canonical_url, lane, short_format, editorial_class, event_key, views, posted_at, tweet_text, state, hold_reason"
    active_rows = conn.execute(
        f"SELECT {columns} FROM candidates WHERE state IN ('new','reviewing') "
        "ORDER BY COALESCE(priority,0) DESC, views DESC, posted_at DESC"
    ).fetchall()
    held_rows = conn.execute(
        f"SELECT {columns} FROM candidates WHERE state IN ('held_stale','held_angle','held_unverified_date','held_evergreen_review') "
        "ORDER BY held_at DESC, posted_at DESC"
    ).fetchall()
    keys = ("status_id", "canonical_url", "lane", "short_format", "editorial_class", "event_key", "views", "posted_at", "tweet_text", "state", "hold_reason")
    active_path = cache / "active-backlog.json"
    held_path = cache / "held-backlog.json"
    daily_path = cache / "daily-production-backlog.json"
    active_path.write_text(json.dumps([dict(zip(keys, row)) for row in active_rows], indent=2, ensure_ascii=False) + "\n")
    held_path.write_text(json.dumps([dict(zip(keys, row)) for row in held_rows], indent=2, ensure_ascii=False) + "\n")
    active = [dict(zip(keys, row)) for row in active_rows]
    def daily_sort(row: dict) -> tuple:
        lower = (row["tweet_text"] or "").lower()
        clark_lens = 0 if row["lane"] == "wnba" and any(
            name in lower for name in ("caitlin", "sophie", "indiana fever", "fever")
        ) else 1
        posted = parse_timestamp(row["posted_at"]) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)
        return (clark_lens, -posted.timestamp(), -int(row["views"] or 0))

    # The standing review batch mirrors the requested 10 NBA + 10 WNBA split.
    daily = (
        sorted([row for row in active if row["lane"] == "wnba" and (row["tweet_text"] or "").strip()], key=daily_sort)[:10]
        + sorted([row for row in active if row["lane"] == "nba" and (row["tweet_text"] or "").strip()], key=daily_sort)[:10]
    )
    daily_path.write_text(json.dumps(daily, indent=2, ensure_ascii=False) + "\n")
    return active_path, held_path, daily_path
