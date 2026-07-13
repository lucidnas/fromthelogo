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

Deduplication checks the X status ID, canonical URL, X media/poster fingerprint, and
same-account normalized post text. Reposts of already queued media are written to the
SQLite `duplicates` table and do not re-enter the candidate queue.

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
