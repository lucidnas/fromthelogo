# VO Audio Cleanup Tools

FTL default VO voice: OpenAI `gpt-4o-mini-tts` with `cedar`.

OpenAI TTS should not need heavy denoise. The default cleanup should be light mastering: high-pass rumble removal, light hiss reduction, gentle compression, and loudness normalization.

## Default Local Step

Use:

```bash
node tools/process-vo-audio.mjs \
  --in "/Volumes/SSK SSD/ftl/videos/{slug}/vo.mp3" \
  --out "/Volumes/SSK SSD/ftl/videos/{slug}/vo-clean.mp3" \
  --preset tts-light
```

What it does:

- high-pass at 70 Hz
- low-pass at 14.5 kHz
- light FFmpeg `afftdn` noise reduction
- gentle compression
- loudness normalization to `-16 LUFS`

Use `normalize-only` if the Cedar file already sounds pristine.

Use `denoise-medium` only for noisy real recordings, not clean AI TTS.

## Local Tools To Test

1. **FFmpeg built-ins**
   - Already installed.
   - Available filters include `afftdn`, `anlmdn`, `arnndn`, `dialoguenhance`, `acompressor`, and `loudnorm`.
   - Best for deterministic pipeline work.

2. **DeepFilterNet**
   - Strong open-source speech enhancement.
   - Better for real noisy mic audio than clean TTS.
   - Worth testing if we process downloaded interviews, pressers, podcasts, or rough voice recordings.

3. **RNNoise / FFmpeg `arnndn`**
   - Good speech denoise if we have a compatible model file.
   - Useful for command-line automation, but needs model setup.

## Hosted Tools

1. **Auphonic**
   - Has API access.
   - Includes leveler, loudness normalization, filtering, noise/reverb reduction.
   - Free tier is 2 hours/month.
   - Best hosted candidate for deterministic automation.

2. **Adobe Podcast Enhance Speech**
   - Often sounds very polished, but can become robotic when pushed hard.
   - Better for manual rescue than deterministic daily pipeline unless API access is available and reliable.

## Current Recommendation

For Cedar VO:

1. Generate with OpenAI Cedar.
2. Run `process-vo-audio.mjs --preset tts-light`.
3. Listen against the raw Cedar file on the voice sampler page.
4. If `tts-light` dulls the voice, switch production default to `normalize-only`.

Do not add aggressive denoise to every AI voice by default.
