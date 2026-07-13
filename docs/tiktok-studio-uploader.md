# From The Logo TikTok Studio uploader

`tools/tiktok_studio_upload.py` uploads finished Shorts through TikTok Studio with
Playwright and a dedicated persistent Chrome profile. It saves drafts by default.
Publishing requires both `--publish` and `--confirm`.

## One-time login

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/tiktok_studio_upload.py login
```

Sign in to the From The Logo TikTok account in the Chrome window. The session is
stored at `/Volumes/SSK SSD/fromthelogo-cache/tiktok-uploader-profile`.

Check the saved session later with:

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/tiktok_studio_upload.py status
```

## Upload a draft

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/tiktok_studio_upload.py upload \
  --file '/absolute/path/to/short.mp4' \
  --caption 'Sophie Cunningham tells the full story #sophiecunningham #wnba'
```

## Publish

Omitting `--confirm` uploads and prepares the post without clicking the final
Post control. Use both flags only after the caption and video are approved:

```bash
~/.pyenv/versions/tiktok-browser-agents/bin/python \
  tools/tiktok_studio_upload.py upload \
  --file '/absolute/path/to/short.mp4' \
  --caption 'Sophie Cunningham tells the full story #sophiecunningham #wnba' \
  --publish --confirm
```

Each browser run stores a screenshot, page HTML, and visible text under
`/Volumes/SSK SSD/fromthelogo-cache/tiktok-uploader-traces` for troubleshooting.
Use `--dry-run` to validate the file and arguments without opening TikTok.
