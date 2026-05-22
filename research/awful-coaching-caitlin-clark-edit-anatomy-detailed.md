# Awful Coaching Caitlin Clark Edit Anatomy - Detailed Gemini 2.5 Flash Pass

Source: `CAITLIN CLARK is literally too good for the WNBA` by Awful Coaching.

This report is built from six section-level Gemini 2.5 Flash passes over the downloaded video. The section prompts required visible-only observations and dense timestamp rows.

## Core Pattern

Awful Coaching edits one possession at a time: live setup, freeze or hold, visual circle/arrow on the defender or lane, VO explanation of the mistake, live/replay payoff, immediate next possession. The video does not rely on story chapters; retention comes from constantly directing the viewer's eye to the next mistake Caitlin Clark punishes.

## Section Summaries

### segment-00 (0s)

The segment uses a pattern of live basketball play, followed by freeze frames with circles and arrows to highlight specific player movements and defensive errors, all while a voiceover explains Caitlin Clark's skill and the opposing team's mistakes, concluding with the successful play.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 0-4 | live broadcast | cut | none visible | hook | Start with live game footage, full court view. |
| 4-9 | freeze/hold | freeze | two blue circles highlighting defenders | explains mistake | Freeze frame, add two blue circles to highlight specific players. |
| 9-15 | live broadcast | cut | none visible | explains Clark read | Resume live play, full court view. |
| 15-17 | live broadcast | hold | none visible | payoff | Continue live play to show basket. |
| 17-19 | live broadcast | cut | none visible | transition | Cut to new live game footage, full court view. |
| 19-22 | freeze/hold | freeze | one blue circle highlighting Clark and defender | points at defender | Freeze frame, add one blue circle to highlight specific players. |
| 22-29 | live broadcast | cut | none visible | explains Clark read | Resume live play, full court view. |
| 29-31 | freeze/hold | freeze | one blue arrow showing Clark's path | explains Clark read | Freeze frame, add one blue arrow to show player movement. |
| 31-36 | live broadcast | cut | none visible | explains Clark read | Resume live play, full court view. |
| 36-40 | live broadcast | hold | none visible | payoff | Continue live play to show basket. |
| 40-45 | live broadcast | cut | none visible | transition | Cut to new live game footage, full court view. |
| 45-48 | freeze/hold | freeze | two blue circles highlighting defenders | explains mistake | Freeze frame, add two blue circles to highlight specific players. |
| 48-52 | live broadcast | cut | none visible | explains Clark read | Resume live play, full court view. |
| 52-55 | freeze/hold | freeze | one blue arrow showing Clark's path | explains Clark read | Freeze frame, add one blue arrow to show player movement. |
| 55-59 | live broadcast | cut | two blue circles highlighting defenders | explains mistake | Resume live play, add two blue circles to highlight specific players. |
| 59-103 | live broadcast | cut | none visible | payoff | Resume live play, full court view, to show basket. |
| 103-104 | live broadcast | hold | none visible | transition | Continue live play. |

Observed pattern: The repeatable edit pattern is: live game footage (often showing the start of a play or transition) -> freeze frame with blue circles/arrows highlighting specific players or movements (while voiceover explains the setup/mistake/read) -> resume live game footage (showing the conclusion of the highlighted action, often a score).

Automation notes:
- Implement freeze frames at key moments where a specific player's action or defensive error is being explained.
- Use blue circles to highlight individual players or small groups of players during freeze frames.
- Use blue arrows to indicate player movement or intended path during freeze frames.
- Ensure overlays (circles/arrows) appear precisely at the start of the freeze frame and disappear when live play resumes.
- Align voiceover explanations with the visual cues provided by freeze frames and overlays.

### segment-01 (60s)

