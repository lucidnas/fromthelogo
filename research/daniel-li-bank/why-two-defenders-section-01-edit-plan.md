# Section 01 edit plan

Target: 1:55-2:05. Calm continuous narration, no music, no broadcast audio.

## Mandatory treatment prompt

The renderer must follow these instructions literally. Source time is the clock inside the named source file. Output time is derived from the aligned Jack or Josh narration. Never infer a freeze or slow-motion interval from prose alone.

| ID | VO anchor | Source treatment | Exact source timing | Output treatment |
| --- | --- | --- | --- | --- |
| CT-RANGE-01 | “range changes the floor” | Establish the full possession at normal speed | `deep 28.200–30.900` | Play once at `1.0x` |
| CT-RANGE-02 | “the big defender…has to meet her” | Slow the pickup so the viewer can study how far the big is from the rim | `deep 30.900–31.550` | Play at `0.40x`; mute source audio |
| CT-RANGE-F1 | “much farther from the basket” | Hold the frame where the big has stepped up and Clark still owns the ball | `deep frame 31.550` | Freeze for `3.0s`; no arrows, circles, labels, zooms, or drawings |
| CT-RANGE-03 | “comfortable shot for her” | Resume from the exact frozen frame through the release and make | `deep 31.550–34.930` | Start at `0.55x` for `31.550–32.250`, then return to `1.0x` through the make |
| ATL-01 | “Watch this possession against Atlanta” | Establish the drag screen without interruption | `atl 14.400–18.650` | Play once at `1.0x` |
| ATL-F1 | “Atlanta’s big steps high” | Hold when Clark’s defender trails and the big commits above the screen | `atl frame 18.650` | Freeze for `3.0s`; clean frame only |
| ATL-02 | “Two defenders are attached to Clark” | Resume and slow the moment both defenders commit | `atl 18.650–20.250` | Play at `0.45x`; do not restart the possession |
| ATL-F2 | “Boston slips into the open lane” | Hold when Boston occupies the space behind both defenders | `atl frame 20.250` | Freeze for `3.5s`; clean frame only |
| ATL-03 | “Clark delivers the bounce pass” | Resume from the frozen frame through the complete finish | `atl 20.250–23.450` | Play at `0.70x` until ball release, then `1.0x` through the made layup |
| ATL-04 | “The final pass looks simple” | Use the official replay as new evidence, not a duplicated live loop | `atl 23.800–33.800` | Play replay once; slow `27.000–29.000` to `0.55x` around Clark’s read and pass |
| MIN-01 | “Minnesota tried…a different way” | Establish Clark turning the corner | `min 0.000–1.350` | Play once at `1.0x` |
| MIN-F1 | “load a second defender toward the nail” | Hold once the second defender is visibly loaded toward Clark | `min frame 1.350` | Freeze for `3.0s`; clean frame only |
| MIN-02 | “stop the drive before Clark can get downhill” | Resume as Clark keeps both defenders engaged | `min 1.350–2.050` | Play at `0.40x` |
| MIN-F2 | “Boston settles into the space directly behind them” | Hold when Boston is visible behind the loaded help | `min frame 2.050` | Freeze for `3.5s`; clean frame only |
| MIN-03 | “Clark threads the ball through the help” | Resume from the frozen frame through Boston’s finish | `min 2.050–7.950` | Play at `0.65x` through pass release, then `1.0x` through the finish |
| CON-01 | “once the low defender rotates” | Establish the rejected spread pick-and-roll | `con 0.000–2.200` | Play once at `1.0x` |
| CON-F1 | “Clark is already reading the third defender” | Hold after the low defender commits but before the pass | `con frame 2.200` | Freeze for `3.0s`; clean frame only |
| CON-02 | “the problem gets even harder” | Resume through the reverse layup | `con 2.200–6.610` | Play at `0.60x` through pass release, then `1.0x` through the finish |

### QC acceptance rules

- Every freeze must be visibly static for at least `3.0s` in the encoded MP4.
- Every freeze must be preceded by moving footage from that same possession and resume from the identical source frame.
- Slow motion must be visibly slower than the surrounding footage and must not create a repeated possession.
- The encoded-video QC report must list each treatment ID with its actual output start/end time and mark it pass/fail.
- Reject the render if any treatment is missing, if a freeze advances frames, if slow motion plays at normal speed, or if a cut introduces black frames.
- This review pass uses no arrows, circles, labels, shaded lanes, or other drawings.

## Evidence sequence

1. Connecticut, 2026-07-22, Q1 action 55: official 29.99-foot made three. Use the clean official Indiana Fever recap as opening B-roll. The first narration establishes why Clark's range moves the screen defender.
2. Atlanta, 2025-05-20, Q4 action 579: Boston cutting layup, Clark assist. Official Fever source. Show the entire possession once with the explicit slow-motion and clean-freeze treatments above.
3. Minnesota, 2024-09-06, Q2 action 226: Boston cutting layup, Clark assist. Verified 60 fps event clip. Describe this as loaded nail/help coverage, not a high trap.
   - Freeze when Clark turns the corner and the second defender is loaded at the nail.
   - Freeze again when Boston occupies the space behind the help, then resume through the finish.

## Visual doctrine

- 16:9 footage fills the canvas; no vertical footage, split screens, cheap labels, or decorative cards.
- The play always moves before a freeze. Never open a possession on a still.
- This review pass has no telestration. Use clean freeze frames and slow motion only.
- No repeated full possession merely to fill narration. If a thought runs longer, use a different crop of the same verified evidence or adjacent official Clark B-roll.
- No generic stock footage and no unsupported tactical claim.
- End on a held wide frame that reveals the low defender, creating the handoff into Section 02.
