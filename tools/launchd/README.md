# Scheduled FTL YouTube draft uploader (launchd)

Drains `/Volumes/SSK SSD/fromthelogo-cache/upload-queue/*.mp4` — uploads each as an
auto-metadata DRAFT to @fromthelogo22, then moves it to `uploaded/`. Runs HEADED in
your GUI session (so macOS Keychain works). Requires the Mac on + you logged in
(screen may be locked). Nothing publishes; everything lands as a Draft.

## Producer side
The render/production step just copies finished videos into the queue:
    cp /abs/final-short.mp4 "/Volumes/SSK SSD/fromthelogo-cache/upload-queue/"

## Enable the daily 09:00 schedule
    cp tools/launchd/com.ftl.yt-uploader.plist ~/Library/LaunchAgents/
    launchctl load  ~/Library/LaunchAgents/com.ftl.yt-uploader.plist   # arm
    launchctl start com.ftl.yt-uploader                                 # test run now

## Disable
    launchctl unload ~/Library/LaunchAgents/com.ftl.yt-uploader.plist

## Change cadence
Edit StartCalendarInterval in the plist (e.g. multiple <dict> entries for several
times a day), then unload + load again. Logs: upload-queue/drain.log + launchd.*.log

## Hourly draft scheduler (the daily backlog)
Library of approved videos: `/Volumes/SSK SSD/fromthelogo-cache/video-library/*.mp4` (FIFO by add-time).
`post-next` posts the OLDEST as a DRAFT + macOS notification, moves it to `posted/`. One per run.

Enable hourly (8am-10pm, 15 drafts/day):
    cp tools/launchd/com.ftl.yt-post-hourly.plist ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.ftl.yt-post-hourly.plist
    launchctl start com.ftl.yt-post-hourly   # test one now

If Google shows "Verify it's you", the job HOLDS the video (keeps it in the library) and notifies;
run `... verify-identity`, clear it, and next hour resumes. Logs: video-library/post.log + post.*.log

## Hourly X clip collector

`com.ftl.x-hourly-collector` opens or attaches to the existing Tales Chrome clone,
scans the configured NBA/WNBA X timelines plus Tales bookmarks, and queues native-video
posts suitable for split Shorts or HyperFrames caption stories. It runs every hour at
`:17` so it does not collide with the hourly YouTube uploader.

The collector does not render, upload, or publish. Its durable queue lives at:

```text
/Volumes/SSK SSD/fromthelogo-cache/x-hourly-collector/
  candidates.sqlite3       # canonical queue and review state
  candidates.jsonl         # append-only newly discovered candidates
  reports/YYYY-MM-DD-x-candidates.md
```

Launchd stdout/stderr live in `~/Library/Logs/FromTheLogo/x-hourly-collector.*.log`;
the candidate database and reports remain on the SSD.

Keep the single shared Tales browser session available on CDP `:9337` so the
hourly monitor can scan X without repeatedly opening and closing Chrome:

```bash
cp tools/launchd/com.ftl.tales-keep-open.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ftl.tales-keep-open.plist
```

Deduplication checks the X status ID, canonical URL, X media/poster fingerprint, and
same-account normalized post text. Reposts of already queued media are written to the
SQLite `duplicates` table and do not re-enter the candidate queue.

Freshness is enforced before a candidate can enter production: visual highlights are
eligible for 72 hours, news/commentary soundbites for 120 hours, and older material is
held unless an editor explicitly marks it evergreen. A conservative event key keeps at
most two candidates from the same identified event/angle. These controls are
non-destructive: held rows remain in SQLite as `held_stale`, `held_angle`,
`held_unverified_date`, or `held_evergreen_review`. A newly reposted clip that names a
historical year also requires an editor to set `is_evergreen=1` before production. The
current claimable and held inventories are exported after
every scan/worker pass to `active-backlog.json` and `held-backlog.json`.
`daily-production-backlog.json` is the current 20-item review batch, balanced as
10 WNBA and 10 NBA candidates when both lanes have sufficient inventory.

Install and test:

```bash
mkdir -p "/Volumes/SSK SSD/fromthelogo-cache/x-hourly-collector"
mkdir -p "$HOME/Library/Logs/FromTheLogo"
cp tools/launchd/com.ftl.x-hourly-collector.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ftl.x-hourly-collector.plist
launchctl kickstart -k gui/$(id -u)/com.ftl.x-hourly-collector
```

Run a non-persistent browser scan manually:

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/ftl_x_hourly_collector.py --rounds 1 --dry-run
```

Disable:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ftl.x-hourly-collector.plist
```

## X queue production agent

The hourly news monitor launches one batch worker after each discovery pass.
That worker atomically claims up to five new candidates, checks the
processed-source ledger, inspects the downloaded videos, authors and validates
the Shorts in one coordinated HyperFrames production session, and hosts each
passing result privately for review. It never uploads, publishes, or schedules.

The single batch lock prevents overlapping production sessions while SQLite
protects claims and deduplication. Within the WNBA lane, current
editorial ordering promotes Sophie Cunningham, Caitlin Clark, and Indiana Fever
clips before generic league material, then uses view count and freshness.
After three completed non-NBA drafts, the next ordinary claim prefers the NBA lane;
this maintains an approximately 3:1 WNBA-to-NBA mix. Explicitly prioritized breaking
stories remain ahead of the lane rotation.

The downloaded video decides the authoritative format; the collector label is only
a preliminary hint:

- `split_short`: an attributable person delivers a complete thought. Preserve the
  thought (normally 30–45 seconds), put the speaker on top, and use specifically
  relevant verified footage below.
- `caption_story`: the footage itself is the story (play, performance, record,
  arrival, celebration, comedy, celebrity interaction, reveal, or news event). Use
  timed FTL story-caption beats and keep the important action zoomed out and visible.
  If one complete visual payoff reads instantly, use the 6–15 second micro-Short
  treatment: 6–10 seconds for an instantaneous moment or 8–15 seconds for a complete
  setup-turn-payoff micro-story. Use one truthful persistent hook, no dead air, only
  the useful reaction, and a clean loop when possible. Never cut off the punch line
  or visible payoff to force the duration.
- Name recognizable subjects directly. Use `Sophie Cunningham`, never `Caitlin
  Clark's teammate`; do not force Caitlin into metadata when she is not materially
  part of the clip.
- Reject or hold anything unusable, misleading, duplicated, or missing necessary
  split-screen footage.

Queue state, attempts, result JSON, final paths, hashes, and the processed-source
ledger are stored in `candidates.sqlite3`. A six-hour stale claim is safely reset;
failed jobs retry at most three times.

Phone notifications use a local, untracked ntfy config at
`~/.config/fromthelogo/notifications.json`:

```json
{
  "ntfy_server": "https://ntfy.sh",
  "ntfy_topic": "your-private-topic"
}
```

Install and test without claiming work:

```bash
mkdir -p "$HOME/Library/Logs/FromTheLogo"
cp tools/launchd/com.ftl.x-queue-agent.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ftl.x-queue-agent.plist
~/.pyenv/versions/tiktok-browser-agents/bin/python tools/ftl_x_queue_agent.py --dry-run
```

Run one queued job immediately:

```bash
launchctl kickstart -k gui/$(id -u)/com.ftl.x-queue-agent
```

Disable:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ftl.x-queue-agent.plist
```
