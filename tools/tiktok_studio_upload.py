#!/usr/bin/env python3
"""From The Logo TikTok Studio uploader powered by Playwright.

The uploader uses its own persistent Chrome profile on the SSD. Uploads are
draft-only by default. Publishing requires both ``--publish`` and ``--confirm``.

Run with:
  ~/.pyenv/versions/tiktok-browser-agents/bin/python tools/tiktok_studio_upload.py login
  ~/.pyenv/versions/tiktok-browser-agents/bin/python tools/tiktok_studio_upload.py status
  ~/.pyenv/versions/tiktok-browser-agents/bin/python tools/tiktok_studio_upload.py upload \
    --file /abs/short.mp4 --caption "Caption #sophiecunningham #wnba"
  ~/.pyenv/versions/tiktok-browser-agents/bin/python tools/tiktok_studio_upload.py upload \
    --file /abs/short.mp4 --caption "Caption #sophiecunningham #wnba" \
    --publish --confirm
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Iterable

from playwright.sync_api import Frame, Locator, Page, TimeoutError as PWTimeout, sync_playwright


PROFILE_DIR = Path("/Volumes/SSK SSD/fromthelogo-cache/tiktok-uploader-profile")
TRACE_ROOT = Path("/Volumes/SSK SSD/fromthelogo-cache/tiktok-uploader-traces")
UPLOAD_URL = "https://www.tiktok.com/tiktokstudio/upload?lang=en"
FALLBACK_UPLOAD_URL = "https://www.tiktok.com/upload?lang=en"
DEFAULT_CDP_URL = os.environ.get("TIKTOK_CDP_URL", "")


def now_slug() -> str:
    return dt.datetime.now().strftime("%Y%m%dT%H%M%S")


class Trace:
    def __init__(self, root: Path = TRACE_ROOT) -> None:
        self.path = root / now_slug()
        self.path.mkdir(parents=True, exist_ok=True)

    def save(self, page: Page, name: str) -> None:
        try:
            page.screenshot(path=str(self.path / f"{name}.png"), full_page=True)
        except Exception:
            pass
        try:
            (self.path / f"{name}.html").write_text(page.content(), encoding="utf-8")
        except Exception:
            pass
        try:
            text = page.locator("body").inner_text(timeout=5_000)
            (self.path / f"{name}.txt").write_text(text, encoding="utf-8")
        except Exception:
            pass


def launch_context(playwright, profile_dir: Path, headed: bool = True):
    profile_dir.mkdir(parents=True, exist_ok=True)
    return playwright.chromium.launch_persistent_context(
        str(profile_dir),
        channel="chrome",
        headless=not headed,
        accept_downloads=True,
        viewport={"width": 1440, "height": 1000},
        args=["--disable-blink-features=AutomationControlled"],
    )


class AttachedContext:
    """A shared Chrome context reached over CDP.

    Commands may close pages they create, but must never close the shared browser
    or context that owns the user's warm Tales session.
    """

    def __init__(self, browser, context) -> None:
        self.browser = browser
        self.context = context

    def close(self) -> None:
        pass


def browser_context(playwright, profile_dir: Path, headed: bool, cdp_url: str):
    if cdp_url:
        browser = playwright.chromium.connect_over_cdp(cdp_url, timeout=20_000)
        if not browser.contexts:
            browser.close()
            raise RuntimeError(f"No browser context available at {cdp_url}")
        attached = AttachedContext(browser, browser.contexts[0])
        return attached, attached.context, True
    context = launch_context(playwright, profile_dir, headed=headed)
    return context, context, False


def page_text(page: Page) -> str:
    try:
        return page.locator("body").inner_text(timeout=8_000)
    except Exception:
        return ""


def looks_logged_out(page: Page) -> bool:
    url = page.url.lower()
    text = page_text(page).lower()
    if "login" in url:
        return True
    has_upload_language = any(
        phrase in text
        for phrase in ("select file", "select video", "upload video", "drag and drop")
    )
    return ("log in" in text or "sign up" in text) and not has_upload_language


def open_upload(page: Page) -> None:
    page.goto(UPLOAD_URL, wait_until="domcontentloaded", timeout=90_000)
    page.wait_for_timeout(5_000)
    if looks_logged_out(page):
        return
    if not any(_count_file_inputs(frame) for frame in page.frames):
        page.goto(FALLBACK_UPLOAD_URL, wait_until="domcontentloaded", timeout=90_000)
        page.wait_for_timeout(5_000)


def _count_file_inputs(frame: Frame) -> int:
    try:
        return frame.locator('input[type="file"]').count()
    except Exception:
        return 0


def find_file_input(page: Page, timeout_seconds: int = 30) -> Locator:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        for frame in page.frames:
            try:
                locator = frame.locator('input[type="file"]')
                if locator.count():
                    return locator.first
            except Exception:
                continue
        page.wait_for_timeout(750)
    raise RuntimeError("TikTok upload file input did not appear")


def visible_locator(candidates: Iterable[Locator]) -> Locator | None:
    for locator in candidates:
        try:
            count = locator.count()
        except Exception:
            continue
        for index in range(count):
            item = locator.nth(index)
            try:
                if item.is_visible():
                    return item
            except Exception:
                continue
    return None


def fill_caption(page: Page, caption: str) -> None:
    candidates: list[Locator] = []
    for frame in page.frames:
        candidates.extend(
            [
                frame.locator('[contenteditable="true"][data-placeholder*="caption" i]'),
                frame.locator('[contenteditable="true"][aria-label*="caption" i]'),
                frame.locator('[contenteditable="true"][data-e2e*="caption" i]'),
                frame.locator('textarea[placeholder*="caption" i]'),
                frame.locator('textarea[aria-label*="caption" i]'),
            ]
        )
    target = visible_locator(candidates)
    if target is None:
        # TikTok frequently exposes the caption editor as the only textbox.
        fallback: list[Locator] = []
        for frame in page.frames:
            fallback.extend([frame.locator('[contenteditable="true"]'), frame.locator("textarea")])
        target = visible_locator(fallback)
    if target is None:
        raise RuntimeError("TikTok caption editor was not found")
    target.click()
    page.keyboard.press("Meta+A")
    page.keyboard.type(caption, delay=4)


def upload_is_ready(page: Page) -> bool:
    text = page_text(page).lower()
    if any(token in text for token in ("uploading", "processing video", "processing…")):
        return False
    return any(
        token in text
        for token in (
            "post now",
            "save draft",
            "save as draft",
            "copyright check",
            "video preview",
            "schedule",
        )
    )


def wait_for_upload(page: Page, trace: Trace, timeout_seconds: int = 20 * 60) -> None:
    deadline = time.time() + timeout_seconds
    last_line = ""
    while time.time() < deadline:
        text = page_text(page)
        progress = re.search(r"(?:uploading|processing)[^\n]{0,80}", text, re.I)
        line = progress.group(0).strip() if progress else "ready-state check"
        if line != last_line:
            print(f"  {line}")
            last_line = line
        if upload_is_ready(page):
            trace.save(page, "03-upload-ready")
            return
        page.wait_for_timeout(2_000)
    trace.save(page, "upload-timeout")
    raise RuntimeError("Timed out waiting for TikTok to finish processing the upload")


def action_control(page: Page, publish: bool) -> Locator | None:
    candidates: list[Locator] = []
    patterns = (
        (re.compile(r"^(post|post now|publish)$", re.I), ["post", "publish"])
        if publish
        else (re.compile(r"save(?: as)? draft|^draft$", re.I), ["draft"])
    )
    role_pattern, test_ids = patterns
    for frame in page.frames:
        candidates.append(frame.get_by_role("button", name=role_pattern))
        for test_id in test_ids:
            candidates.extend(
                [
                    frame.locator(f'[data-e2e*="{test_id}" i]'),
                    frame.locator(f'button:has-text("{test_id}")'),
                ]
            )
    return visible_locator(candidates)


def complete_upload(page: Page, publish: bool, confirm: bool, trace: Trace) -> str:
    if publish and not confirm:
        trace.save(page, "04-publish-ready-dry-run")
        return "publish-ready (dry-run; pass --confirm to post)"
    control = action_control(page, publish=publish)
    if control is None:
        requested = "Post" if publish else "Save draft"
        trace.save(page, "action-control-missing")
        raise RuntimeError(f"TikTok {requested} control was not found")
    control.click()
    page.wait_for_timeout(8_000)
    trace.save(page, "05-published" if publish else "05-draft-saved")
    return "published" if publish else "draft saved"


def login(profile_dir: Path) -> None:
    with sync_playwright() as playwright:
        context = launch_context(playwright, profile_dir, headed=True)
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://www.tiktok.com/login", wait_until="domcontentloaded", timeout=90_000)
        print("Sign in to the From The Logo TikTok account in the opened Chrome window.")
        print("Waiting up to 10 minutes for TikTok Studio upload access...")
        deadline = time.time() + 10 * 60
        try:
            while time.time() < deadline:
                if not looks_logged_out(page):
                    open_upload(page)
                    if not looks_logged_out(page):
                        print(f"LOGIN READY: {page.url}")
                        return
                page.wait_for_timeout(3_000)
            raise RuntimeError("TikTok login was not completed within 10 minutes")
        finally:
            context.close()


def status(profile_dir: Path, cdp_url: str = "") -> None:
    trace = Trace()
    with sync_playwright() as playwright:
        owner, context, attached = browser_context(
            playwright, profile_dir, headed=True, cdp_url=cdp_url
        )
        page = context.new_page() if attached else (context.pages[0] if context.pages else context.new_page())
        try:
            open_upload(page)
            trace.save(page, "status")
            state = "LOGIN REQUIRED" if looks_logged_out(page) else "READY"
            print(f"TIKTOK {state}: {page.url}")
            print(f"trace={trace.path}")
        finally:
            if attached:
                page.close()
            owner.close()


def upload(
    file_path: Path,
    caption: str,
    profile_dir: Path,
    publish: bool,
    confirm: bool,
    dry_run: bool,
    keep_open: bool,
    cdp_url: str = "",
) -> None:
    if not file_path.is_file():
        raise FileNotFoundError(f"Video not found: {file_path}")
    if dry_run:
        print(
            json.dumps(
                {
                    "file": str(file_path),
                    "bytes": file_path.stat().st_size,
                    "caption": caption,
                    "mode": "publish" if publish else "draft",
                    "confirmed": confirm,
                    "profile": str(profile_dir),
                },
                indent=2,
            )
        )
        return

    trace = Trace()
    with sync_playwright() as playwright:
        owner, context, attached = browser_context(
            playwright, profile_dir, headed=True, cdp_url=cdp_url
        )
        page = context.new_page() if attached else (context.pages[0] if context.pages else context.new_page())
        try:
            open_upload(page)
            trace.save(page, "01-upload-opened")
            if looks_logged_out(page):
                raise RuntimeError("TikTok login is required; run the login command first")
            file_input = find_file_input(page)
            file_input.set_input_files(str(file_path))
            page.wait_for_timeout(5_000)
            trace.save(page, "02-file-selected")
            fill_caption(page, caption)
            wait_for_upload(page, trace)
            result = complete_upload(page, publish=publish, confirm=confirm, trace=trace)
            print(f"TIKTOK {result.upper()}: {file_path.name}")
            print(f"trace={trace.path}")
            if keep_open:
                print("Browser left open for review. Press Ctrl-C to close it.")
                while True:
                    time.sleep(60)
        finally:
            if not keep_open:
                if attached:
                    page.close()
                owner.close()


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="From The Logo TikTok Studio uploader")
    ap.add_argument("--profile-dir", type=Path, default=PROFILE_DIR)
    ap.add_argument(
        "--cdp-url",
        default=DEFAULT_CDP_URL,
        help="attach to an existing Playwright/Chrome CDP session instead of launching a profile",
    )
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("login", help="open the persistent profile for one-time TikTok login")
    sub.add_parser("status", help="check whether the persistent TikTok profile is ready")
    up = sub.add_parser("upload", help="upload a Short as a draft or confirmed public post")
    up.add_argument("--file", type=Path, required=True)
    up.add_argument("--caption", required=True)
    up.add_argument("--publish", action="store_true", help="prepare a public post instead of a draft")
    up.add_argument("--confirm", action="store_true", help="perform the final Post click")
    up.add_argument("--dry-run", action="store_true")
    up.add_argument("--keep-open", action="store_true")
    return ap


def main() -> None:
    args = parser().parse_args()
    if getattr(args, "confirm", False) and not getattr(args, "publish", False):
        raise SystemExit("--confirm is only valid together with --publish")
    if args.command == "login":
        login(args.profile_dir)
    elif args.command == "status":
        status(args.profile_dir, cdp_url=args.cdp_url)
    elif args.command == "upload":
        upload(
            file_path=args.file.expanduser().resolve(),
            caption=args.caption,
            profile_dir=args.profile_dir,
            publish=args.publish,
            confirm=args.confirm,
            dry_run=args.dry_run,
            keep_open=args.keep_open,
            cdp_url=args.cdp_url,
        )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, FileNotFoundError, PWTimeout) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
