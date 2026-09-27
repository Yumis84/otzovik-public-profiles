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
    service_html="".join(f"<span class='chip'>{esc(x)}</span>" for x in services) or "<p class='muted'>Услуги пока не опубликованы.</p>"
    rating_html="".join(f"<article class='card'><div class='label'>{esc(x.get('source'))}</div><div class='rating'>{esc(x.get('rating') if x.get('rating') is not None else '—')}</div><div class='muted'>{esc(x.get('rating_count') or 0)} оценок · {esc(x.get('review_count') or 0)} отзывов</div></article>" for x in ratings) or "<p class='muted'>Источники рейтинга пока не подключены.</p>"
    raw_locations=data.get("locations") or []
    location_html="".join(f"<article class='card'><strong>{esc(x.get('name') or x.get('city') or 'Филиал')}</strong><p>{esc(x.get('address') or '')}</p><span class='muted'>{esc(x.get('city') or '')}</span></article>" for x in raw_locations if isinstance(x,dict)) or "<p class='muted'>Филиалы пока не опубликованы.</p>"
    status=data.get("profile_status") or "ready"
    description=data.get("description") or "Публичный профиль компании на Отзыв.com."
    native=data.get("native_rating") if isinstance(data.get("native_rating"),dict) else {}
    native_rating=native.get("rating")
    native_count=native.get("review_count")
    if native_count is None:
        native_count=0
    reviews=[x for x in (data.get("reviews") or []) if isinstance(x,dict)]
    media=[x for x in (data.get("media") or []) if isinstance(x,dict)]
    public_media=[]
    for x in media:
        src=x.get("public_url") or x.get("url")
        if isinstance(src,str) and (src.startswith("https://") or re.fullmatch(r"media/[A-Za-z0-9._-]+",src)):
            public_media.append((x,src))
    updated_at=data.get("updated_at") or ""
    canonical=f"https://{a.slug}.xn--b1ajuq0c.com/"
    native_html=f"<article class='card'><div class='label'>Отзыв.com</div><div class='rating'>{esc(native_rating if native_rating is not None else '—')}</div><div class='muted'>{esc(native_count)} опубликованных отзывов</div></article>"
    review_html="".join(f"<article class='review'><div class='stars'>{'★' * int(x.get('rating') or 0)}</div><p>{esc(x.get('text') or x.get('body') or '')}</p></article>" for x in reviews) or "<p class='muted'>Собственных опубликованных отзывов пока нет.</p>"
    media_html="".join(f"<figure class='media-card'><img src='{esc(src)}' alt='{esc(x.get('alt') or x.get('caption') or name)}' loading='lazy'><figcaption><span class='media-type'>{esc(x.get('type') or 'photo')}</span>{esc(x.get('caption') or '')}</figcaption></figure>" for x,src in public_media)
    if not media_html:
        media_html="<p class='muted'>Фотографии подготовлены владельцем, но публичные изображения пока не опубликованы.</p>"
    doc=f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{esc(description[:160])}"><link rel="canonical" href="{canonical}">
