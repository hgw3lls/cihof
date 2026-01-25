import os
import re
import csv
import json
import time
import hashlib
from urllib.parse import urlparse, unquote

import requests

JSON_PATH = "cihf_inductees.json"  # your file :contentReference[oaicite:1]{index=1}
OUT_DIR = "cihf_images"
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.csv")

# Politeness / stability
REQUEST_DELAY_SEC = 0.35
TIMEOUT = 30

# If True, skip common site chrome/icons that appear on every page
SKIP_SITE_CHROME = True

# Common “not actually inductee content” images seen in the JSON (icons, site logo, etc.)
CHROME_PATTERNS = [
    r"/Cle_Int_HoF-lo",
    r"/facebook\.png$",
    r"/twitter\.png$",
    r"/youtube\.png$",
    r"/youtube-fix\.png$",
]

# Also skip WordPress size-variants you might not want; set False to keep them
SKIP_THUMBNAILS = False  # if True, drops things like -300x173, -876x1024 etc.

THUMB_RE = re.compile(r"-\d{2,4}x\d{2,4}(?=\.\w{3,4}$)", re.IGNORECASE)


def safe_name(s: str, max_len: int = 80) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\s\-\.]", "", s)  # keep letters/numbers/_/space/-/.
    s = s.strip().replace(" ", "_")
    return s[:max_len] if len(s) > max_len else s


def looks_like_chrome(url: str) -> bool:
    if not url:
        return True
    u = url.strip()
    if SKIP_SITE_CHROME:
        for pat in CHROME_PATTERNS:
            if re.search(pat, u, flags=re.IGNORECASE):
                return True
    return False


def normalize_ext_from_url(url: str) -> str:
    path = urlparse(url).path
    path = unquote(path)
    _, ext = os.path.splitext(path)
    ext = ext.lower().strip(".")
    if ext in {"jpg", "jpeg", "png", "gif", "webp"}:
        return ext
    # Fallback if no ext or weird ext
    return "jpg"


def strip_thumbnail_suffix(filename: str) -> str:
    # Turns foo-300x173.jpg -> foo.jpg
    return THUMB_RE.sub("", filename)


def url_hash(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def download(url: str, dest_path: str, session: requests.Session) -> tuple[bool, int, str]:
    """
    Returns (ok, status_code, note)
    """
    try:
        r = session.get(url, stream=True, timeout=TIMEOUT)
        status = r.status_code
        if status != 200:
            return False, status, f"http_{status}"
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)
        return True, status, "downloaded"
    except Exception as e:
        return False, 0, f"error:{type(e).__name__}"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "CIHFImageDownloader/1.0 (educational archival use)",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        }
    )

    # Track URL->saved path to prevent duplicates across inductees/classes
    seen_url_to_path: dict[str, str] = {}

    # Manifest rows
    manifest_rows = []
    total = 0
    kept = 0
    skipped = 0
    downloaded = 0
    reused = 0
    failed = 0

    for item in data:
        name = item.get("name") or "Unknown"
        year = str(item.get("class_year") or "UnknownYear")
        images = item.get("images") or []

        # Folder: cihf_images/<year>/<inductee_name>/
        year_dir = os.path.join(OUT_DIR, safe_name(year))
        person_dir = os.path.join(year_dir, safe_name(name))
        os.makedirs(person_dir, exist_ok=True)

        for idx, url in enumerate(images, start=1):
            total += 1
            if not url or looks_like_chrome(url):
                skipped += 1
                manifest_rows.append(
                    {
                        "class_year": year,
                        "name": name,
                        "url": url,
                        "saved_path": "",
                        "status": "skipped_chrome_or_empty",
                    }
                )
                continue

            # Decide filename
            ext = normalize_ext_from_url(url)
            base = os.path.basename(urlparse(url).path)
            base = unquote(base) if base else f"image_{idx}.{ext}"

            # Optional: drop WP thumbnail suffix in filename (but still downloads the URL as-is)
            if SKIP_THUMBNAILS:
                base = strip_thumbnail_suffix(base)

            # Add a short hash prefix to avoid collisions
            hashed = url_hash(url)
            filename = f"{hashed}_{base}"
            dest = os.path.join(person_dir, filename)

            kept += 1

            if url in seen_url_to_path:
                # Already downloaded elsewhere; just copy path reference (don’t redownload)
                reused += 1
                manifest_rows.append(
                    {
                        "class_year": year,
                        "name": name,
                        "url": url,
                        "saved_path": seen_url_to_path[url],
                        "status": "reused_existing_download",
                    }
                )
                continue

            ok, status_code, note = download(url, dest, session)
            time.sleep(REQUEST_DELAY_SEC)

            if ok:
                downloaded += 1
                seen_url_to_path[url] = dest
                manifest_rows.append(
                    {
                        "class_year": year,
                        "name": name,
                        "url": url,
                        "saved_path": dest,
                        "status": "downloaded",
                    }
                )
            else:
                failed += 1
                manifest_rows.append(
                    {
                        "class_year": year,
                        "name": name,
                        "url": url,
                        "saved_path": "",
                        "status": note,
                    }
                )

    # Write manifest
    with open(MANIFEST_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["class_year", "name", "url", "saved_path", "status"])
        w.writeheader()
        w.writerows(manifest_rows)

    print("Done.")
    print(f"Total image URLs seen: {total}")
    print(f"Kept (non-chrome):     {kept}")
    print(f"Skipped:              {skipped}")
    print(f"Downloaded:           {downloaded}")
    print(f"Reused (deduped):      {reused}")
    print(f"Failed:               {failed}")
    print(f"Output folder:         {OUT_DIR}")
    print(f"Manifest:              {MANIFEST_PATH}")


if __name__ == "__main__":
    main()

