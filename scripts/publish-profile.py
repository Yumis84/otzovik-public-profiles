#!/usr/bin/env python3
import argparse
import shutil
from pathlib import Path

REQUIRED = ("profile.html", "profile.css", "profile.json", "profile.md", "llms.txt")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--output", default="profiles")
    a = p.parse_args()
    src = Path(a.source)
    dst = Path(a.output) / a.slug
    missing = [name for name in REQUIRED if not (src / name).is_file()]
    if missing:
        raise SystemExit("Missing required files: " + ", ".join(missing))
    dst.mkdir(parents=True, exist_ok=True)
    mapping = {"profile.html": "index.html"}
    for name in REQUIRED:
        shutil.copy2(src / name, dst / mapping.get(name, name))
    print(f"Published {a.slug} -> {dst}")

if __name__ == "__main__":
    main()
