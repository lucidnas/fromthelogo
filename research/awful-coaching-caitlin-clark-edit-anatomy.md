This analysis provides a blueprint for the "Awful Coaching" style, which relies on **high-frequency visual cues** and **authoritative, play-by-play breakdown** to maintain high retention.

# Awful Coaching Edit Anatomy

## One-Sentence Formula
A high-tempo, instructional breakdown that uses telestration and freeze-frames to isolate specific defensive errors, framing the star player as a tactical genius.

## Global Editing Rules
*   **Pacing:** Clips are short (3–8 seconds). The video never stays on a single angle for more than 10 seconds without a visual intervention (zoom, freeze, or telestration).
*   **Visual Rhythm:** Every play follows a "Setup -> Action -> Payoff" loop.
*   **VO Density:** The VO is constant, acting as a "coach" guiding the viewer's eyes.
*   **Visual Intervention:** Use circles to highlight the "victim" of the play and arrows to show the "path" of the player.
*   **Scoreboard:** Always keep the scoreboard visible to provide context (time/score).

## Timeline Anatomy

| Time | Visual State | VO Function | Edit Move | Why It Retains |
| :--- | :--- | :--- | :--- | :--- |
| 0:00 | Full Court | Hook/Intro | Zoom In | Establishes the "Why" |
| 0:05 | Freeze Frame | Pointing out error | Circle defender | Creates "Aha!" moment |
| 0:10 | Live Play | Showing result | Cut to replay | Rewards the viewer |
| 0:15 | Slow Motion | Explaining mechanics | Arrow path | Educational value |

## Beat Pattern
1.  **The Hook:** State the premise (e.g., "Caitlin Clark is too good").
2.  **The Setup:** Show the play from the start.
3.  **The Freeze:** Pause at the exact moment the defender makes a mistake.
4.  **The Telestration:** Circle the defender or draw the path of the star player.
5.  **The Payoff:** Show the result (the bucket/assist) in slow motion.
6.  **The Transition:** Immediate cut to the next play setup.

## Visual Language
*   **Telestration:** Use high-contrast colors (Cyan/Yellow) for circles and arrows.
*   **Freeze Frames:** Used to "stop time" so the viewer can process the defensive breakdown.
*   **Zoom/Crop:** Used to focus on the interaction between the ball handler and the primary defender.
*   **Replays:** Always show the play at full speed first, then replay the critical moment in slow motion.

## VO-To-Visual Mapping
*   **"Look at this right here":** Triggers a freeze frame or zoom.
*   **"Look at how...":** Triggers a telestration arrow.
*   **"So now...":** Triggers a cut to the next phase of the play.
*   **"Again":** Signals a replay of the same action from a different angle.

## What To Copy For FTL
*   **The "Coach" Persona:** Speak as if you are teaching a film session.
*   **The "Mistake" Focus:** Don't just praise the star; highlight the specific defensive failure that allowed the play to happen.
*   **The "Slightly" Motif:** Use words like "ever so slightly" to emphasize that elite play is about small margins.

## What Not To Copy
*   **Repetitive Fillers:** Avoid excessive use of "I mean" or "just."
*   **Over-explaining:** If the visual is clear, don't over-narrate. Let the play breathe for 1 second before the payoff.

## Deterministic Template
For automation, structure your JSON metadata for each clip as follows:
```json
{
  "play_id": "unique_id",
  "start_time": "00:00",
  "end_time": "00:08",
  "freeze_frame_at": "00:03",
  "telestration_type": "circle",
  "telestration_target": "defender_1",
  "vo_script": "The defender is late to switch here."
}
```
