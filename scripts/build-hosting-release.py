#!/usr/bin/env python3
"""Build a deterministic hosting-neutral release archive from generated profiles."""

from __future__ import annotations
import argparse
import hashlib
import json
import tarfile
from pathlib import Path

REQUIRED = ("index.html", "profile.css", "profile.json", "profile.md", "llms.txt")

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profiles", default="profiles")
    ap.add_argument("--out", default="dist")
    args = ap.parse_args()
    root = Path(args.profiles)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    slugs = []
    files = []
    for company in sorted(p for p in root.iterdir() if p.is_dir()):
        if not all((company / name).is_file() for name in REQUIRED):
            continue
        slugs.append(company.name)
        for path in sorted(p for p in company.rglob("*") if p.is_file()):
            rel = path.relative_to(root).as_posix()
            files.append({"path": rel, "sha256": sha256(path), "bytes": path.stat().st_size})

    if not slugs:
        raise SystemExit("No complete generated profiles found")

    manifest = {"format": 1, "profiles": slugs, "files": files}
    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    archive = out / "otzovik-public-profiles.tar.gz"
    with tarfile.open(archive, "w:gz") as tf:
        tf.add(manifest_path, arcname="manifest.json")
        for item in files:
            tf.add(root / item["path"], arcname="profiles/" + item["path"])

    print(f"profiles={len(slugs)} files={len(files)} archive={archive}")

if __name__ == "__main__":
    main()
