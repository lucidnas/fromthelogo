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


def _persistent(p, headed=False):
    """Persistent context on the cloned real-Chrome profile with the REAL
    Keychain (for save_state / interactive only)."""
    return p.chromium.launch_persistent_context(
        CLONE_DIR, channel="chrome", headless=not headed,
        viewport={"width": 1440, "height": 900},
        ignore_default_args=["--use-mock-keychain", "--password-store=basic"],
        args=["--disable-blink-features=AutomationControlled", "--profile-directory=Default"],
    )


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


def ctx(p, headed=False):
    """Preferred path: saved storage_state JSON -> headless real-Chrome, no
    Keychain. Falls back to the persistent clone (real Keychain) if no state
    file yet."""
    os.makedirs(SHOTS_DIR, exist_ok=True)
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
        page.goto(STUDIO + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        if "accounts.google.com" in page.url:
            shot(page, "needs-login")
            sys.exit("Not logged in — run `login` mode first.")

        # Open the upload dialog: Create -> Upload videos
        page.locator('[aria-label="Create"]').first.click(timeout=15000)
        page.wait_for_timeout(1200)
        page.get_by_text("Upload videos", exact=False).first.click(timeout=8000)
        page.wait_for_timeout(4000)
        shot(page, "upload-dialog")

        # Feed the file (input is inside the upload dialog / shadow DOM;
        # Playwright pierces shadow DOM for input[type=file]).
        inp = page.locator("input[type=file]").first
        inp.wait_for(state="attached", timeout=30000)
        inp.set_input_files(file)
        print("file handed to uploader:", os.path.basename(file))
        page.wait_for_timeout(8000)
        shot(page, "after-file")

        # Title (first #textbox) — select-all then type
        tb = page.locator("#textbox").first
        tb.wait_for(state="visible", timeout=30000)
        tb.click()
        page.keyboard.press("Meta+a")
        page.keyboard.type(title, delay=10)

        # Description (second #textbox)
        if desc:
            db = page.locator("#textbox").nth(1)
            db.click()
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
    a = ap.parse_args()
    if a.cmd == "login":
        login()
    elif a.cmd == "import-cookies":
        import_cookies(a.chrome_profile, a.channel)
    elif a.cmd == "clone-profile":
        clone_profile(a.chrome_profile)
    elif a.cmd == "save-state":
        save_state()
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
