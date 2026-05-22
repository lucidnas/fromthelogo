# Caitlin Clark 1,000 Point Game Source Ledger

Slug: `caitlin-clark-1000-wnba-point-genius`  
Game: Indiana Fever vs Dallas Wings, May 9, 2026  
Primary asset folder: `/Volumes/SSK SSD/broll/aroll/caitlin-clark-1000-wnba-point-genius`

## Repeatable Collection Process

1. Start with official game/highlight sources.
   ```bash
   yt-dlp --flat-playlist --print "%(title)s | %(channel)s | %(duration_string)s | %(view_count)s | %(webpage_url)s" "ytsearch20:Indiana Fever Dallas Wings Caitlin Clark highlights May 9 2026"
   ```
2. Search X through indexed web results, article embeds, and exact post text.
   ```bash
   # Exact phrase search tends to work better than broad X search.
   # Then pass x.com, twitter.com, or pic.twitter.com URLs into yt-dlp.
   yt-dlp --skip-download --print "%(id)s | %(title)s | %(duration_string)s | %(webpage_url)s" "https://pic.twitter.com/SHORTCODE"
   ```
3. Download confirmed video posts.
   ```bash
   yt-dlp -f "best[ext=mp4]/best" --merge-output-format mp4 -o "x-account-play-id.%(ext)s" "https://twitter.com/ACCOUNT/status/STATUS/video/1"
   ```
4. If YouTube direct downloads 403, retry with Android client mode.
   ```bash
   yt-dlp --extractor-args "youtube:player_client=android" -f "best[ext=mp4]/best" --merge-output-format mp4 -o "youtube-source-name.%(ext)s" "YOUTUBE_URL"
   ```
5. Generate review contact sheets.
   ```bash
   base="/Volumes/SSK SSD/broll/aroll/caitlin-clark-1000-wnba-point-genius"
   mkdir -p "$base/source-contact-sheets"
   for f in "$base"/x-*.mp4 "$base"/youtube-*.mp4; do
     [ -f "$f" ] || continue
     name=$(basename "$f" .mp4)
     ffmpeg -y -hide_banner -loglevel error -i "$f" \
       -vf "fps=1/2,scale=320:-1,tile=5x3" -frames:v 1 \
       "$base/source-contact-sheets/$name.jpg"
   done
   ```

## Downloaded X / Twitter Videos

