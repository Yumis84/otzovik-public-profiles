#!/usr/bin/env python3
import argparse, json, pathlib, re, subprocess

ALLOWED_EXT={".jpg",".jpeg",".png",".webp"}
OBJECT_RE=re.compile(r"^[0-9a-f-]{36}/[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--data",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--base-url",required=True)
    ap.add_argument("--key",required=True)
    a=ap.parse_args()
    p=pathlib.Path(a.data)
    d=json.loads(p.read_text(encoding="utf-8"))
    out=pathlib.Path(a.out)
    out.mkdir(parents=True,exist_ok=True)
    for old in out.iterdir():
        if old.is_file(): old.unlink()
    for i,m in enumerate(d.get("media") or []):
        obj=m.get("object_name")
        if not isinstance(obj,str) or not OBJECT_RE.fullmatch(obj): continue
        ext=pathlib.Path(obj).suffix.lower()
        if ext not in ALLOWED_EXT: continue
        kind=re.sub(r"[^A-Za-z0-9_-]","-",str(m.get("type") or "image"))
        name=f"{i:02d}-{kind}{ext}"
        url=f"{a.base_url.rstrip('/')}/storage/v1/object/authenticated/company-media/{obj}"
        subprocess.run(["curl","--fail","--silent","--show-error","--proto","=https","--tlsv1.2","--max-time","30","--max-filesize","5242880","-H",f"apikey: {a.key}","-H",f"Authorization: Bearer {a.key}",url,"-o",str(out/name)],check=True)
        m["url"]="media/"+name
    p.write_text(json.dumps(d,ensure_ascii=False),encoding="utf-8")

if __name__=="__main__":
    main()
