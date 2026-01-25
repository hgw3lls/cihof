import json
import os
import subprocess
import re

JSON_PATH = "cihof_inductees.json"
OUTPUT_DIR = "videos"

YOUTUBE_EMBED_RE = re.compile(r"youtube\.com/embed/([a-zA-Z0-9_-]+)")

def sanitize(name: str) -> str:
    return re.sub(r"[^\w\-]+", "_", name.strip())

def extract_video_id(url: str):
    match = YOUTUBE_EMBED_RE.search(url)
    if match:
        return match.group(1)
    return None

def download_video(video_id: str, out_dir: str, title: str):
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "yt-dlp",
        "-f", "bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "-o", f"{out_dir}/{title}.%(ext)s",
        f"https://www.youtube.com/watch?v={video_id}"
    ]

    subprocess.run(cmd, check=False)

def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        inductees = json.load(f)

    for person in inductees:
        name = sanitize(person.get("name", "unknown"))
        year = sanitize(person.get("class_year", "unknown"))
        videos = person.get("videos", [])

        person_dir = os.path.join(OUTPUT_DIR, f"{year}_{name}")

        for v in videos:
            video_id = extract_video_id(v)
            if not video_id:
                continue

            title = f"{year}_{name}_{video_id}"
            print(f"Downloading: {title}")
            download_video(video_id, person_dir, title)

if __name__ == "__main__":
    main()