The segment analyzes three basketball plays, each starting with a live broadcast, followed by freeze frames with overlays and slow-motion replays to detail Caitlin Clark's strategic movements and the defensive errors, concluding with the live shot.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 0-2.5 | live broadcast | cut | none visible | hook |  |
| 2.5-5.5 | freeze/hold | freeze | light blue circle around Caitlin Clark, light blue arrow showing her path | explains Clark read |  |
| 5.5-8.5 | replay | slowdown | none visible | explains mistake |  |
| 8.5-12 | freeze/hold | freeze | light blue circle around two defenders, light blue arrow showing ball movement | explains mistake |  |
| 12-14 | replay | slowdown | none visible | explains Clark read |  |
| 14-16.5 | freeze/hold | freeze | two light blue circles around two defenders | explains mistake |  |
| 16.5-19.5 | replay | slowdown | none visible | explains Clark read |  |
| 19.5-22.5 | live broadcast | none visible | none visible | payoff |  |
| 22.5-23.5 | live broadcast | cut | none visible | hook |  |
| 23.5-26.5 | freeze/hold | freeze | light blue circle around Caitlin Clark and defender, light blue arrow showing her path | explains Clark read |  |
| 26.5-29.5 | replay | slowdown | none visible | explains Clark read |  |
| 29.5-32.5 | freeze/hold | freeze | light blue circle around Caitlin Clark and defender, light blue arrow showing fake movement | explains Clark read |  |
| 32.5-36.5 | replay | slowdown | none visible | explains mistake |  |
| 36.5-40.5 | freeze/hold | freeze | light blue circle around Caitlin Clark and defender, light blue arrow showing fake movement | explains Clark read |  |
| 40.5-43.5 | replay | slowdown | none visible | explains Clark read |  |
| 43.5-46.5 | freeze/hold | freeze | light blue circle around Caitlin Clark and defender, light blue arrow showing movement | payoff |  |
| 46.5-48.5 | live broadcast | none visible | none visible | payoff |  |
| 48.5-51.5 | live broadcast | cut | none visible | hook |  |
| 51.5-54 | freeze/hold | freeze | light blue circle around Caitlin Clark | explains Clark read |  |
| 54-59 | replay | slowdown | none visible | explains Clark read |  |

Observed pattern: The editing follows a consistent pattern for each play: 1. A brief live broadcast introduces the play or transitions between plays. 2. A freeze frame with light blue circles and arrows highlights specific players or movements being discussed by the voiceover. 3. A slow-motion replay shows the highlighted action unfolding. This freeze-and-slow-motion sequence may repeat to detail different aspects of the same play. 4. The segment concludes with a live broadcast of the final action (usually the shot) as the 'payoff'.

Automation notes:
- Overlays (circles, arrows) are exclusively used during freeze frames and are consistently light blue.
- The camera perspective remains full court with the scoreboard visible throughout the segment.
- The 'editMove' is 'cut' for initial play introductions, 'freeze' for detailed analysis with overlays, and 'slowdown' for showing action in detail.
- Voiceover functions 'hook' and 'payoff' typically align with live broadcast segments, while 'explains Clark read' and 'explains mistake' align with freeze frames and slow-motion replays.

### segment-02 (120s)

This segment repeatedly freezes the video to highlight player movements and defensive errors with visual overlays, followed by playing the action live to demonstrate the play's outcome.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 0-10 | freeze/hold | freeze | blue arrows showing player movement, blue circle around a player | explains Clark read | freeze frame, add arrows for player movement, circle a specific player |
| 10-17 | live broadcast | cut | none visible | payoff | play live |
| 17-28 | freeze/hold | freeze | blue circle around a player | explains mistake | freeze frame, add circle around a specific player |
| 28-35 | freeze/hold | freeze | blue circle around a player | explains Clark read | freeze frame, add circle around a specific player |
| 35-41 | live broadcast | cut | none visible | payoff | play live |
| 41-48 | freeze/hold | freeze | blue circle around players | explains mistake | freeze frame, add circle around specific players |
| 48-55 | freeze/hold | freeze | blue arrow showing player movement, blue circle around a player | explains Clark read | freeze frame, add arrow for player movement, circle a specific player |
| 55-59 | live broadcast | cut | none visible | payoff | play live |

Observed pattern: The repeatable edit pattern involves a freeze frame with visual overlays (circles/arrows) to explain a strategic point or mistake, followed by a cut to live broadcast to show the immediate consequence or payoff of that action.

Automation notes:
- Identify voiceover cues (e.g., 'lock her eyes', 'backpedaling', 'leaning towards the screen', 'head up the floor') to trigger freeze frames.
- Automatically add circles around players or areas of focus mentioned in the voiceover.
- Automatically add arrows to illustrate player movement or intended paths as described by the voiceover.
- Ensure a smooth cut from the freeze frame back to the live broadcast to show the play's resolution.

### segment-03 (180s)

