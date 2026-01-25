#!/usr/bin/env python3
"""
fix_conflicts_recent.py
Scan or fix Git merge conflict markers, but ONLY for files modified recently.

Examples:
  # scan last 2 hours
  python3 tools/fix_conflicts_recent.py . --mode scan --since-minutes 120

  # fix (dry run) last 24 hours
  python3 tools/fix_conflicts_recent.py . --mode fix --since-hours 24

  # fix + write changes, keep ours always, last 30 minutes
  python3 tools/fix_conflicts_recent.py . --mode fix --strategy prefer-ours --since-minutes 30 --write
"""

from __future__ import annotations

import argparse
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Optional

CONFLICT_START = re.compile(r"^<{7}(\s+.*)?$")
CONFLICT_MID   = re.compile(r"^={7}\s*$")
CONFLICT_END   = re.compile(r"^>{7}(\s+.*)?$")

TEXT_EXTS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".css", ".scss", ".md", ".txt", ".html", ".yml", ".yaml"
}

DEFAULT_EXCLUDES = {".git", "node_modules", "dist", "build", ".next", ".turbo", ".cache", ".vite"}

@dataclass
class Conflict:
    start_line: int
    end_line: int
    ours: List[str]
    theirs: List[str]

def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTS:
        return True
    try:
        raw = path.read_bytes()
        if b"\x00" in raw:
            return False
        raw.decode("utf-8")
        return True
    except Exception:
        return False

def find_conflicts(lines: List[str]) -> Tuple[List[Conflict], List[Tuple[int, str]]]:
    conflicts: List[Conflict] = []
    stray: List[Tuple[int, str]] = []

    i = 0
    n = len(lines)

    while i < n:
        if CONFLICT_START.match(lines[i]):
            start_i = i
            i += 1

            ours: List[str] = []
            while i < n and not CONFLICT_MID.match(lines[i]) and not CONFLICT_END.match(lines[i]) and not CONFLICT_START.match(lines[i]):
                ours.append(lines[i]); i += 1

            if i >= n or not CONFLICT_MID.match(lines[i]):
                stray.append((start_i + 1, lines[start_i].rstrip("\n")))
                i = start_i + 1
                continue

            i += 1  # skip =======

            theirs: List[str] = []
            while i < n and not CONFLICT_END.match(lines[i]) and not CONFLICT_START.match(lines[i]):
                theirs.append(lines[i]); i += 1

            if i >= n or not CONFLICT_END.match(lines[i]):
                stray.append((start_i + 1, lines[start_i].rstrip("\n")))
                i = start_i + 1
                continue

            end_i = i
            i += 1  # skip >>>>>>>

            conflicts.append(
                Conflict(
                    start_line=start_i + 1,
                    end_line=end_i + 1,
                    ours=ours,
                    theirs=theirs,
                )
            )
        else:
            if CONFLICT_MID.match(lines[i]) or CONFLICT_END.match(lines[i]):
                stray.append((i + 1, lines[i].rstrip("\n")))
            i += 1

    return conflicts, stray

def normalize_block(block: List[str]) -> str:
    return "".join([ln.rstrip() + "\n" for ln in block]).strip()

def is_effectively_empty(block: List[str]) -> bool:
    return normalize_block(block) == ""

def auto_resolve(ours: List[str], theirs: List[str]) -> Optional[List[str]]:
    if normalize_block(ours) == normalize_block(theirs):
        return ours
    if is_effectively_empty(ours) and not is_effectively_empty(theirs):
        return theirs
    if is_effectively_empty(theirs) and not is_effectively_empty(ours):
        return ours
    return None

def comment_wrap(path: Path, ours: List[str], theirs: List[str]) -> List[str]:
    ext = path.suffix.lower()

    if ext in {".md", ".html"}:
        open_c, close_c = "<!--", "-->"
        def wrap(tag: str, body: List[str]) -> List[str]:
            out = [f"{open_c} CONFLICT {tag} START {close_c}\n"]
            out.extend(body if body else ["\n"])
            out.append(f"{open_c} CONFLICT {tag} END {close_c}\n")
            return out
        out: List[str] = [f"{open_c} CONFLICT BLOCK (unresolved) {close_c}\n"]
        out += wrap("OURS", ours)
        out += wrap("THEIRS", theirs)
        out.append(f"{open_c} END CONFLICT BLOCK {close_c}\n")
        return out

    def wrap(tag: str, body: List[str]) -> List[str]:
        out = [f"/* CONFLICT {tag} START */\n"]
        out.extend(body if body else ["\n"])
        out.append(f"/* CONFLICT {tag} END */\n")
        return out

    out: List[str] = ["/* CONFLICT BLOCK (unresolved): choose ONE side and delete the other */\n"]
    out += wrap("OURS", ours)
    out += wrap("THEIRS", theirs)
    out.append("/* END CONFLICT BLOCK */\n")
    return out

