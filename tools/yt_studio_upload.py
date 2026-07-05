#!/usr/bin/env python3
"""FTL YouTube Studio uploader (Playwright, browser automation — brand-account API is blocked).

Uploads a video to YouTube Studio and leaves it as a DRAFT (never publishes):
upload file -> fill title/description -> set "not made for kids" -> wait for
upload to complete -> close the dialog. A video with no visibility assigned
stays "Draft" in Studio's Content list.

Modes:
  login                      one-time headed login (sign into the FTL brand channel;
                             session persists in the profile dir)
  upload --file F --title T [--desc D] [--headed]
  verify --title T           check the Content list shows the video as Draft
  list                       print recent rows from the Content page

Session lives in PROFILE_DIR (persistent context). Media stays on the SSD.

Run with: ~/.pyenv/versions/tiktok-browser-agents/bin/python
"""
import argparse, json, os, subprocess, sys, time

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

PROFILE_DIR = "/Volumes/SSK SSD/fromthelogo-cache/yt-uploader-profile"
SHOTS_DIR = "/Volumes/SSK SSD/fromthelogo-cache/yt-uploader-shots"
STUDIO = "https://studio.youtube.com"
# From The Logo (@fromthelogo22) is a BRAND channel owned by the Tales account
# talesfromthenba@gmail.com. The clone profile also has nas2663@gmail.com and an
# "Abdul M" (AYM) account logged in — a bare studio.youtube.com/ can default to
# the wrong one (AYM has no channel -> "create channel" dialog). ALWAYS enter via
# the FTL channel URL WITH authuser=<Tales account> so the correct account is
# selected; the guard in upload() aborts if it still isn't FTL. NEVER AYM.
FTL_CHANNEL = "UCvWdLRqA7R2Gggisxn4Xkhg"
FTL_ACCOUNT = "talesfromthenba@gmail.com"
STUDIO_HOME = f"{STUDIO}/channel/{FTL_CHANNEL}?authuser={FTL_ACCOUNT}"
CHROME_PROFILE = "Profile 3"  # Tales — holds the FTL brand channel
YTDLP = "/opt/homebrew/bin/yt-dlp"


CLONE_DIR = "/Volumes/SSK SSD/fromthelogo-cache/yt-uploader-chrome-clone"
CHROME_SRC = os.path.expanduser("~/Library/Application Support/Google/Chrome")
STATE_FILE = "/Volumes/SSK SSD/fromthelogo-cache/yt-uploader-profile/auth.json"


def save_state():
    """One-time (per few months): open the cloned real-Chrome profile HEADED so
    the macOS Keychain decrypts the live Tales/FTL session, then dump it to a
    plaintext storage_state JSON. Headless runs reuse that JSON — no Keychain."""
    with sync_playwright() as p:
        c = _persistent(p, headed=True)
        page = c.pages[0] if c.pages else c.new_page()
        page.goto(STUDIO, wait_until="domcontentloaded")
        page.wait_for_timeout(7000)
        shot(page, "save-state")
        if "studio.youtube.com/channel" not in page.url:
            sys.exit(f"not logged in on the clone (url={page.url}) — run headed login first")
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        c.storage_state(path=STATE_FILE)
        print(f"saved session -> {STATE_FILE}")
        print("channel:", page.url)
        c.close()


CDP_URL = "http://127.0.0.1:9337"


def _persistent(p, headed=False, debug_port=None):
    """Persistent context on the cloned real-Chrome profile with the REAL
    Keychain. debug_port opens a CDP endpoint so other commands can ATTACH to
    this same window instead of launching their own (keeps the session warm,
    avoids re-triggering Google's 'Verify it's you')."""
    args = ["--disable-blink-features=AutomationControlled", "--profile-directory=Default"]
    if debug_port:
        args.append(f"--remote-debugging-port={debug_port}")
    return p.chromium.launch_persistent_context(
        CLONE_DIR, channel="chrome", headless=not headed,
        viewport={"width": 1440, "height": 900},
        ignore_default_args=["--use-mock-keychain", "--password-store=basic"],
        args=args,
    )


def keep_open():
    """Launch ONE long-lived browser window (clone profile, real Keychain) with a
    CDP endpoint on :9337, and HOLD it open. Leave this running in the background;
    every other command (upload/list/verify/publish/post-next) will attach to
    this window instead of opening a new one. Ctrl-C / kill to stop."""
    with sync_playwright() as p:
        c = _persistent(p, headed=True, debug_port=9337)
        page = c.pages[0] if c.pages else c.new_page()
        page.goto(STUDIO_HOME, wait_until="domcontentloaded")  # Tales account + FTL channel
        page.wait_for_timeout(5000)
        ok = FTL_CHANNEL in page.url and "How you'll appear" not in page.content()
        print(f"Browser open on :9337 ({'FTL/Tales ready' if ok else 'WRONG ACCOUNT url='+page.url}).")
        if not ok:
            print("!! Not on From The Logo/Tales — do NOT upload; check the account.")
        print("Leave this running — other commands attach here. Ctrl-C to stop.")
        try:
            while True:
                page.wait_for_timeout(600000)  # keepalive tick
        except KeyboardInterrupt:
            print("closing keep-open window")
        c.close()


