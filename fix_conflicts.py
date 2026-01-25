#!/usr/bin/env python3
"""
fix_conflicts.py
Find and fix Git merge conflict markers that often get left by automated patch tools.

Modes:
  - scan: report files/line numbers with conflict markers
  - fix : rewrite conflicts to prevent build/parser crashes
          * auto-resolve trivial conflicts:
              - ours == theirs  -> keep that text
              - one side empty  -> keep the non-empty side
          * otherwise "quarantine" the conflict as comments so TS/TSX parses
            and you can manually resolve later.

Creates a .bak backup for each modified file (unless --no-backup).
"""

from __future__ import annotations

import argparse
import os
import re
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
    start_marker: str
    end_marker: str

def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTS:
        return True
    # fallback: treat unknown as text only if small and decodable
    try:
        raw = path.read_bytes()
        if b"\x00" in raw:
            return False
        raw.decode("utf-8")
        return True
    except Exception:
        return False

def find_conflicts(lines: List[str]) -> Tuple[List[Conflict], List[Tuple[int, str]]]:
    """
    Parse Git conflict blocks:
      <<<<<<< ours
      ... ours ...
      =======
      ... theirs ...
      >>>>>>> theirs
    Returns:
      conflicts: structured blocks
      stray_markers: markers found that don't form a valid block
    """
    conflicts: List[Conflict] = []
    stray: List[Tuple[int, str]] = []

    i = 0
    n = len(lines)
    while i < n:
        if CONFLICT_START.match(lines[i]):
            start_i = i
            start_marker = lines[i].rstrip("\n")
            i += 1
            ours: List[str] = []
            while i < n and not CONFLICT_MID.match(lines[i]) and not CONFLICT_END.match(lines[i]) and not CONFLICT_START.match(lines[i]):
                ours.append(lines[i])
                i += 1

            if i >= n or not CONFLICT_MID.match(lines[i]):
                # malformed block
                stray.append((start_i + 1, start_marker))
                i = start_i + 1
                continue

            i += 1  # skip =======
            theirs: List[str] = []
            while i < n and not CONFLICT_END.match(lines[i]) and not CONFLICT_START.match(lines[i]):
                theirs.append(lines[i])
                i += 1

            if i >= n or not CONFLICT_END.match(lines[i]):
                stray.append((start_i + 1, start_marker))
                i = start_i + 1
                continue

            end_marker = lines[i].rstrip("\n")
            end_i = i
            i += 1

            conflicts.append(
                Conflict(
                    start_line=start_i + 1,
                    end_line=end_i + 1,
                    ours=ours,
                    theirs=theirs,
                    start_marker=start_marker,
                    end_marker=end_marker,
                )
            )
        else:
            # also flag any stray marker lines
            if CONFLICT_MID.match(lines[i]) or CONFLICT_END.match(lines[i]):
                stray.append((i + 1, lines[i].rstrip("\n")))
            i += 1

    return conflicts, stray

def normalize_block(block: List[str]) -> str:
    # Compare blocks ignoring trailing whitespace differences
    return "".join([ln.rstrip() + "\n" for ln in block]).strip()

def is_effectively_empty(block: List[str]) -> bool:
    return normalize_block(block) == ""

def auto_resolve(ours: List[str], theirs: List[str]) -> Optional[List[str]]:
    """
    Return resolved lines if trivial; otherwise None.
    Trivial cases:
      - identical content
      - one side empty
    """
    if normalize_block(ours) == normalize_block(theirs):
        return ours
    if is_effectively_empty(ours) and not is_effectively_empty(theirs):
        return theirs
    if is_effectively_empty(theirs) and not is_effectively_empty(ours):
        return ours
    return None

def comment_wrap(path: Path, ours: List[str], theirs: List[str]) -> List[str]:
    """
    Wrap conflict in comments that won't break parsing.
    For TS/JS/CSS/HTML/JSON we use /* */.
    For MD/TXT we use <!-- -->.
    """
    ext = path.suffix.lower()

    if ext in {".md", ".html"}:
        open_c, close_c = "<!--", "-->"
        def wrap(tag: str, body: List[str]) -> List[str]:
            out = [f"{open_c} CONFLICT {tag} START {close_c}\n"]
            out.extend(body if body else ["\n"])
            out.append(f"{open_c} CONFLICT {tag} END {close_c}\n")
            return out
        out = [f"{open_c} CONFLICT BLOCK (unresolved) {close_c}\n"]
        out += wrap("OURS", ours)
        out += wrap("THEIRS", theirs)
        out.append(f"{open_c} END CONFLICT BLOCK {close_c}\n")
        return out

    # Default to block comments (works for TS/TSX/JS/JSX/CSS/SCSS/etc.)
    def wrap(tag: str, body: List[str]) -> List[str]:
        out = [f"/* CONFLICT {tag} START */\n"]
        out.extend(body if body else ["\n"])
        out.append(f"/* CONFLICT {tag} END */\n")
        return out

    out: List[str] = ["/* CONFLICT BLOCK (unresolved): please choose one side and delete the other */\n"]
    out += wrap("OURS", ours)
    out += wrap("THEIRS", theirs)
    out.append("/* END CONFLICT BLOCK */\n")
    return out

