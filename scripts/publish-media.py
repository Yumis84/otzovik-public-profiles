#!/usr/bin/env python3
import argparse, json, re, shutil
from pathlib import Path
from urllib.parse import urlparse

SAFE_TYPES={"logo","cover","interior","exterior","products","team","gallery"}
SAFE_EXT={".jpg",".jpeg",".png",".webp",".avif"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--slug",required=True)
    p.add_argument("--manifest",required=True)
    p.add_argument("--source-dir",required=True)
    p.add_argument("--output",default="profiles")
    a=p.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}",a.slug):
        raise SystemExit("invalid slug")
    manifest=json.loads(Path(a.manifest).read_text(encoding="utf-8"))
    if not isinstance(manifest,list):
        raise SystemExit("manifest must be an array")
    srcroot=Path(a.source_dir).resolve()
    out=Path(a.output)/a.slug/"media"
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    public=[]
    for i,item in enumerate(manifest):
        if not isinstance(item,dict) or item.get("approved") is not True:
            continue
        typ=str(item.get("type") or "gallery").lower()
        if typ not in SAFE_TYPES: raise SystemExit(f"unsupported media type: {typ}")
        rel=str(item.get("file") or "")
        src=(srcroot/rel).resolve()
        if srcroot not in src.parents or not src.is_file():
            raise SystemExit("invalid media source path")
        ext=src.suffix.lower()
        if ext not in SAFE_EXT: raise SystemExit(f"unsupported extension: {ext}")
        name=f"{i+1:02d}-{typ}{ext}"
        shutil.copy2(src,out/name)
        public.append({"type":typ,"alt":item.get("alt"),"caption":item.get("caption"),"url":f"media/{name}"})
    (Path(a.output)/a.slug/"media.json").write_text(json.dumps(public,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"published {len(public)} approved media files")

if __name__=="__main__": main()