def apply_fixes(path: Path, lines: List[str], conflicts: List[Conflict], strategy: str) -> Tuple[List[str], int]:
    if not conflicts:
        return lines, 0

    out: List[str] = []
    i = 0
    n = len(lines)
    rewritten = 0

    while i < n:
        if CONFLICT_START.match(lines[i]):
            # parse the actual block indices in the original file
            start_i = i
            i += 1
            while i < n and not CONFLICT_MID.match(lines[i]):
                i += 1
            if i >= n:
                out.append(lines[start_i]); rewritten += 0
                continue
            mid_i = i
            i += 1
            while i < n and not CONFLICT_END.match(lines[i]):
                i += 1
            if i >= n:
                out.append(lines[start_i]); rewritten += 0
                continue
            end_i = i

            ours = lines[start_i + 1 : mid_i]
            theirs = lines[mid_i + 1 : end_i]

            if strategy == "prefer-ours":
                replacement = ours
            elif strategy == "prefer-theirs":
                replacement = theirs
            elif strategy == "comment":
                replacement = comment_wrap(path, ours, theirs)
            else:  # auto
                resolved = auto_resolve(ours, theirs)
                replacement = resolved if resolved is not None else comment_wrap(path, ours, theirs)

            out.extend(replacement)
            rewritten += 1

            i += 1  # skip >>>>>>>
        else:
            out.append(lines[i])
            i += 1

    return out, rewritten

def walk_recent_files(root: Path, excludes: set[str], cutoff_epoch: float) -> List[Path]:
    out: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in excludes]
        for fn in filenames:
            p = Path(dirpath) / fn
            if not p.is_file():
                continue
            # skip obvious binaries
            if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"}:
                continue
            try:
                if p.stat().st_mtime >= cutoff_epoch:
                    out.append(p)
            except FileNotFoundError:
                continue
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", default=".", help="Folder/repo root (default: .)")
    ap.add_argument("--mode", choices=["scan", "fix"], default="scan")
    ap.add_argument("--strategy", choices=["auto", "prefer-ours", "prefer-theirs", "comment"], default="auto")
    ap.add_argument("--since-minutes", type=int, default=None, help="Only include files modified in last N minutes")
    ap.add_argument("--since-hours", type=int, default=None, help="Only include files modified in last N hours")
    ap.add_argument("--since-days", type=int, default=None, help="Only include files modified in last N days")
    ap.add_argument("--exclude-dir", action="append", default=[], help="Exclude additional directories")
    ap.add_argument("--no-backup", action="store_true", help="Do not create .bak backups when writing")
    ap.add_argument("--write", action="store_true", help="Actually write changes (fix mode). Without --write, dry run.")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    excludes = set(DEFAULT_EXCLUDES) | set(args.exclude_dir)

    # determine cutoff
    now = time.time()
    minutes = args.since_minutes
    if args.since_hours is not None:
        minutes = (minutes or 0) + args.since_hours * 60
    if args.since_days is not None:
        minutes = (minutes or 0) + args.since_days * 24 * 60
    if minutes is None:
        minutes = 60 * 24  # default: last 24 hours

    cutoff = now - (minutes * 60)

    candidates = walk_recent_files(root, excludes, cutoff)

    flagged = 0
    total_blocks = 0
    modified_files = 0

    for p in sorted(candidates):
        if not is_text_file(p):
            continue

        try:
            original = p.read_text(encoding="utf-8").splitlines(True)
        except UnicodeDecodeError:
            continue

        conflicts, stray = find_conflicts(original)
        if not conflicts and not stray:
            continue

        flagged += 1
        total_blocks += len(conflicts)
        rel = p.relative_to(root)

        if args.mode == "scan":
            print(f"\n{rel}")
            for c in conflicts:
                print(f"  conflict: lines {c.start_line}-{c.end_line}")
            for (ln, mark) in stray:
                print(f"  stray marker: line {ln}: {mark}")
            continue

        new_lines, rewritten = apply_fixes(p, original, conflicts, args.strategy)

        print(f"\n{rel}")
        print(f"  conflicts: {len(conflicts)} | stray: {len(stray)} | rewritten blocks: {rewritten}")

        if rewritten > 0 and args.write:
            if not args.no_backup:
                bak = p.with_suffix(p.suffix + ".bak")
                bak.write_text("".join(original), encoding="utf-8")
            p.write_text("".join(new_lines), encoding="utf-8")
            modified_files += 1
        elif rewritten > 0 and not args.write:
            print("  (dry run) add --write to apply changes")

    print("\n---")
    print(f"recent window: last {minutes} minutes")
    print(f"recent files scanned: {len(candidates)}")
    print(f"files with markers: {flagged}")
    print(f"conflict blocks found: {total_blocks}")
    if args.mode == "fix":
        print(f"files modified: {modified_files} ({'dry run' if not args.write else 'written'})")

    # scan mode returns non-zero if any markers found (useful in CI / pre-commit)
    return 1 if (args.mode == "scan" and flagged > 0) else 0

if __name__ == "__main__":
    raise SystemExit(main())

