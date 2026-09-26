#!/usr/bin/env python3
import argparse, json, html
from pathlib import Path

def esc(v):
    return html.escape(str(v or ""))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--data", required=True)
    p.add_argument("--output", default="profiles")
    a=p.parse_args()
    if not a.slug or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in a.slug):
        raise SystemExit("invalid slug")
    data=json.loads(Path(a.data).read_text(encoding="utf-8"))
    name=data.get("name")
    if not name: raise SystemExit("profile.name is required")
    out=Path(a.output)/a.slug
    out.mkdir(parents=True,exist_ok=True)
    raw_services=data.get("services") or []
    services=[x.get("name","") if isinstance(x,dict) else str(x) for x in raw_services]
    services=[x for x in services if x]
    raw_ratings=data.get("ratings_by_source")
    if raw_ratings is None:
        raw_ratings=data.get("sources") or []
    ratings=[]
    for x in raw_ratings:
        if not isinstance(x,dict):
            continue
        latest=x.get("latest_rating") if isinstance(x.get("latest_rating"),dict) else {}
        ratings.append({
            "source": x.get("source") or x.get("name") or "",
            "rating": x.get("rating") if x.get("rating") is not None else latest.get("rating"),
            "rating_count": x.get("rating_count") if x.get("rating_count") is not None else latest.get("rating_count"),
            "review_count": x.get("review_count") if x.get("review_count") is not None else latest.get("review_count")
        })
    city=(data.get("location") or {}).get("city","") if isinstance(data.get("location"),dict) else ""
    city=city or data.get("city","")
    website=data.get("official_website") or data.get("website") or ""
    service_html="".join(f"<li>{esc(x)}</li>" for x in services)
    rating_html="".join(f"<li><strong>{esc(x.get('source'))}</strong>: {esc(x.get('rating') if x.get('rating') is not None else 'нет данных')}</li>" for x in ratings)
    doc=f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(name)} — Отзыв.com</title><link rel="stylesheet" href="profile.css"></head>
<body><main><header><a href="https://xn--b1ajuq0c.com/">Отзыв.com</a><h1>{esc(name)}</h1><p>{esc(city)}</p></header>
<section><h2>Рейтинги</h2><ul>{rating_html}</ul></section>
<section><h2>Услуги</h2><ul>{service_html}</ul></section>
<section><h2>О компании</h2><p>{esc(data.get('description',''))}</p>{f'<p><a href="{esc(website)}">Официальный сайт</a></p>' if website else ''}</section>
<footer><p>Публичный профиль компании на Отзыв.com</p></footer></main></body></html>"""
    (out/"index.html").write_text(doc,encoding="utf-8")
    (out/"profile.css").write_text("body{font-family:system-ui,sans-serif;max-width:920px;margin:auto;padding:24px;line-height:1.5}a{color:inherit}section{border-top:1px solid #ddd;padding:20px 0}h1{font-size:2rem}li{margin:.45rem 0}",encoding="utf-8")
    (out/"profile.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    md=[f"# {name}", "", f"Город: {city}", "", "## Услуги", *[f"- {x}" for x in services], "", "## Рейтинги", *[f"- {x.get('source')}: {x.get('rating') if x.get('rating') is not None else 'нет данных'}" for x in ratings]]
    (out/"profile.md").write_text("\n".join(md)+"\n",encoding="utf-8")
    ll=[f"# {name}", f"slug: {a.slug}", f"city: {city}", f"services_count: {len(services)}", f"rating_sources_count: {len(ratings)}"]
    (out/"llms.txt").write_text("\n".join(ll)+"\n",encoding="utf-8")

if __name__=="__main__": main()
