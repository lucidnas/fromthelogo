# FTL hourly news check

`tools/ftl_hourly_news_check.py` is the lightweight discovery layer for From The
Logo. It runs hourly from the user's crontab and does not render or publish.

Each run:

1. Attaches to the already-running Tales Chrome session on port `9337`, when
   available, for a shallow X-account and bookmark scan. It does not launch a
   new Chrome window when that warm session is absent.
2. Runs the live FTL web-news scanner and ranks six current Caitlin Clark,
   Indiana Fever, Sophie Cunningham, and WNBA stories.
3. Deduplicates source URLs for fourteen days and stores a compact run report.
4. Sends one normal-priority ntfy alert when a newly ranked top lead appears.
5. Sends a high-priority blocker alert only after three consecutive failed runs.

State and reports live under:

```text
/Volumes/SSK SSD/fromthelogo-cache/hourly-news-check/
  latest.json
  state.json
  runs/<timestamp>/
```

Validate prerequisites:

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/ftl_hourly_news_check.py --check
```

Run immediately:

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/ftl_hourly_news_check.py
```

The installed cron block is marked `FTL HOURLY NEWS CHECK`. Remove that marked
block with `crontab -e` to disable it.

## Hourly review processor

`tools/ftl_x_queue_agent.py` is the separate production worker. After each
hourly discovery transaction, the research monitor launches this worker in a
detached process. It atomically claims at most one `new` candidate from
`candidates.sqlite3`.

The worker may:

1. Download and verify one public source.
2. Reject duplicates using status ID, canonical URL, media fingerprint, and
   source/final SHA-256 hashes.
3. Decide `split_short` versus `caption_story` from the actual media.
4. Author the final MP4 in HyperFrames.
5. Run an independent Codex QC review.
6. Host the result privately on Tailscale.
7. Mark the candidate `review_ready` and send an ntfy alert whose tap action
   opens the private review.

The worker must not call YouTube Studio, TikTok Studio, an uploader script, or
any publish/schedule control. Publishing remains a separate user-approved
action.

The worker's `queue-agent.lock` prevents overlapping renders. If a previous
hour's render is still active, the newly triggered worker exits without
claiming another candidate. Logs are written to:

```text
~/Library/Logs/FromTheLogo/hourly-review-processor.log
```