def clone_profile(chrome_profile=CHROME_PROFILE):
    """Copy the real Chrome profile (Tales) into an isolated user-data-dir so
    Playwright can drive it with the REAL Chrome binary. Same machine + same
    binary + same Keychain -> Google's device-bound session stays valid.
    The source profile is copied as 'Default' in the clone."""
    os.makedirs(CLONE_DIR, exist_ok=True)
    src = os.path.join(CHROME_SRC, chrome_profile)
    assert os.path.isdir(src), f"no such chrome profile: {src}"
    # Local State holds the os_crypt key reference (Keychain) — required
    subprocess.run(["rsync", "-a", "--delete",
                    os.path.join(CHROME_SRC, "Local State"), CLONE_DIR + "/"], check=True)
    ex = ["--exclude=" + x for x in
          ["Cache*", "Code Cache", "GPUCache", "Service Worker/CacheStorage",
           "*.ldb.tmp", "GrShaderCache", "ShaderCache", "DawnGraphiteCache",
           "DawnWebGPUCache", "optimization_guide*", "Download Service",
           "Site Characteristics Database", "Safe Browsing*"]]
    subprocess.run(["rsync", "-a", "--delete"] + ex +
                   [src + "/", os.path.join(CLONE_DIR, "Default") + "/"], check=True)
    # Point Local State's profile cache at Default only (avoid picker)
    print(f"cloned {chrome_profile} -> {CLONE_DIR}/Default")


class _Ctx:
    """Wrap a launched browser+context so callers can use it like a context
    (pages, new_page, add_cookies, storage_state, close)."""
    def __init__(self, browser, context):
        self._b, self._c = browser, context
    def __getattr__(self, n):
        return getattr(self._c, n)
    def close(self):
        try: self._c.close()
        finally: self._b.close()


class _CdpCtx:
    """Attached to a running keep-open window over CDP. close() only cleans up
    the pages THIS command opened — it never closes the shared window."""
    def __init__(self, browser, context):
        self._b, self._c = browser, context; self._opened = []
    def new_page(self):
        pg = self._c.new_page(); self._opened.append(pg); return pg
    def __getattr__(self, n):
        return getattr(self._c, n)
    def close(self):
        for pg in self._opened:
            try: pg.close()
            except Exception: pass


def ctx(p, headed=False):
    """Attach to a running keep-open window (CDP :9337) if present — reuses the
    SAME warm session. Otherwise: saved storage_state, then the persistent clone."""
    os.makedirs(SHOTS_DIR, exist_ok=True)
    try:
        b = p.chromium.connect_over_cdp(CDP_URL, timeout=3000)
        if b.contexts:
            return _CdpCtx(b, b.contexts[0])
    except Exception:
        pass
    if os.path.isfile(STATE_FILE):
        b = p.chromium.launch(
            channel="chrome", headless=not headed,
            args=["--disable-blink-features=AutomationControlled"])
        c = b.new_context(storage_state=STATE_FILE,
                          viewport={"width": 1440, "height": 900})
        return _Ctx(b, c)
    if os.path.isdir(os.path.join(CLONE_DIR, "Default")):
        return _persistent(p, headed)
    os.makedirs(PROFILE_DIR, exist_ok=True)
    return p.chromium.launch_persistent_context(
        PROFILE_DIR, headless=not headed,
        viewport={"width": 1440, "height": 900},
        args=["--disable-blink-features=AutomationControlled"])


def shot(page, name):
    path = os.path.join(SHOTS_DIR, f"{int(time.time())}-{name}.png")
    try:
        page.screenshot(path=path)
        print(f"  [shot] {path}")
    except Exception:
        pass
    return path


def login(headed=True):
    with sync_playwright() as p:
        c = ctx(p, headed=True)
        page = c.pages[0] if c.pages else c.new_page()
        page.goto(STUDIO, wait_until="domcontentloaded")
        print("Sign in to the FTL brand channel in the opened window.")
        print("Waiting up to 5 minutes for Studio to reach the channel dashboard...")
        deadline = time.time() + 300
        ok = False
        while time.time() < deadline:
            if "studio.youtube.com/channel/" in page.url:
                ok = True
                break
            page.wait_for_timeout(3000)
        shot(page, "login-done")
        print("URL now:", page.url)
        print("LOGIN", "OK — session saved." if ok else "state unclear — check the screenshot.")
        c.close()