The segment features a commentator analyzing multiple basketball plays from a full-court perspective, using graphic overlays like arrows and circles to highlight player movements and defensive strategies.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 180-182 | live broadcast | hold | blue arrow pointing from player to lane | explains play | Show full court game footage with scoreboard and commentator PiP. Add blue arrow overlay indicating player drive. |
| 182-186 | live broadcast | hold | none visible | explains play | Continue full court game footage. Remove arrow overlay. |
| 186-187 | live broadcast | hold | none visible | payoff | Continue full court game footage, showing shot completion. |
| 187-189 | live broadcast | hold | none visible | hook | Cut to next full court game footage. No overlays. |
| 189-193 | live broadcast | hold | none visible | explains mistake | Continue full court game footage. No overlays. |
| 193-199 | live broadcast | hold | none visible | explains mistake | Continue full court game footage. No overlays. |
| 199-204 | live broadcast | hold | blue arrow pointing from player to screen | explains mistake | Continue full court game footage. Add blue arrow overlay showing player movement around screen. |
| 204-208 | live broadcast | hold | none visible | payoff | Continue full court game footage, showing shot completion. Remove arrow overlay. |
| 208-210 | live broadcast | hold | none visible | hook | Cut to next full court game footage. No overlays. |
| 210-215 | live broadcast | hold | blue arrow pointing from player to basket | explains Clark read | Continue full court game footage. Add blue arrow overlay showing player movement. |
| 215-220 | live broadcast | hold | blue circle around two defenders | points at defender | Continue full court game footage. Remove arrow. Add blue circle overlay around defenders. |
| 220-225 | live broadcast | hold | none visible | explains Clark read | Continue full court game footage. Remove circle overlay. |
| 225-230 | live broadcast | hold | none visible | explains Clark read | Continue full court game footage. No overlays. |
| 230-235 | live broadcast | hold | blue arrow pointing from player to basket | payoff | Continue full court game footage. Add blue arrow overlay showing pass trajectory. Show layup completion. |
| 235-238 | live broadcast | hold | blue circle around two defenders | hook | Cut to next full court game footage. Add blue circle overlay around defenders. |

Observed pattern: The pattern involves showing a basketball play, often with a commentator's voiceover explaining the action, followed by the introduction of graphic overlays (arrows or circles) to emphasize specific player movements or defensive positions, and then the removal of these overlays as the play concludes or the focus shifts.

Automation notes:
- Maintain full court view with scoreboard and commentator picture-in-picture throughout analysis segments.
- Synchronize graphic overlay appearance/disappearance with commentator's verbal cues.
- Use blue arrows to indicate player movement paths or passing lanes.
- Use blue circles to highlight specific players or defensive groupings.
- Ensure overlays are transient, appearing only when relevant to the current voiceover explanation.

### segment-04 (240s)

The segment analyzes two basketball plays, using a combination of freeze frames with circles and arrows, and slow-motion replays with arrows, to highlight player movements, defensive errors, and offensive reads, followed by live broadcast commentary.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 240-243 | freeze/hold | freeze | blue circle around Aaliyah Boston and two defenders, blue arrow pointing from Boston to the top of the key | explains initial setup | Freeze on initial double team, add circle and arrow. |
| 243-244 | replay | slowdown | blue arrow showing pass from Boston to Clark | explains the pass out | Slow motion replay of the pass, add arrow. |
| 244-248 | replay | slowdown | blue arrow showing Boston's movement to repost, two blue arrows showing Mercury rotation | explains player movement and defensive adjustments | Slow motion replay of Boston's repost and Mercury's rotation, add arrows. |
| 248-253 | freeze/hold | freeze | blue circle around Aaliyah Boston and defender | explains Clark's read and Boston's position | Freeze on Boston's post seal, add circle. |
| 253-260 | freeze/hold | freeze | blue circle around Aaliyah Boston and defender, two blue circles around other Fever players, blue arrow showing pass from Clark to the corner | explains defensive confusion and new option | Freeze on defensive confusion, add circles and arrow for skip pass. |
| 260-266 | replay | slowdown | blue circle around Aaliyah Boston and defender, two blue circles around other Fever players | payoff | Slow motion replay of the shot, with circles persisting. |
| 266-275 | live broadcast | cut | none visible | commentary | Live broadcast of the shot and immediate aftermath. |
| 275-280 | live broadcast | cut | none visible | hook | Live broadcast, general commentary. |
| 280-284 | freeze/hold | freeze | blue circle around Clark and defender, blue arrow showing defender's movement | explains defender's initial move | Freeze on defender crowding, add circle and arrow. |
| 284-290 | freeze/hold | freeze | blue arrow showing defender stepping back, blue arrow showing Clark's drive | explains defender's mistake and Clark's read | Freeze on defender stepping back and Clark's drive, add arrows. |
| 290-294 | replay | slowdown | blue arrow showing defender playing off back foot, blue arrow showing Clark's drive | explains Clark's move | Slow motion replay of blow-by, add arrows. |
| 294-302 | replay | slowdown | none visible | payoff | Slow motion replay of the shot. |