def apply_fixes(path: Path, lines: List[str], conflicts: List[Conflict], strategy: str) -> Tuple[List[str], int]:
    """
    strategy:
      - "prefer-ours": keep ours always
      - "prefer-theirs": keep theirs always
      - "auto": only resolve trivial, otherwise comment-wrap
      - "comment": always comment-wrap (never choose)
    """
    if not conflicts:
        return lines, 0

    out: List[str] = []
    idx = 0
    modifications = 0

    # Build quick index by start line number (1-based) for iteration
    conflict_iter = iter(conflicts)
    current = next(conflict_iter, None)

    line_no = 1
    n = len(lines)

    while idx < n:
        if current and line_no == current.start_line:
            # Skip from start_line to end_line inclusive, replacing
            # We need to find exact indices: start_line is current idx, end_line is unknown idx:
            start_idx = idx
            # Find end_idx by scanning to conflict end marker
            end_idx = start_idx
            while end_idx < n and not CONFLICT_END.match(lines[end_idx]):
                end_idx += 1
            if end_idx < n:
                end_idx += 1  # include >>>>>>>
            else:
                end_idx = start_idx + 1  # malformed safety

            replacement: List[str]
            if strategy == "prefer-ours":
                replacement = current.ours
            elif strategy == "prefer-theirs":
                replacement = current.theirs
            elif strategy == "comment":
                replacement = comment_wrap(path, current.ours, current.theirs)
            else:  # auto
                resolved = auto_resolve(current.ours, current.theirs)
                replacement = resolved if resolved is not None else comment_wrap(path, current.ours, current.theirs)

            out.extend(replacement)
            modifications += 1

            # Advance idx/line_no to after the conflict block in original
            consumed = end_idx - start_idx
            idx = end_idx
            line_no += consumed

            current = next(conflict_iter, None)
        else:
            out.append(lines[idx])
            idx += 1
            line_no += 1

    return out, modifications

def walk_repo(root: Path, excludes: set[str]) -> List[Path]:
    paths: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune excluded dirs
        dirnames[:] = [d for d in dirnames if d not in excludes]
        for fn in filenames:
            p = Path(dirpath) / fn
            # skip huge/binary-ish files quickly
            if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"}:
                continue
            paths.append(p)
    return paths

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", default=".", help="Repo root (default: .)")
    ap.add_argument("--mode", choices=["scan", "fix"], default="scan")
    ap.add_argument("--strategy", choices=["auto", "prefer-ours", "prefer-theirs", "comment"], default="auto")
    ap.add_argument("--include", action="append", default=[], help="Only include paths containing this substring (repeatable)")
    ap.add_argument("--exclude-dir", action="append", default=[], help="Exclude additional directories (repeatable)")
    ap.add_argument("--no-backup", action="store_true", help="Do not write .bak backups")
    ap.add_argument("--write", action="store_true", help="Actually write changes (fix mode). Without --write, does a dry run.")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    excludes = set(DEFAULT_EXCLUDES) | set(args.exclude_dir)

    candidates = walk_repo(root, excludes)

    if args.include:
        candidates = [p for p in candidates if any(s in str(p) for s in args.include)]

    flagged_files = 0
    total_conflicts = 0
    total_modified_files = 0

    for p in candidates:
        if not p.is_file():
            continue
        if not is_text_file(p):
            continue

        try:
            lines = p.read_text(encoding="utf-8").splitlines(True)
        except UnicodeDecodeError:
            continue

        conflicts, stray = find_conflicts(lines)
        if not conflicts and not stray:
            continue

        flagged_files += 1
        total_conflicts += len(conflicts)

        rel = p.relative_to(root)
        if args.mode == "scan":
            print(f"\n{rel}")
            for c in conflicts:
                print(f"  conflict: lines {c.start_line}-{c.end_line}")
            for (ln, mark) in stray:
                print(f"  stray marker: line {ln}: {mark}")
            continue

        # fix mode
        new_lines, mods = apply_fixes(p, lines, conflicts, args.strategy)

        print(f"\n{rel}")
        print(f"  conflicts found: {len(conflicts)} | stray markers: {len(stray)} | blocks rewritten: {mods}")
        if mods == 0:
            continue

        if args.write:
            if not args.no_backup:
                bak = p.with_suffix(p.suffix + ".bak")
                bak.write_text("".join(lines), encoding="utf-8")
            p.write_text("".join(new_lines), encoding="utf-8")
            total_modified_files += 1
        else:
            print("  (dry run) add --write to apply changes")

    print("\n---")
    print(f"files with markers: {flagged_files}")
    print(f"conflict blocks found: {total_conflicts}")
    if args.mode == "fix":
        print(f"files modified: {total_modified_files} ({'dry run' if not args.write else 'written'})")

    return 0 if flagged_files == 0 else 1 if args.mode == "scan" else 0

if __name__ == "__main__":
    raise SystemExit(main())