def import_cookies(chrome_profile=CHROME_PROFILE, channel_hint="logo"):
    """Extract the YouTube/Google session from the user's real Chrome profile
    (via yt-dlp's cookie extractor) and inject it into the Playwright profile.
    Then open Studio and, if needed, switch to the brand channel matching
    channel_hint. No manual login."""
    os.makedirs(PROFILE_DIR, exist_ok=True)
    jar = os.path.join(PROFILE_DIR, "chrome-export.txt")
    # yt-dlp writes the cookie jar even when extraction of the URL is skipped
    subprocess.run(
        [YTDLP, "--cookies-from-browser", f"chrome:{chrome_profile}",
         "--cookies", jar, "--skip-download", "--no-warnings",
         "https://www.youtube.com/"],
        capture_output=True, text=True)
    assert os.path.isfile(jar), "cookie export failed"
    cookies = []
    for line in open(jar):
        raw = line.strip()
        http_only = raw.startswith("#HttpOnly_")
        if http_only:
            raw = raw[len("#HttpOnly_"):]
        if not raw or raw.startswith("#"):
            continue
        f = raw.split("\t")
        if len(f) != 7:
            continue
        dom, _, path, secure, exp, name, val = f
        # only the domains Studio needs: YouTube itself + Google auth. Skip
        # cloud/gemini/etc subdomains (their analytics cookies carry WebKit-epoch
        # timestamps Playwright rejects).
        keep = dom in (".youtube.com", "youtube.com", ".google.com", "google.com",
                       "accounts.google.com", ".accounts.google.com",
                       "studio.youtube.com", ".studio.youtube.com")
        if not keep:
            continue
        try:
            e = float(exp)
        except ValueError:
            e = -1
        if e > 32503680000:  # sanity clamp (year 3000) — bogus epoch formats
            e = 32503680000
        c = {"name": name, "value": val, "domain": dom, "path": path,
             "secure": secure.upper() == "TRUE", "httpOnly": http_only,
             "expires": e if e > 0 else -1}
        cookies.append(c)
    print(f"extracted {len(cookies)} google/youtube cookies from chrome:{chrome_profile}")
    with sync_playwright() as p:
        c = ctx(p)
        c.add_cookies(cookies)
        page = c.pages[0] if c.pages else c.new_page()
        page.goto(STUDIO, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        shot(page, "cookies-imported")
        print("URL:", page.url)
        if "accounts.google.com" in page.url:
            sys.exit("session not accepted — cookies may be stale; close/reopen Chrome and retry")
        # switch to the FTL brand channel if not already active
        if not _on_channel(page, channel_hint):
            print("switching channel...")
            _switch_channel(page, channel_hint)
        shot(page, "channel-active")
        print("channel URL:", page.url)
        c.close()


def _on_channel(page, hint):
    try:
        page.locator("#avatar-btn").first.click(timeout=10000)
        page.wait_for_timeout(1500)
        txt = page.locator("ytd-active-account-header-renderer, #account-name, yt-formatted-string#account-name").first.inner_text(timeout=5000)
        page.keyboard.press("Escape")
        print("active account:", txt.strip())
        return hint.lower() in txt.lower()
    except Exception:
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        return False


def _switch_channel(page, hint):
    page.locator("#avatar-btn").first.click(timeout=10000)
    page.wait_for_timeout(1500)
    page.get_by_text("Switch account", exact=False).first.click(timeout=10000)
    page.wait_for_timeout(2500)
    shot(page, "account-list")
    item = page.locator(f"ytd-account-item-renderer:has-text('{hint}'), tp-yt-paper-item:has-text('{hint}')").first
    item.click(timeout=10000)
    page.wait_for_timeout(5000)


QUEUE_DIR = "/Volumes/SSK SSD/fromthelogo-cache/upload-queue"
QUEUE_DONE = "/Volumes/SSK SSD/fromthelogo-cache/upload-queue/uploaded"
QUEUE_LOG = "/Volumes/SSK SSD/fromthelogo-cache/upload-queue/drain.log"

# Daily backlog: approved videos in LIBRARY_DIR (FIFO by mtime). The hourly
# scheduler posts ONE per run as a DRAFT and moves it to posted/.
LIBRARY_DIR = "/Volumes/SSK SSD/fromthelogo-cache/video-library"
POSTED_DIR = "/Volumes/SSK SSD/fromthelogo-cache/video-library/posted"
POST_LOG = "/Volumes/SSK SSD/fromthelogo-cache/video-library/post.log"


def _notify(title, message):
    """Fire a macOS notification (works from the launchd GUI session)."""
    try:
        subprocess.run(["osascript", "-e",
                        f'display notification {message!r} with title {title!r} sound name "Glass"'],
                       capture_output=True, timeout=10)
    except Exception:
        pass


def post_next():
    """Hourly entry point: take the OLDEST video in the library, upload it as an
    auto-metadata DRAFT, move it to posted/, and fire a macOS notification. On the
    Google 'Verify it's you' challenge (NEEDS_VERIFY), LEAVE the video in the
    library, notify, and stop — next hour retries once the user clears it."""
    import glob, shutil, datetime
    os.makedirs(POSTED_DIR, exist_ok=True)
    def log(m):
        line = f"{datetime.datetime.now():%Y-%m-%d %H:%M} {m}"
        print(line)
        with open(POST_LOG, "a") as fh:
            fh.write(line + "\n")
    files = sorted((f for f in glob.glob(os.path.join(LIBRARY_DIR, "*.mp4"))
                    if not os.path.basename(f).startswith(".")), key=os.path.getmtime)
    if not files:
        log("library empty — nothing to post"); return
    f = files[0]
    name = os.path.basename(f)
    left = len(files) - 1
    log(f"posting next: {name}  ({len(files)} in library)")
    try:
        title, desc, tags = auto_meta(f)  # generate once, reuse for notification
    except Exception:
        title, desc, tags = name, "", []
    try:
        upload(f, title, desc, headed=True, tags=tags, auto=False)
        shutil.move(f, os.path.join(POSTED_DIR, name))
        log(f"OK draft posted + moved: {name}")
        _notify("FTL draft ready ✅", f"{title}  — review & publish. {left} left in library.")
    except SystemExit as e:
        if "NEEDS_VERIFY" in str(e):
            log(f"HELD (verify needed) — kept in library: {name}.")
            _notify("FTL upload paused ⚠️", "Google 'Verify it's you' — run verify-identity to resume.")
        else:
            log(f"SKIP {name}: {e}"); _notify("FTL upload skipped", f"{name}: {str(e)[:80]}")
    except Exception as e:
        log(f"FAIL {name}: {str(e).splitlines()[0][:100]}")
        _notify("FTL upload failed ❌", f"{name}: {str(e).splitlines()[0][:80]}")


def verify_identity():
    """Open a headed window on the session and HOLD it (up to 8 min) so the user
    can complete any 'Verify it's you' security prompt. Once cleared, the cloned
    session is trusted again and scheduled uploads resume."""
    with sync_playwright() as p:
        c = ctx(p, headed=True)
        page = c.pages[0] if c.pages else c.new_page()
        page.goto("https://www.youtube.com/upload", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        if not needs_verify(page):
            print("No verify prompt — session already trusted. You're good.")
            shot(page, "verify-clear"); c.close(); return
        print("A 'Verify it's you' prompt is showing. COMPLETE IT in the window")
        print("(click Next -> finish the 2FA/passkey). Waiting up to 8 minutes...")
        deadline = time.time() + 480
        while time.time() < deadline:
            if not needs_verify(page):
                print("Verify cleared — session trusted."); shot(page, "verify-cleared"); c.close(); return
            page.wait_for_timeout(4000)
        shot(page, "verify-still")
        print("Still showing after 8 min — try again or complete it in your normal Chrome.")
        c.close()


def drain_queue():
    """Scheduled entry point: upload every *.mp4 dropped in QUEUE_DIR as an
    auto-metadata DRAFT, then move it to uploaded/. Headed (GUI session) so the
    Keychain works. Safe to run on a launchd cadence; no-op when the queue is
    empty. The render/production step just cp's finished videos into QUEUE_DIR."""
    import glob, shutil, datetime
    os.makedirs(QUEUE_DONE, exist_ok=True)
    files = sorted(f for f in glob.glob(os.path.join(QUEUE_DIR, "*.mp4"))
                   if not os.path.basename(f).startswith("."))
    def log(m):
        line = f"{datetime.datetime.now():%Y-%m-%d %H:%M} {m}"
        print(line)
        with open(QUEUE_LOG, "a") as fh:
            fh.write(line + "\n")
    if not files:
        log("queue empty — nothing to upload"); return
    log(f"draining {len(files)} file(s)")
    for f in files:
        try:
            upload(f, "", headed=True, auto=True)
            shutil.move(f, os.path.join(QUEUE_DONE, os.path.basename(f)))
            log(f"OK draft + moved: {os.path.basename(f)}")
        except SystemExit as e:
            log(f"SKIP {os.path.basename(f)}: {e}")
        except Exception as e:
            log(f"FAIL {os.path.basename(f)}: {str(e).splitlines()[0][:100]}")
    log("drain complete")


def needs_verify(page):
    """True if Google's 'Verify it's you' security modal is blocking the page.
    Appears intermittently under heavy automation; requires the USER to clear it
    (identity/2FA — automation must not)."""
    try:
        return page.get_by_text("Verify it's you", exact=False).first.is_visible(timeout=1500)
    except Exception:
        return False


def rate_ad_suitability(page):
    """On the open upload wizard, jump to the Ad-suitability step and self-certify
    the video as CLEAN (no restricted content) so it's monetization/publish-ready.
    Best-effort: selects the 'No/None of the above' option for every question, then
    Submit rating. Screenshots each stage for debugging."""
    # jump to the Ad suitability step tab
    for how in (lambda: page.get_by_role("tab", name="Ad suitability").first.click(timeout=6000),
                lambda: page.get_by_text("Ad suitability", exact=True).last.click(timeout=6000)):
        try:
            how(); page.wait_for_timeout(2500); break
        except Exception:
            continue
    shot(page, "ad-suitability-form")
    # Each question is a radio group; the clean answer is "No" / "None of the above".
    # Select every such option present, then submit.
    picked = 0
    for label in ("None of the above", "No, "):
        opts = page.get_by_text(label, exact=False)
        for i in range(opts.count()):
            try:
                opts.nth(i).click(timeout=1500); picked += 1
            except Exception:
                continue
    # Fallback: for any remaining unanswered radio group, pick the FIRST option
    # (YouTube orders the least-restrictive answer first in each group).
    print(f"ad-suitability clean options picked: {picked}")
    page.wait_for_timeout(1000); shot(page, "ad-suitability-answered")
    for name in ("Submit rating", "Submit", "Done"):
        try:
            page.get_by_role("button", name=name, exact=False).first.click(timeout=4000)
            print("ad-suitability:", name); break
        except Exception:
            continue
    page.wait_for_timeout(2500); shot(page, "ad-suitability-submitted")


def _probe_kind(file):
    """short if vertical AND <=180s, else long."""
    try:
        wh = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
              "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).decode().strip()
        w, h = (int(x) for x in wh.split(",")[:2])
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
              "format=duration", "-of", "csv=p=0", file]).decode().strip())
        return "short" if (h > w and d <= 180) else "long"
    except Exception:
        return "long"


