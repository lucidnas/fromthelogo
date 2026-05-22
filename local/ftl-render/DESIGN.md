# FTL Render — Visual Identity

## Style Prompt

From The Logo is a sports broadcast channel covering Caitlin Clark and the Indiana Fever. The visual identity mirrors the Indiana Fever's official color palette: deep navy background, gold/yellow as the primary accent, red as the urgency signal. The feel is premium sports broadcast — authoritative, urgent, championship-level. Stats feel like breaking news. Headlines feel like verdicts.

## Colors

| Role | Hex | Use |
|---|---|---|
| Background deep | `#010b1f` | Scene base — dark navy, near-black |
| Background mid | `#021530` | Cards, panels, secondary surfaces |
| Accent yellow | `#ffe000` | Primary accent — stats, bars, highlights (bright yellow, high-contrast pop) |
| Broadcast red | `#c8102e` | ESPN-style source labels, urgency signals (Fever red) |
| Fever navy | `#002d62` | Secondary surface, structural panels |
| Foreground | `#ffffff` | Headlines, large numbers |
| Muted foreground | `#9aadca` | Labels, sub-text |

## Typography

- **Stats / Numbers:** `system-ui, -apple-system, sans-serif` — 900 weight, very large (120–160px), tight letter-spacing
- **Labels / Badges:** Same stack — 700–800 weight, uppercase, tracked wide (`0.12em+`)
- **Headline body:** Same stack — 800 weight, 56–80px for main text, tighter line-height
- No decorative or serif fonts. This is broadcast, not editorial.

## Motion Character

- Entries: fast snaps (`expo.out`, `power4.out`) — broadcast graphics don't drift in
- Accent bars: `scaleX` from 0, `power3.out` — structural reveal
- Numbers: scale from 0.88 + opacity — gravity, not float
- Labels: delayed 0.15–0.2s after their parent stat
- 0.12–0.2s start offset — never fire at t=0

## What NOT to Do

- No purple or cyan — that's not FTL's palette
- No gradient text (`background-clip: text`) — looks cheap at 1920px
- No centered floating text with empty surround — always anchor to a zone
- No `position: absolute; top: NNNpx` on content containers — use flex + padding
- No soft/sine eases on entries — this is sports, not wellness
- No same ease on more than 2 consecutive tweens
