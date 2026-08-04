# Caitlin Clark Play Database

Canonical database: `/Volumes/SSK SSD/ftl-data/caitlin-clark-pbp.sqlite3`

## Doctrine

1. Official WNBA play-by-play establishes the event: game, period, clock, score, participants, result, and shot distance when supplied.
2. The surrounding possession video is located from the event record.
3. Gemini CLI watches the actual footage and explains only visible basketball details: coverage, spacing, leverage, reads, timing, reactions, and annotation targets.
4. A human-readable analytical claim is written only after the official record and visual report agree.
5. The essay script is written from those verified claims. The script never invents an off-ball action from play-by-play alone.

## Script target

- Format: calm Caitlin Clark film essay, not a highlight compilation.
- Runtime: 5–8 minutes while testing; default mature target is 8 minutes.
- Eight-minute narration target: 750–900 words, normally about 825.
- Possessions: 6–8, all supporting one thesis.
- Pacing: narration introduces the observation; silence permits inspection; narration explains or predicts; footage pays it off.
- Audio: narration and true silence. Source audio/music only when explicitly approved for that project.

## Commands

```bash
python3 tools/ftl-clark-pbp-db.py sync --seasons 2024,2025,2026
python3 tools/ftl-clark-pbp-db.py summary
python3 tools/ftl-clark-pbp-db.py query "SELECT game_id,period,clock,description,shot_distance FROM plays WHERE assist_person_id=1642286 ORDER BY game_id,action_number"
```

`visual_analysis` is intentionally separate from `plays`. It records Gemini-verified footage observations and annotation coordinates without contaminating the official event ledger.
