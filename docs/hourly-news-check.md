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
