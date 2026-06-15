"""Chatterbox TTS on Modal for FTL voiceover (voice-cloned narration).

Self-contained copy of the AncientModernChannel Chatterbox app. Reuses the SAME model-cache volume
("chatterbox-tts-hf-cache") so the weights are not re-downloaded, and the same "huggingface-token"
secret. Voice cloning is driven by a reference clip passed per job (prompt_audio).

Manifest mode (one GPU session, many chunks — used by tools/ftl-chatterbox-vo.mjs):
  modal run tools/modal/chatterbox_modal_app.py --manifest <manifest.json>
where manifest.json is [{text, prompt_audio, exaggeration, cfg_weight, temperature, out}, ...].
"""
import json
import os
import tempfile
from pathlib import Path

import modal

app = modal.App("ftl-chatterbox-tts")

cache = modal.Volume.from_name("chatterbox-tts-hf-cache", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-token")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install("torch", "torchaudio", "chatterbox-tts")
)


@app.function(
    image=image,
    gpu="L40S",
    cpu=4,
    memory=24 * 1024,
    timeout=60 * 60,
    volumes={"/cache": cache},
    secrets=[hf_secret],
    min_containers=0,
    scaledown_window=5 * 60,
)
def synthesize(
    text: str,
    prompt_audio_bytes: bytes | None = None,
    exaggeration: float = 0.4,
    cfg_weight: float = 0.35,
    temperature: float = 0.7,
) -> bytes:
    os.environ.setdefault("HF_HOME", "/cache/huggingface")
    os.environ.setdefault("HF_HUB_CACHE", "/cache/huggingface/hub")
    os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "120")
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "120")
    if os.environ.get("HF_TOKEN") and not os.environ.get("HUGGING_FACE_HUB_TOKEN"):
        os.environ["HUGGING_FACE_HUB_TOKEN"] = os.environ["HF_TOKEN"]

    import torch
    import torchaudio as ta
    from chatterbox.tts import ChatterboxTTS

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available in the Modal container.")

    global _MODEL
    try:
        model = _MODEL
        print("Using cached Chatterbox model.", flush=True)
    except NameError:
        print("Loading Chatterbox model on CUDA...", flush=True)
        model = ChatterboxTTS.from_pretrained(device="cuda")
        _MODEL = model
        cache.commit()
        print("Chatterbox model loaded.", flush=True)

    prompt_path = None
    if prompt_audio_bytes:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            handle.write(prompt_audio_bytes)
            prompt_path = handle.name

    print(
        f"Generating: {len(text)} chars, exaggeration={exaggeration}, "
        f"cfg_weight={cfg_weight}, temperature={temperature}",
        flush=True,
    )
    wav = model.generate(
        text=text,
        audio_prompt_path=prompt_path,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
        temperature=temperature,
    )
    out_path = Path("/tmp/chatterbox-output.wav")
    ta.save(str(out_path), wav.cpu(), model.sr)
    return out_path.read_bytes()


@app.local_entrypoint()
def main(
    text: str = "This is the From The Logo Chatterbox voice test.",
    prompt_audio: str = "",
    exaggeration: float = 0.4,
    cfg_weight: float = 0.35,
    temperature: float = 0.7,
    out: str = "/tmp/ftl-chatterbox-sample.wav",
    manifest: str = "",
):
    if manifest:
        jobs = json.loads(Path(manifest).read_text())
        for job in jobs:
            jpa = job.get("prompt_audio", "")
            pab = Path(jpa).read_bytes() if jpa else None
            data = synthesize.remote(
                job["text"],
                prompt_audio_bytes=pab,
                exaggeration=float(job.get("exaggeration", exaggeration)),
                cfg_weight=float(job.get("cfg_weight", cfg_weight)),
                temperature=float(job.get("temperature", temperature)),
            )
            op = Path(job["out"])
            op.parent.mkdir(parents=True, exist_ok=True)
            op.write_bytes(data)
            print(op)
        return

    pab = Path(prompt_audio).read_bytes() if prompt_audio else None
    data = synthesize.remote(text, prompt_audio_bytes=pab,
                             exaggeration=exaggeration, cfg_weight=cfg_weight, temperature=temperature)
    op = Path(out)
    op.parent.mkdir(parents=True, exist_ok=True)
    op.write_bytes(data)
    print(op)
