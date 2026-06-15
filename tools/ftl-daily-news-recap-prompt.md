You are the FTL daily news-recap automation. Today, fully autonomously, produce ONE finished
Caitlin Clark news-recap video from the strongest current Sports Illustrated article about Caitlin
Clark / the Indiana Fever, using the `ftl-news-recap` workflow and the repo tools in
/Users/abdul/code/fromthelogo. Do NOT ask questions — make sensible decisions and finish.

First read `research/news-title-hooks.md` (title doctrine) and `docs/formats/news-recap.md`.

Pipeline (use TODAY's date for the slug/date):

1. SCAN: `node tools/ftl-news-scan.mjs --date <YYYY-MM-DD> --limit 5 --outlets "Sports Illustrated (si.com),Yahoo Sports,Athlon Sports,Bleacher Report,ClutchPoints"`.
   Read the digest. Pick the #1 story — it MUST be a real, current Caitlin Clark / Fever beat that
   Sports Illustrated (or the others) actually covered. Lock a curiosity-gap title (the "video
   version of the article", never the celebration awe-word formula). Slug = `clark-<short>-<date>`.
   If there is NO real current Caitlin Clark SI/Fever story, write that to the status file and STOP.

2. SCRIPT: `node tools/ftl-script-pipeline.mjs --mode news --slug <slug> --title "<title>" --research <digest> --skip-roast --generate`.
   The Codex fact-check MUST end in `VERDICT: PASS`. If it FAILs, read the findings, correct the
   script (edit ~/transcripts/script-<slug>.txt) or the research, and re-`--validate` until PASS.
   Never proceed on a failing fact-check.

3. VO: `node tools/ftl-chatterbox-vo.mjs ~/transcripts/script-<slug>.txt "/Volumes/SSK SSD/ftl/videos/<slug>/vo.mp3"`,
   then `rm -f "/Volumes/SSK SSD/ftl/videos/<slug>/vo.json"`.

4. BEATS: `node tools/ftl-news-build-beats.mjs --slug <slug> --research <digest> --story-rank 1`.

5. RENDER (Modal, default): `node tools/ftl-render-news-recap.mjs --slug <slug> --quality high`.

6. QC: `node tools/ftl-news-recap-qc.mjs --video "/Volumes/SSK SSD/ftl/videos/<slug>/render/renders/final-v1-high.mp4" --title "<title>"`.
   If `VERDICT: FIX`, address the specific issue (regenerate the offending beat/receipt, fix a
   caption split with --caption-max-words, etc.) and re-render + re-QC. BUT if a flag is a Gemini
   OCR misread or a stale-knowledge "fact" correction (Gemini's training is older than the game),
   verify the actual frame / trust the Codex live-web fact-check and override. Cap at 3 fix rounds.

7. THUMBNAIL: composite a 1280x720 thumbnail like the existing videos — a hero beat image +
   ffmpeg `drawtext` curiosity text + "CAITLIN CLARK" kicker + @fromthelogo22; save to
   `/Volumes/SSK SSD/ftl/videos/<slug>/thumbnail.png`. Write the title to `.../title.txt`.

8. STATUS: write a short report to `/Volumes/SSK SSD/ftl/videos/<slug>/DAILY-STATUS.txt` — the date,
   title, final QC verdict, the source SI article URL, and the output paths.

Hard rules: every on-screen claim traces to a real source (Codex fact-check is the gate). Titles use
the curiosity-gap hooks, Caitlin Clark in the title, no awe/yellow word. VO = Chatterbox aym voice
(slowed + pauses); render + VO run on Modal. Keep going until the video is SHIP or you hit a hard
blocker, then summarize what happened in the status file.