<title>{esc(name)} — профиль компании | Отзыв.com</title><link rel="stylesheet" href="profile.css"></head>
<body><header class="top"><a class="brand" href="https://xn--b1ajuq0c.com/">отзыв<span>.com</span></a><a href="#about">О компании</a></header>
<nav class="nav"><a href="#overview">Обзор</a><a href="#ratings">Рейтинги</a><a href="#media">Фото</a><a href="#reviews">Отзывы</a><a href="#locations">Филиалы</a><a href="#services">Услуги</a><a href="#ai">Для AI</a></nav>
<main>
<section id="overview" class="hero"><div><span class="eyebrow">ПРОФИЛЬ КОМПАНИИ · {esc(status).upper()}</span><h1>{esc(name)}</h1><p class="lead">{esc(description)}</p><div class="meta"><span>{esc(city)}</span><span>{len(raw_locations)} филиалов</span><span>{len(services)} услуг</span></div></div></section>
<section id="ratings"><div class="head"><span class="eyebrow">ИСТОЧНИКИ</span><h2>Рейтинги</h2></div><div class="grid">{native_html}{rating_html}</div></section>
<section id="media"><div class="head"><span class="eyebrow">МЕДИА</span><h2>Фото компании</h2></div><div class="media-grid">{media_html}</div>{'<p class="muted">Опубликовано изображений: '+str(len(public_media))+'.</p>' if public_media else ''}</section>
<section id="reviews"><div class="head"><span class="eyebrow">ОТЗЫВ.COM</span><h2>Отзывы</h2></div><div class="reviews">{review_html}</div></section>
<section id="locations"><div class="head"><span class="eyebrow">АДРЕСА</span><h2>Филиалы</h2></div><div class="grid">{location_html}</div></section>
<section id="services"><div class="head"><span class="eyebrow">НАПРАВЛЕНИЯ</span><h2>Услуги</h2></div><div class="chips">{service_html}</div></section>
<section id="about"><div class="head"><span class="eyebrow">КОМПАНИЯ</span><h2>О компании</h2></div><p>{esc(description)}</p>{f'<p><a class="button" href="{esc(website)}" rel="nofollow noopener">Официальный сайт ↗</a></p>' if website else ''}</section>
<section><div class="head"><span class="eyebrow">АКТУАЛЬНОСТЬ</span><h2>Состояние данных</h2></div><p>Последнее изменение профиля: <strong>{esc(updated_at or 'не указано')}</strong></p></section>
<section id="ai" class="ai"><span class="eyebrow">AI / MACHINE READABLE</span><h2>Данные для нейросетей</h2><p>Структурированные сведения этого профиля доступны в JSON, Markdown и llms.txt.</p><div class="links"><a href="profile.json">JSON</a><a href="profile.md">Markdown</a><a href="llms.txt">llms.txt</a></div></section>
</main><footer><strong>{esc(name)}</strong><span> · публичный профиль на Отзыв.com</span></footer></body></html>"""
    (out/"index.html").write_text(doc,encoding="utf-8")
    (out/"profile.css").write_text("""*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f6f6f3;color:#111;font:16px/1.5 system-ui,-apple-system,sans-serif}.top{height:64px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:space-between;padding:0 max(20px,calc((100% - 1120px)/2));position:sticky;top:0;z-index:5}.brand{font-size:22px;font-weight:800;text-decoration:none}.brand span{font-weight:400}.nav{background:#fff;border-bottom:1px solid #ddd;display:flex;gap:26px;overflow:auto;padding:13px max(20px,calc((100% - 1120px)/2));position:sticky;top:64px;z-index:4}.nav a,.links a{color:#111;text-decoration:none;white-space:nowrap}main,footer{max-width:1120px;margin:auto;padding:0 20px}.hero{padding:70px 0 54px}.hero h1{font-size:clamp(38px,7vw,72px);line-height:1;margin:14px 0 20px}.lead{font-size:20px;max-width:760px;color:#444}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em}.meta,.chips,.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.meta span,.chip,.links a{background:#fff;border:1px solid #d8d8d2;border-radius:999px;padding:8px 13px}section{padding:46px 0;border-top:1px solid #d8d8d2}.head h2{font-size:34px;margin:7px 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card,.review,.media-card{background:#fff;border:1px solid #ddd;border-radius:16px;padding:20px}.card p{margin:8px 0}.label,.muted{color:#686868}.rating{font-size:36px;font-weight:800;margin:8px 0}.stars{font-size:20px;letter-spacing:2px}.reviews{display:grid;gap:12px}.media-type{text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.1em;margin-right:8px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.media-card{margin:0;overflow:hidden}.media-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}.media-card figcaption{padding-top:10px}.button{display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:10px;padding:11px 16px}.ai{background:#111;color:#fff;border-radius:20px;padding:30px;margin-top:30px}.ai .links a{background:#222;border-color:#444;color:#fff}footer{padding:34px 20px 60px;color:#666}@media(max-width:600px){.top{height:56px}.nav{top:56px}.hero{padding-top:48px}.head h2{font-size:28px}}""",encoding="utf-8")
    (out/"profile.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    md=[f"# {name}", "", f"Город: {city}", "", "## Услуги", *[f"- {x}" for x in services], "", "## Рейтинги", *[f"- {x.get('source')}: {x.get('rating') if x.get('rating') is not None else 'нет данных'}" for x in ratings]]
    (out/"profile.md").write_text("\n".join(md)+"\n",encoding="utf-8")
    ll=[f"# {name}", f"slug: {a.slug}", f"city: {city}", f"services_count: {len(services)}", f"rating_sources_count: {len(ratings)}"]
    (out/"llms.txt").write_text("\n".join(ll)+"\n",encoding="utf-8")

if __name__=="__main__": main()