def auto_meta(file, kind=None):
    """Generate SEO/recommendation-optimized metadata via tools/ftl_meta.py."""
    kind = kind or _probe_kind(file)
    here = os.path.dirname(os.path.abspath(__file__))
    out = subprocess.run([sys.executable, os.path.join(here, "ftl_meta.py"), "generate",
                          "--file", file, "--kind", kind, "--json"],
                         capture_output=True, text=True, timeout=340)
    line = [l for l in out.stdout.splitlines() if l.strip().startswith("{")][-1]
    m = json.loads(line)
    print(f"auto-meta ({kind}): {m['title']}")
    return m["title"], m["description"], m.get("tags", [])


def upload(file, title, desc="", headed=False, tags=None, auto=False, kind=None):
    assert os.path.isfile(file), f"missing file: {file}"
    tags = tags or []
    if auto or not title:
        title, desc, tags = auto_meta(file, kind)
    with sync_playwright() as p:
        c = ctx(p, headed)
        page = c.pages[0] if c.pages else c.new_page()
        # Select the Tales account (talesfromthenba) + FTL channel explicitly.
        page.goto(STUDIO_HOME, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        # HARD GUARD: even with authuser set, verify we landed on From The Logo and
        # NOT a create-channel dialog / wrong account. Abort rather than risk AYM.
        if page.get_by_text("How you'll appear", exact=False).count():
            shot(page, "wrong-account")
            sys.exit("WRONG PROFILE: Studio opened the create-channel dialog (personal/AYM account). "
                     "From The Logo must only be accessed from the Tales profile. ABORTING — nothing uploaded.")
        if "studio.youtube.com" not in page.url:
            shot(page, "wrong-account")
            sys.exit(f"WRONG PROFILE: Studio redirected to {page.url} (not the FTL/Tales channel). ABORTING.")
        if FTL_CHANNEL not in page.url:
            # resolve the active channel; must be FTL
            if f"/channel/{FTL_CHANNEL}" not in page.url and "/channel/" in page.url:
                shot(page, "wrong-account")
                sys.exit(f"WRONG CHANNEL: on {page.url}, not From The Logo ({FTL_CHANNEL}). ABORTING.")
        if "accounts.google.com" in page.url:
            shot(page, "needs-login")
            sys.exit("Not logged in — run `login` mode first.")
        if needs_verify(page):
            shot(page, "needs-verify")
            sys.exit("NEEDS_VERIFY: Google 'Verify it's you' prompt — run `verify-identity` and clear it.")

        # Open the upload dialog: Create -> Upload videos
        page.locator('[aria-label="Create"]').first.click(timeout=15000)
        page.wait_for_timeout(1200)
        page.get_by_text("Upload videos", exact=False).first.click(timeout=8000)
        page.wait_for_timeout(4000)
        shot(page, "upload-dialog")

        # Over a CDP-attached (keep-open) browser, Playwright caps file transfer
        # at 50MB. YouTube re-encodes on upload anyway, so feed a lightly
        # compressed <50MB copy when the render is bigger.
        upload_file = file
        if os.path.getsize(file) > 48 * 1024 * 1024:
            tmp = os.path.join(SHOTS_DIR, "_upl_" + os.path.basename(file))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", file,
                            "-c:v", "libx264", "-crf", "24", "-preset", "fast",
                            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp],
                           capture_output=True)
            if os.path.isfile(tmp) and os.path.getsize(tmp) < 50 * 1024 * 1024:
                upload_file = tmp
                print(f"compressed for upload: {os.path.getsize(tmp)//1024//1024}MB")

        # Feed the file via the file-chooser event (visible "Select files"),
        # with the direct hidden-input as fallback.
        try:
            with page.expect_file_chooser(timeout=15000) as fc:
                page.get_by_role("button", name="Select files").first.click(timeout=8000)
            fc.value.set_files(upload_file)
        except Exception:
            inp = page.locator("input[type=file]").first
            inp.wait_for(state="attached", timeout=15000)
            inp.set_input_files(upload_file)
        print("file handed to uploader:", os.path.basename(file))
        page.wait_for_timeout(8000)
        shot(page, "after-file")

        if needs_verify(page):
            shot(page, "needs-verify")
            sys.exit("NEEDS_VERIFY: Google 'Verify it's you' prompt mid-upload — clear via `verify-identity`.")
        # Title (first #textbox) — select-all then type. The Studio auto-save
        # ("Saving…") overlay can fail the click actionability check, so fall
        # back to a force click / focus (visible field, just guarded).
        tb = page.locator("#textbox").first
        tb.wait_for(state="visible", timeout=30000)
        try:
            tb.click(timeout=8000)
        except Exception:
            try: tb.click(force=True, timeout=5000)
            except Exception: tb.focus()
        page.keyboard.press("Meta+a")
        page.keyboard.type(title, delay=10)

        # Description (second #textbox)
        if desc:
            db = page.locator("#textbox").nth(1)
            try:
                db.click(timeout=8000)
            except Exception:
                try: db.click(force=True, timeout=5000)
                except Exception: db.focus()
            page.keyboard.type(desc, delay=5)

        # Audience: not made for kids
        try:
            page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first.click(timeout=10000)
            print("audience: not made for kids")
        except PWTimeout:
            print("WARN: kids radio not found (may be preset)")

        # Tags live under "Show more" -> Tags field (chip input, comma-separated).
        if tags:
            try:
                page.get_by_text("Show more", exact=False).first.click(timeout=8000)
                page.wait_for_timeout(1500)
                tin = page.locator('#tags-container input, input[aria-label="Tags"], #text-input').first
                tin.wait_for(state="visible", timeout=8000)
                tin.click()
                tin.type(", ".join(tags) + ",", delay=3)
                print(f"tags set: {len(tags)}")
            except Exception as e:
                print("WARN: tags field not filled:", str(e).splitlines()[0][:80])
        shot(page, "details-filled")

        # Wait for the raw upload to finish. Read the whole dialog text and the
        # attribute ytcp exposes: ytcp-video-upload-progress[state] goes
        # PROGRESS_UPLOADING -> PROGRESS_PROCESSING/DONE. Break when the bytes
        # are up (processing can continue server-side; a completed upload is
        # already an autosaved draft).
        import re
        print("waiting for upload to complete...")
        deadline = time.time() + 60 * 20
        done = False
        while time.time() < deadline:
            state = ""
            try:
                state = page.locator("ytcp-video-upload-progress").first.get_attribute("state", timeout=4000) or ""
            except Exception:
                pass
            try:
                dlg = page.locator("ytcp-uploads-dialog").first.inner_text(timeout=4000)
            except Exception:
                dlg = ""
            low = dlg.lower()
            m = re.search(r"(uploading\s*\d+%|upload complete|processing[^\n]*|checks complete[^\n]*|finished processing|upload incomplete)", low)
            status = (m.group(0) if m else "").strip()
            pct = re.search(r"uploading\s*(\d+)%", low)
            print(f"  state={state or '-'} status={status or '(none)'}")
            # completion signals: attribute left UPLOADING, or text shows the
            # bytes finished / processing / checks, or 100%.
            if state and "UPLOADING" not in state.upper():
                done = True; break
            if any(k in low for k in ("upload complete", "checks complete",
                                      "finished processing", "processing hd")):
                done = True; break
            if "processing" in low and "uploading" not in low:
                done = True; break
            if pct and pct.group(1) == "100":
                done = True; break
            page.wait_for_timeout(5000)
        if not done:
            shot(page, "upload-timeout")
            sys.exit("upload did not complete in 20 min")

        # Small settle so the draft entity is committed server-side.
        page.wait_for_timeout(4000)
        shot(page, "upload-complete")

        # Self-rate ad suitability (clean) so the draft is fully publish-ready.
        try:
            rate_ad_suitability(page)
        except Exception as e:
            print("WARN ad-suitability:", str(e).splitlines()[0][:90])

        # Close the dialog WITHOUT assigning visibility -> stays a Draft.
        try:
            page.locator('ytcp-button#close-button, [aria-label="Close"], tp-yt-iron-icon#close-icon').first.click(timeout=8000)
        except PWTimeout:
            page.keyboard.press("Escape")
        page.wait_for_timeout(2500)
        # Confirm any "Save as draft" prompt.
        for label in ("Save as draft", "Save draft", "Save"):
            try:
                page.get_by_role("button", name=label, exact=False).first.click(timeout=2500)
                print("confirmed:", label); break
            except Exception:
                continue
        page.wait_for_timeout(3000)
        shot(page, "closed-draft")
        print("closed dialog — video left as DRAFT")
        c.close()