| Platform | Account | Source type | Source URL | Local file | Duration | Use |
|---|---|---|---|---|---:|---|
| X | Indiana Fever | Official team | https://twitter.com/IndianaFever/status/2053184395519922582/video/1 | `x-fever-1000-spin-2053184323533033474.mp4` | 11.4s | Primary alternate for 1,000-point spin bucket |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053183233882202286/video/1 | `x-clarkreport-1000-spin-2053183152097546244.mp4` | 10.2s | Alternate 1,000-point spin bucket |
| X | Indiana Fever | Official team | https://twitter.com/IndianaFever/status/2053160839935377598/video/1 | `x-fever-first-bucket-2053160448271290369.mp4` | 9.4s | First points / return beat |
| X | WNBA | Official league | https://twitter.com/WNBA/status/2053178181608186041/video/1 | `x-wnba-behind-back-myisha-2053177720880717825.mp4` | 9.0s | Primary behind-the-back pass to Myisha Hines-Allen |
| X | SportsCenter | Media | https://twitter.com/SportsCenter/status/2053179838907686917/video/1 | `x-sportscenter-behind-back-2053179838907686917.mp4` | 27.4s | Wider social proof / alternate behind-the-back version |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053177720880717825/video/1 | `x-clarkreport-behind-back-2053177609073094658.mp4` | 11.5s | Alternate behind-the-back pass |
| X | Nekias Duncan | Analyst | https://twitter.com/NekiasNBA/status/2053176634329669632/video/1 | `x-nekias-boston-pass-2053176634329669632.mp4` | 12.6s | Analyst-sourced Boston pass clip |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053170993783316976/video/1 | `x-clarkreport-boston-thread-2053170902276149251.mp4` | 9.9s | Caitlin threads pass to Aliyah Boston |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053166242148544759/video/1 | `x-clarkreport-boston-three-2053166162549030916.mp4` | 12.0s | Caitlin finds Boston for three |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053176672241750399/video/1 | `x-clarkreport-deep-three-paige-2053176584727597058.mp4` | 11.5s | Deep three over Paige Bueckers |
| X | Clark Report | Fan/clip account | https://twitter.com/CClarkReport/status/2053160338804138301/video/1 | `x-clarkreport-mha-transition-2053160230259683329.mp4` | 11.7s | First assist to Myisha Hines-Allen in transition |
| X | WNBA | Official league | https://twitter.com/WNBA/status/2053216090826616833/video/1 | `x-wnba-big3-recap-2053215671308238848.mp4` | 102.9s | Longer Fever big-three recap; cut selectively |
| X | WNBA | Official league | https://twitter.com/WNBA/status/2053106679626002799/video/1 | `x-wnba-clark-arrival-2053106619060207619.mp4` | 13.0s | Arrival/opening context |
| X | WNBA | Official league | https://twitter.com/WNBA/status/2053177528081072204/video/1 | `x-wnba-clark-two-triples-2053177376129880064.mp4` | 10.0s | Official two-triples-out-of-halftime beat |
| X | WNBA | Official league | https://twitter.com/WNBA/status/2053187996426314029/video/1 | `x-wnba-arike-trey-2053187593198542857.mp4` | 16.0s | Dallas answer / game pressure context |
| X | Dallas Wings | Official team | https://twitter.com/DallasWings/status/2053164475918770599/video/1 | `x-dallas-steal-clark-2053164353965191168.mp4` | 11.0s | Dallas pressure / Clark turnover context |
| X | Dallas Wings | Official team | https://twitter.com/DallasWings/status/2053166963392725187/video/1 | `x-dallas-azzi-first-points-2053166802457313284.mp4` | 10.0s | Game context, Azzi debut |
| X | Dallas Wings | Official team | https://twitter.com/DallasWings/status/2053180176704360808/video/1 | `x-dallas-paige-drive-2053179937096368131.mp4` | 10.0s | Game context, Dallas answer |
| X | Dallas Wings | Official team | https://twitter.com/DallasWings/status/2053167632371572780/video/1 | `x-dallas-arike-2053167348618559489.mp4` | 8.0s | Game context, Dallas scoring pressure |
| X | Dallas Wings | Official team | https://twitter.com/DallasWings/status/2053151885477966056/video/1 | `x-dallas-starting-lineup-2053151826418020357.mp4` | 10.0s | Pregame lineup context |
| X | Nekias Duncan | Analyst | https://twitter.com/NekiasNBA/status/2053185159961432120/video/1 | `x-nekias-boston-special-2053184912912736256.mp4` | 15.0s | Boston context; possible setup for Clark/Boston chemistry |
| X | Nekias Duncan | Analyst | https://twitter.com/NekiasNBA/status/2053163423744335929/video/1 | `x-nekias-boston-mitchell-2053163362884939776.mp4` | 10.0s | Boston-Mitchell context; not Clark-centered |
| X | Chloe Peterson | Reporter | https://twitter.com/chloepeterson67/status/2051682408517321008/video/1 | `x-chloe-clark-leg-compression-2051682348811378694.mp4` | 13.0s | Pregame quote/context; not game action |

Duplicate to ignore:

| Platform | Account | Source URL | Local file | Note |
|---|---|---|---|---|
| X | Indiana Fever | https://twitter.com/IndianaFever/status/2053184395519922582/video/1 | `x-fever-1000-spin-alt-2053184323533033474.mp4` | Same media as `x-fever-1000-spin-2053184323533033474.mp4` |

## Downloaded YouTube Videos

| Platform | Channel | Source type | Source URL | Local file | Duration | Use |
|---|---|---|---|---|---:|---|
| YouTube | WNBA | Official league | Existing WNBA full highlight source | `wnba-dallas-wings-vs-indiana-fever-full-highlights-20260509.mp4` | TBD | Primary game highlight source and cut source |
| YouTube | ESPN | Media | https://www.youtube.com/watch?v=c4wiLnPN3nQ | `youtube-espn-paige-vs-caitlin-20260509.mp4` | 3:29 | Alternate broadcast-style highlight package |
| YouTube | ESPN | Media | https://www.youtube.com/watch?v=4Yf9X2JSDYI | `youtube-espn-season-opener-thriller-paige-vs-caitlin-4Yf9X2JSDYI.mp4` | 5:51 | Downloaded 720p/60 source via Homebrew yt-dlp with Chrome cookies and downgraded TV client; alternate broadcast package |
| YouTube | WNBA on NBC | Media | https://www.youtube.com/watch?v=cODs_ERKHEo | `youtube-nbc-wings-fever-recap-20260509.mp4` | 2:09 | Short recap / context |
| YouTube | Indiana Fever | Official team | https://www.youtube.com/watch?v=Rdcl8kkj2bE | `youtube-fever-pregame-media-20260509.mp4` | 5:28 | Pregame quotes/context if needed |

