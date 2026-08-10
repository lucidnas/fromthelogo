# Sections 8–9 source audit v1

## Outcome

Three exact official WNBA landscape alternatives are locked at 1920×1080. Each has a source-only live → freeze → slow resume → payoff package. No render, graphics, music, broadcast audio, arrows, or circles were added.

## Source decisions

- Minnesota Q1 5:13 and Q4 3:33 both come from the official WNBA full highlights: <https://www.youtube.com/watch?v=BDhTIFx4qk4>.
- Portland Q4 0:33.8 comes from the official WNBA full highlights: <https://www.youtube.com/watch?v=O67thOWwNtU>.
- The official Fever Portland recap did not contain the clinching Q4 possession. The URL-context receipt is at `/Volumes/SSK SSD/ftl/research/daniel-li-bank/sections-08-09/portland-official-landscape-locate.json`.

## Frame locks

- **Section 8A, hit-ahead:** freeze at local master `2.800`. The ball handler, runner, and nearest recovering defender remain visible. Narration should say “runner” or “teammate”; player identity comes from official metadata/PBP, not pixels.
- **Section 8B, backdoor/reverse:** freeze at local master `4.800`. Clark has the ball, help is compressed, and Mitchell’s route can be explained before the pass resumes.
- **Section 9, clincher:** freeze at local master `5.400`, with Clark on the right holding the ball and the cut/help geometry visible before release. The earlier `7.800` candidate was rejected because it was already at the finish.

## Exact production map

The machine-readable handoff is `/Users/abdul/code/fromthelogo/research/daniel-li-bank/sections-08-09-production-manifest-v1.json`.

| Play | Live | Freeze | Slow resume | Payoff |
|---|---:|---:|---:|---:|
| MIN Q1 5:13 | 1.000–2.800 | 2.800 | 2.800–5.600 at 0.60× | 5.600–7.300 |
| MIN Q4 3:33 | 0.600–4.800 | 4.800 | 4.800–5.800 at 0.55× | 5.800–9.400 |
| PDX Q4 0:33.8 | 1.000–5.400 | 5.400 | 5.400–7.400 at 0.55× | 7.400–12.000 |

All times in the table are relative to the corresponding local master cutdown, not the full YouTube upload.

## QC boundaries

- All source and motion-component MP4s are video-only (`-an`).
- Freeze duration stays editorial and must be timed to narration; it is intentionally not baked into the source package.
- Do not use the obsolete Section 9 files ending in `7.800` or `7.800-10.400`; the approved lock is `5.400`.
- Event and milestone claims must follow official play-by-play. Do not infer jersey identity, assist number, or milestone from pixels alone.
