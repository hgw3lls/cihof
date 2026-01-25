"""
Scrape Cleveland International Hall of Fame inductee information to CSV/JSON.

What it does
- Pulls the main Inductees table (name, inducted_by, class_year, region)
- Follows each inductee link and extracts:
    - name (page title)
    - class year (best-effort)
    - inducted by (best-effort)
    - full page text (bio/remarks; cleaned)
    - images (src URLs)
    - embedded / linked videos (YouTube/Vimeo/MP4)
- Writes:
    - cihf_inductees.csv
    - cihf_inductees.json

Notes
- Be respectful: adds a small delay between requests.
- The site appears to be WordPress; selectors are “best effort” and may need tweaks.
"""

from __future__ import annotations

import csv
import json
import re
import time
from dataclasses import asdict, dataclass, field
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://clevelandinternationalhalloffame.com/"
INDEX_URL = urljoin(BASE, "inductees/")
OUT_CSV = "cihf_inductees.csv"
OUT_JSON = "cihf_inductees.json"


@dataclass
class Inductee:
    name: str
    profile_url: Optional[str] = None
    inducted_by: Optional[str] = None
    class_year: Optional[str] = None
    region: Optional[str] = None

    # From detail page
    bio_text: Optional[str] = None
    images: List[str] = field(default_factory=list)
    videos: List[str] = field(default_factory=list)


def clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s


def normalize_url(href: str, base: str) -> str:
    return urljoin(base, href)


def is_media_url(u: str) -> bool:
    if not u:
        return False
    host = (urlparse(u).hostname or "").lower()
    return any(
        x in host
        for x in [
            "youtube.com",
            "youtu.be",
            "vimeo.com",
            "player.vimeo.com",
        ]
    ) or u.lower().endswith((".mp4", ".mov", ".m4v"))


def fetch_soup(url: str, session: requests.Session, *, delay: float = 0.6) -> BeautifulSoup:
    r = session.get(url, timeout=30)
    r.raise_for_status()
    time.sleep(delay)
    return BeautifulSoup(r.text, "html.parser")


def parse_inductees_index(soup: BeautifulSoup) -> List[Inductee]:
    """
    On /inductees/ there is typically a table with columns:
    Inductee | Inducted By | Class | Region
    """
    inductees: List[Inductee] = []

    # Find the first table that looks like the inductees list
    tables = soup.find_all("table")
    target = None
    for t in tables:
        header = clean_text(t.get_text(" ", strip=True)).lower()
        if "inductee" in header and "inducted" in header and "class" in header:
            target = t
            break

    if not target:
        raise RuntimeError("Could not find inductees table on index page. Site structure may have changed.")

    # Parse rows
    for tr in target.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if len(tds) < 2:
            continue

        # Skip header row
        if "inductee" in clean_text(tds[0].get_text(" ", strip=True)).lower():
            continue

        name_cell = tds[0]
        inducted_by_cell = tds[1] if len(tds) > 1 else None
        class_cell = tds[2] if len(tds) > 2 else None
        region_cell = tds[3] if len(tds) > 3 else None

        name = clean_text(name_cell.get_text(" ", strip=True))
        if not name:
            continue

        a = name_cell.find("a", href=True)
        profile_url = normalize_url(a["href"], BASE) if a else None

        inducted_by = clean_text(inducted_by_cell.get_text(" ", strip=True)) if inducted_by_cell else None
        class_year = clean_text(class_cell.get_text(" ", strip=True)) if class_cell else None
        region = clean_text(region_cell.get_text(" ", strip=True)) if region_cell else None

        inductees.append(
            Inductee(
                name=name,
                profile_url=profile_url,
                inducted_by=inducted_by or None,
                class_year=class_year or None,
                region=region or None,
            )
        )

    return inductees


def extract_detail(ind: Inductee, soup: BeautifulSoup, url: str) -> None:
    """
    Extract best-effort details from an inductee profile page.
    """
    # Prefer H1 as name; fall back to existing name
    h1 = soup.find(["h1", "h2"])
    if h1:
        title = clean_text(h1.get_text(" ", strip=True))
        if title and len(title) <= 120:
            ind.name = title

    # WordPress content area
    content = soup.select_one("article") or soup.select_one("main") or soup.body
    text = clean_text(content.get_text(" ", strip=True) if content else soup.get_text(" ", strip=True))

    # Bio text: try to isolate to the main content container if possible
    # Common WP selectors:
    main_content = (
        soup.select_one(".entry-content")
        or soup.select_one(".post-content")
        or soup.select_one(".content-area")
        or content
    )
    bio_text = clean_text(main_content.get_text("\n", strip=True) if main_content else text)
    # Remove navigation-ish boilerplate if it appears
    bio_text = re.sub(r"\n{3,}", "\n\n", bio_text).strip()
    ind.bio_text = bio_text or None

    # Try to infer class year and inducted_by from headings / bold lines if missing
    if not ind.class_year:
        m = re.search(r"\b(20\d{2}|19\d{2})\b", bio_text)
        if m:
            ind.class_year = m.group(1)

    if not ind.inducted_by:
        # Pattern like: "X was inducted by Y."
        m = re.search(r"\binducted by\s+([A-Z][^.\n]{2,120})", bio_text, flags=re.IGNORECASE)
        if m:
            ind.inducted_by = clean_text(m.group(1))

    # Images
    imgs = []
    for img in soup.find_all("img", src=True):
        src = img["src"].strip()
        if not src:
            continue
        full = normalize_url(src, url)
        imgs.append(full)
    # De-dupe while preserving order
    seen = set()
    ind.images = [x for x in imgs if not (x in seen or seen.add(x))]

    # Videos: iframes + links
    vids = []

    for iframe in soup.find_all("iframe", src=True):
        src = iframe["src"].strip()
        if is_media_url(src):
            vids.append(src)

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        full = normalize_url(href, url)
        if is_media_url(full):
            vids.append(full)

    seen = set()
    ind.videos = [x for x in vids if not (x in seen or seen.add(x))]


def write_csv(inductees: List[Inductee], path: str) -> None:
    fields = [
        "name",
        "profile_url",
        "inducted_by",
        "class_year",
        "region",
        "bio_text",
        "images",
        "videos",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for ind in inductees:
            row = asdict(ind)
            # store lists as JSON strings
            row["images"] = json.dumps(row["images"], ensure_ascii=False)
            row["videos"] = json.dumps(row["videos"], ensure_ascii=False)
            w.writerow(row)


def write_json(inductees: List[Inductee], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump([asdict(i) for i in inductees], f, ensure_ascii=False, indent=2)


def main():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "CIHFInducteeScraper/1.0 (educational; contact: you@example.com)",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    print(f"Fetching index: {INDEX_URL}")
    index_soup = fetch_soup(INDEX_URL, session)

    inductees = parse_inductees_index(index_soup)
    print(f"Found {len(inductees)} inductees in the index table.")

    # Follow detail pages
    for i, ind in enumerate(inductees, 1):
        if not ind.profile_url:
            continue
        try:
            print(f"[{i}/{len(inductees)}] Fetching: {ind.profile_url}")
            detail_soup = fetch_soup(ind.profile_url, session)
            extract_detail(ind, detail_soup, ind.profile_url)
        except Exception as e:
            print(f"  !! Failed for {ind.name} ({ind.profile_url}): {e}")

    write_csv(inductees, OUT_CSV)
    write_json(inductees, OUT_JSON)

    print(f"Done.\n- CSV:  {OUT_CSV}\n- JSON: {OUT_JSON}")


if __name__ == "__main__":
    main()