## YouTube Links Logged But Not Downloaded

| Platform | Channel | URL | Note |
|---|---|---|---|
| YouTube | Indiana Fever | https://www.youtube.com/watch?v=ePuVRzhzThc | Listed as Fever preseason game highlight; likely not this May 9 game |
| YouTube | Mick Talks Hoops | https://www.youtube.com/watch?v=Oxp_p4WIrYs | Commentary/reference only |
| YouTube | WNBA RIVALS | https://www.youtube.com/watch?v=d5Ut3nt3siY | Unofficial extended possession compilation; verify before using |
| YouTube | Hát Thái Mường é | https://www.youtube.com/watch?v=f5ZyC8KIKvc | Unofficial full game upload; avoid as edit source unless needed for research |
| YouTube | Hát Thái Mường é | https://www.youtube.com/watch?v=wRcnrRZde7E | Unofficial full game highlights; avoid as edit source unless needed for research |

## Article / Embed Sources

| Source | URL | What it contributed |
|---|---|---|
| Yahoo Sports / Indianapolis Star | https://sports.yahoo.com/articles/caitlin-clark-stats-highlights-today-192219564.html | Embedded X roundup for Clark plays: 1,000-point spin, behind-the-back to MHA, deep three, Boston passes, first bucket, first assist |
| Yahoo Sports / Sporting News | https://sports.yahoo.com/articles/caitlin-clark-sets-2-time-185111772.html | Official Fever 1,000-point embed and framing around the record |
| Yahoo Sports | https://sports.yahoo.com/articles/caitlin-clark-stuns-wnba-fans-183822547.html | SportsCenter behind-the-back embed and possession description |
| Yahoo Sports | https://sports.yahoo.com/articles/wings-held-off-indiana-fever-192911829.html | Dallas game recap and Dallas-side X embeds |
| Yahoo Sports | https://sports.yahoo.com/wnba/article/caitlin-clark-is-back-and-despite-a-season-opening-loss-to-the-wings-the-fever-have-something-to-build-on-214419347.html | Cassandra Negley game column, Clark quote, WNBA two-triples embed |
| Yardbarker | https://www.yardbarker.com/r/20260509/0/as/43824760_13132 | Opening-weekend takeaways; Nekias and WNBA embeds |
| CBS Sports | https://new.cbssports.com/wnba/news/wnba-opening-weekend-where-to-watch-wings-fever-clark-fudd-bueckers-boston/ | Pregame setup and still/reference context |

## Useful Image / Still Candidates

These were logged as possible overlay/reference sources:

| Source | URL | Use |
|---|---|---|
| FeverStats | https://x.com/FeverStats/status/2053183147550884043 | Downloaded to `x-images/x-feverstats-fastest-pg-2053183147550884043.jpg`; fastest point guard to 1,000 graphic |
| FeverStats | https://x.com/FeverStats/status/2053183093318602922 | Downloaded to `x-images/x-feverstats-fastest-1000-250-250-2053183093318602922.jpg`; 1,000/250/250 graphic |
| Yahoo Sports / Indianapolis Star gallery | https://sports.yahoo.com/articles/caitlin-clark-stats-highlights-today-192219564.html | Warmup, arena, and player stills for context overlays |
| CBS Sports preview image | https://new.cbssports.com/wnba/news/wnba-opening-weekend-where-to-watch-wings-fever-clark-fudd-bueckers-boston/ | Preview/context still; rights need care |
| Dallas Wings starting lineup post | https://twitter.com/DallasWings/status/2053151885477966056/video/1 | Downloaded as video; useful only as quick context if needed |
| Real App Paige graphic | `https://pic.twitter.com/4W5CE86kKI` | Dallas/Paige stat context; not central to Clark edit |

## Contact Sheets

Generated to:

`/Volumes/SSK SSD/broll/aroll/caitlin-clark-1000-wnba-point-genius/source-contact-sheets`

Use these for quick human review before asking Gemini to validate each downloaded source.
