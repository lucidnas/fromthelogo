"""Render a full HyperFrames project to MP4 in the cloud on Modal (headless Chromium + ffmpeg).

Mirrors the proven modal-video-render `overlays_modal_app.py` image, but renders a COMPLETE
composition (not an alpha overlay). Used to offload FTL news-recap encoding off the laptop.

Volume layout (reuses the shared "video-render-io" volume):
  /vol/hfjobs/<job_id>/project.tar.gz   the HyperFrames project dir (index.html + hyperframes.json
                                        + assets/), tarred — NO node_modules (hyperframes is global).
  /vol/hfjobs/<job_id>/ep.mp4           output, written here.

Driver: `node tools/ftl-render-news-recap.mjs --slug <slug> --remote` (bundles + uploads + runs + fetches),
or directly: `modal run tools/modal/hyperframes_render_modal_app.py --job-id <id> --quality high`.
"""
import modal

app = modal.App("ftl-hyperframes-render")
vol = modal.Volume.from_name("video-render-io", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg", "chromium", "fonts-inter", "fontconfig", "curl", "ca-certificates",
        "libnss3", "libatk1.0-0", "libatk-bridge2.0-0", "libcups2", "libdrm2",
        "libxkbcommon0", "libxcomposite1", "libxdamage1", "libxrandr2", "libgbm1",
        "libasound2", "libpango-1.0-0", "libcairo2",
    )
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g hyperframes@latest",
    )
    .env({"PUPPETEER_EXECUTABLE_PATH": "/usr/bin/chromium",
          "PUPPETEER_SKIP_DOWNLOAD": "1",
          "HF_BROWSER_EXECUTABLE": "/usr/bin/chromium"})
)


@app.function(image=image, cpu=8.0, memory=16 * 1024, timeout=60 * 60,
              volumes={"/vol": vol})
def hyperframes_render(job_id: str, quality: str = "high") -> str:
    import subprocess, tarfile, tempfile, shutil
    from pathlib import Path

    job = Path("/vol/hfjobs") / job_id
    work = Path(tempfile.mkdtemp())
    proj = work / "proj"; proj.mkdir()
    with tarfile.open(job / "project.tar.gz") as t:
        t.extractall(proj)
    # The tar may hold the project at top level or nested — locate index.html.
    idx = next(proj.rglob("index.html"))
    pdir = idx.parent

    out = work / "ep.mp4"
    subprocess.run(
        ["hyperframes", "render", "--output", str(out), "--quality", quality, "--fps", "30"],
        cwd=str(pdir), check=True,
    )
    if not out.exists() or out.stat().st_size < 100_000:
        raise RuntimeError(f"hyperframes render produced no/empty output at {out}")
    shutil.copy(out, job / "ep.mp4")
    vol.commit()
    return str(job / "ep.mp4")


@app.local_entrypoint()
def main(job_id: str, quality: str = "high"):
    print(hyperframes_render.remote(job_id, quality))