Observed pattern: The editing pattern generally follows: (Live broadcast hook) -> Freeze frame with circles/arrows for setup/mistake -> Slow motion replay with arrows for action -> (Optional: another freeze frame with circles/arrows for further analysis) -> Slow motion replay of the payoff shot -> (Live broadcast commentary).

Automation notes:
- Overlays (circles, arrows) are often introduced during freeze frames and sometimes persist into slow-motion replays.
- Voiceover function directly correlates with the visual state and overlays, guiding the viewer's attention.
- The primary edit moves are 'freeze' and 'slowdown' (replay), used to dissect specific moments.
- The 'cameraOrCrop' is consistently 'full court' for these examples, allowing for broad tactical analysis.

### segment-05 (300s)

The segment uses a combination of live broadcast, freeze frames, and animated arrows to dissect Caitlin Clark's high basketball IQ plays, focusing on her reads of defensive movements and subsequent offensive execution.

| Time | Visual State | Edit Move | Visible Overlays | VO Function | FTL Replication |
|---|---|---|---|---|---|
| 300-307 | live broadcast | hold | blue circle around Caitlin Clark | explains Clark read | Hold on live broadcast, full court, circle Caitlin Clark. |
| 307-312 | live broadcast | hold | blue circle around Caitlin Clark | explains Clark read | Hold on live broadcast, full court, circle Caitlin Clark. |
| 312-316 | live broadcast | hold | blue circle around Aliyah Boston | explains Clark read | Hold on live broadcast, full court, circle Aliyah Boston. |
| 316-321 | live broadcast | playback with arrows | blue arrow showing defender's lean, blue arrow showing Clark's path | explains Clark read | Play live broadcast, full court, add arrows for defender's lean and Clark's path. |
| 321-322 | live broadcast | playback | none visible | payoff | Play live broadcast, full court. |
| 322-327 | live broadcast | playback with arrow | blue arrow showing Clark's path | explains Clark read | Play live broadcast, full court, add arrow for Clark's path. |
| 327-332 | live broadcast | hold with arrow | blue arrow showing Clark's path | explains Clark read | Hold on live broadcast, full court, add arrow for Clark's path. |
| 332-337 | live broadcast | playback with arrow | blue arrow showing Clark's path | explains Clark read | Play live broadcast, full court, add arrow for Clark's path. |
| 337-342 | live broadcast | hold with arrows | blue arrow showing Clark's path, blue arrow showing defender's collapse | explains Clark read | Hold on live broadcast, full court, add arrows for Clark's path and defender's collapse. |
| 342-347 | live broadcast | playback | none visible | payoff | Play live broadcast, full court. |

Observed pattern: The editor introduces a play, then uses freeze frames or slow-motion with graphical overlays (circles, arrows) to highlight specific player actions or defensive reactions, followed by a short playback of the action to demonstrate the outcome, repeating this analysis for multiple key moments within a play or across different plays.

Automation notes:
- Identify key player actions (e.g., calling for screen, setting screen, driving) and defensive reactions (e.g., peeking, leaning, collapsing).
- Implement freeze frames or slow-motion at critical decision points or moments of defensive vulnerability.
- Utilize circles to highlight specific players and arrows to illustrate movement paths or defensive shifts.
- Ensure the scoreboard is consistently visible for game context.
- Synchronize voiceover explanations with the visual overlays and playback segments.

## FTL Implementation Rules

- Add `freezeAt`, `overlayTarget`, `overlayType`, `defensiveMistake`, `clarkRead`, and `payoff` fields to clip-led edit JSON.
- Do not make a game recap. Build a proof stack from possessions.
- Every play needs a visible teaching moment: defender late, helper pulled in, big caught between two choices, weak-side rotation moved, or passing lane opened.
- Use positive Clark language even on misses: the read, gravity, collapse, or advantage creation is the point.
- Use short visual loops: live setup, freeze, circle/arrow, payoff, next play.
