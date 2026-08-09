"""Create a small visual-QC proxy on Modal for Gemini CLI inline video analysis."""
from pathlib import Path
import subprocess

import modal


app = modal.App("ftl-gemini-cli-qc-proxy")
vol = modal.Volume.from_name("video-render-io", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.11").apt_install("ffmpeg")


@app.function(image=image, cpu=4.0, memory=8192, timeout=1800, volumes={"/vol": vol})
def prepare(job_id: str) -> str:
    job = Path("/vol/hfjobs") / job_id
    source = job / "source.mp4"
    output = job / "qc-proxy.mp4"
    if not source.exists():
        raise FileNotFoundError(source)
    subprocess.run([
        "ffmpeg", "-y", "-i", str(source),
        "-vf", "scale=720:-2:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "31",
        "-r", "15", "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "48k",
        "-movflags", "+faststart", str(output),
    ], check=True)
    vol.commit()
    return str(output)


@app.local_entrypoint()
def main(job_id: str):
    print(prepare.remote(job_id))