# Studio's Content page has separate tabs: longform lives under .../videos/upload,
# Shorts under .../videos/short. A Short draft only shows on the Shorts tab.
CONTENT_TABS = {"videos": "upload", "shorts": "short"}


def _channel_id(page):
    page.goto(STUDIO, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    url = page.url
    if "/channel/" not in url:
        sys.exit("cannot resolve channel — run login first")
    return url.split("/channel/")[1].split("/")[0]


def _rows_on_tab(page, chan, tab):
    slug = CONTENT_TABS[tab]
    page.goto(f"{STUDIO}/channel/{chan}/videos/{slug}", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    rows = page.locator("ytcp-video-row")
    out = []
    for i in range(min(rows.count(), 20)):
        r = rows.nth(i)
        try:
            t = r.locator("#video-title").inner_text().strip()
        except Exception:
            t = "(?)"
        try:
            vis = r.locator(".tablecell-visibility, #visibility-cell, td:nth-child(3)").first.inner_text().strip()
        except Exception:
            vis = "(?)"
        out.append((tab, t, " ".join(vis.split())))
    return out


def _content_rows(page, tabs=("videos", "shorts")):
    chan = _channel_id(page)
    out = []
    for tab in tabs:
        out += _rows_on_tab(page, chan, tab)
    return out, page


def _find_video(page, title):
    """Locate a video by title across both tabs; return (title, video_id, tab)."""
    chan = _channel_id(page)
    for tab in ("videos", "shorts"):
        page.goto(f"{STUDIO}/channel/{chan}/videos/{CONTENT_TABS[tab]}", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        rows = page.locator("ytcp-video-row")
        for i in range(min(rows.count(), 25)):
            r = rows.nth(i)
            try:
                t = r.locator("#video-title").inner_text().strip()
            except Exception:
                continue
            if title.lower() in t.lower():
                import re
                vid = None
                # Draft rows expose the id via the ?udvid= param after clicking
                # the title (they don't carry a /video/ href).
                try:
                    r.locator("#video-title").first.click(timeout=5000)
                    page.wait_for_timeout(3500)
                    m = re.search(r"udvid=([A-Za-z0-9_-]{6,})", page.url)
                    if not m:
                        m = re.search(r"/video/([A-Za-z0-9_-]{6,})", page.url)
                    vid = m.group(1) if m else None
                except Exception:
                    pass
                return t, vid, tab
    return None, None, None


def publish(title, visibility="public", when=None, confirm=False):
    """Promote a DRAFT to public/unlisted via the Studio publish WIZARD (same
    dialog family as upload — the edit page doesn't expose visibility radios).
    Click the draft -> Next through to the Visibility step -> select target ->
    (confirm) Publish. DRY-RUN by default: selects visibility, screenshots, stops."""
    vis_radio = 'tp-yt-paper-radio-button[name="%s"]' % (
        "PUBLIC" if visibility == "public" else "UNLISTED" if visibility == "unlisted" else "PRIVATE")
    with sync_playwright() as p:
        c = ctx(p, headed=True)
        page = c.pages[0] if c.pages else c.new_page()
        chan = _channel_id(page)
        opened = None
        for tab in ("videos", "shorts"):
            page.goto(f"{STUDIO}/channel/{chan}/videos/{CONTENT_TABS[tab]}", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)
            rows = page.locator("ytcp-video-row")
            for i in range(min(rows.count(), 25)):
                r = rows.nth(i)
                try:
                    t = r.locator("#video-title").inner_text().strip()
                except Exception:
                    continue
                if title.lower() in t.lower():
                    r.locator("#video-title").first.click(timeout=6000)
                    page.wait_for_timeout(5000)
                    opened = (t, tab)
                    break
            if opened:
                break
        if not opened:
            sys.exit(f"draft not found by title '{title}'")
        print(f"target: '{opened[0]}' [{opened[1]}]")
        shot(page, "wizard-open")

        # Jump straight to the Visibility step via its stepper tab (Next is
        # blocked on Ad-suitability by the self-rating; the top tabs let you skip).
        for how in (lambda: page.get_by_role("tab", name="Visibility").first.click(timeout=6000),
                    lambda: page.get_by_text("Visibility", exact=True).last.click(timeout=6000),
                    lambda: page.locator('#step-badge-3, [test-id="STEP_VISIBILITY"]').first.click(timeout=6000)):
            try:
                how(); page.wait_for_timeout(3000)
                if page.locator(vis_radio).count():
                    break
            except Exception:
                continue
        reached = bool(page.locator(vis_radio).count() and page.locator(vis_radio).first.is_visible())
        shot(page, "visibility-step")
        if not reached:
            shot(page, "visibility-miss")
            sys.exit("could not reach the Visibility step (selectors changed — see visibility-miss shot)")

        if when:
            try:
                page.locator('tp-yt-paper-radio-button[name="SCHEDULE"]').first.click(timeout=6000)
                print("selected: Schedule", when)
            except Exception as e:
                print("WARN schedule radio:", str(e)[:70])
        else:
            page.locator(vis_radio).first.click(timeout=6000)
            print("selected visibility:", visibility)
        page.wait_for_timeout(1500); shot(page, "visibility-selected")

        if not confirm:
            print("DRY RUN — visibility selected but NOT published. Re-run with --confirm to publish.")
            c.close(); return
        page.locator("#done-button, ytcp-button#done-button").first.click(timeout=8000)
        page.wait_for_timeout(5000); shot(page, "published")
        print(f"PUBLISHED '{opened[0]}' -> {visibility}" + (f" @ {when}" if when else ""))
        c.close()


def verify(title, headed=True):
    with sync_playwright() as p:
        c = ctx(p, headed=headed)
        page = c.pages[0] if c.pages else c.new_page()
        rows, page = _content_rows(page)
        shot(page, "content-list")
        hit = [(tab, t, v) for tab, t, v in rows if title.lower() in t.lower()]
        for tab, t, v in rows:
            print(f"  [{tab:<6}] {v:<26} {t[:66]}")
        if hit and any("draft" in v.lower() for _, _, v in hit):
            d = next(h for h in hit if "draft" in h[2].lower())
            print(f"VERIFIED: '{d[1]}' is a DRAFT (on the {d[0]} tab)")
        elif hit:
            print(f"FOUND but status is: {hit[0][2]} (tab {hit[0][0]})")
        else:
            print("NOT FOUND in recent rows on either tab")
        c.close()


def list_(headed=True):
    with sync_playwright() as p:
        c = ctx(p, headed=headed)
        page = c.pages[0] if c.pages else c.new_page()
        rows, page = _content_rows(page)
        shot(page, "content-list")
        cur = None
        for tab, t, v in rows:
            if tab != cur:
                print(f"\n=== {tab.upper()} TAB ==="); cur = tab
            print(f"  {v:<26} {t[:66]}")
        c.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login")
    ic = sub.add_parser("import-cookies")
    ic.add_argument("--chrome-profile", default=CHROME_PROFILE)
    ic.add_argument("--channel", default="logo")
    cp = sub.add_parser("clone-profile")
    cp.add_argument("--chrome-profile", default=CHROME_PROFILE)
    sub.add_parser("save-state")
    sub.add_parser("verify-identity")
    sub.add_parser("keep-open")
    st = sub.add_parser("status")  # open studio on the session, report channel
    st.add_argument("--headed", action="store_true")
    u = sub.add_parser("upload")
    u.add_argument("--file", required=True)
    u.add_argument("--title", default="")  # omit (or --auto) to auto-generate SEO metadata
    u.add_argument("--desc", default="")
    u.add_argument("--tags", default="")     # comma-separated; ignored when --auto
    u.add_argument("--auto", action="store_true")
    u.add_argument("--kind", choices=["short", "long"], default=None)
    u.add_argument("--headed", action="store_true")
    v = sub.add_parser("verify")
    v.add_argument("--title", required=True)
    sub.add_parser("list")
    sub.add_parser("drain-queue")
    sub.add_parser("post-next")
    pub = sub.add_parser("publish")
    pub.add_argument("--title", required=True)
    pub.add_argument("--visibility", choices=["public", "unlisted", "private"], default="public")
    pub.add_argument("--when", default=None, help='schedule "YYYY-MM-DD HH:MM" (public at that time)')
    pub.add_argument("--confirm", action="store_true", help="actually publish (default is dry-run)")
    a = ap.parse_args()
    if a.cmd == "login":
        login()
    elif a.cmd == "import-cookies":
        import_cookies(a.chrome_profile, a.channel)
    elif a.cmd == "clone-profile":
        clone_profile(a.chrome_profile)
    elif a.cmd == "save-state":
        save_state()
    elif a.cmd == "verify-identity":
        verify_identity()
    elif a.cmd == "keep-open":
        keep_open()
    elif a.cmd == "status":
        with sync_playwright() as p:
            c = ctx(p, headed=getattr(a, "headed", False))
            page = c.pages[0] if c.pages else c.new_page()
            page.goto(STUDIO, wait_until="domcontentloaded")
            page.wait_for_timeout(6000)
            shot(page, "status")
            print("URL:", page.url)
            print("logged in:" , "studio.youtube.com/channel" in page.url)
            c.close()
    elif a.cmd == "upload":
        tag_list = [t.strip() for t in a.tags.split(",") if t.strip()]
        upload(a.file, a.title, a.desc, a.headed, tags=tag_list, auto=a.auto, kind=a.kind)
    elif a.cmd == "verify":
        verify(a.title)
    elif a.cmd == "list":
        list_()
    elif a.cmd == "drain-queue":
        drain_queue()
    elif a.cmd == "post-next":
        post_next()
    elif a.cmd == "publish":
        publish(a.title, a.visibility, a.when, a.confirm)
