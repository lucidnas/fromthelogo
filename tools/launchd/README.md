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
