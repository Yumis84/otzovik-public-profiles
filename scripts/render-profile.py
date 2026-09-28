#!/usr/bin/env python3
import argparse, json, html, re
from pathlib import Path

def esc(v):
    return html.escape(str(v or ""))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--data", required=True)
    p.add_argument("--output", default="profiles")
    a=p.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}", a.slug):
        raise SystemExit("invalid slug")
    data=json.loads(Path(a.data).read_text(encoding="utf-8"))
    name=data.get("name")
    if not isinstance(name,str) or not name.strip(): raise SystemExit("profile.name is required")
    payload_slug=data.get("slug")
    if payload_slug != a.slug: raise SystemExit("profile.slug does not match requested slug")
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
            "review_count": x.get("review_count") if x.get("review_count") is not None else latest.get("review_count"),
            "url": x.get("url") or x.get("source_url") or "",
            "checked_at": x.get("checked_at") or latest.get("checked_at") or ""
        })
    city=(data.get("location") or {}).get("city","") if isinstance(data.get("location"),dict) else ""
    city=city or data.get("city","")
    website=data.get("official_website") or data.get("website") or ""
    if not (isinstance(website,str) and website.startswith(("https://","http://"))): website=""
    service_html="".join(f"<span class='chip'>{esc(x)}</span>" for x in services) or "<p class='muted'>Услуги пока не опубликованы.</p>"
    def render_rating(x):
        score=esc(x.get("rating") if x.get("rating") is not None else "—")
        meta=(esc(x.get("rating_count") or 0)+" оценок · "+esc(x.get("review_count") or 0)+" отзывов") if x.get("rating") is not None else "Рейтинг пока не получен"
        checked=f"<small class='muted source-check'>Проверено: {esc(x.get('checked_at'))}</small>" if x.get("checked_at") else ""
        link=f"<a class='source-link' href='{esc(x.get('url'))}' target='_blank' rel='noopener nofollow'>Открыть источник ↗</a>" if isinstance(x.get("url"),str) and x.get("url").startswith("https://") else ""
        return f"<article class='card source-card'><div class='label'>{esc(x.get('source'))}</div><div class='rating'>{score}</div><div class='muted'>{meta}</div>{checked}{link}</article>"
    rating_html="".join(render_rating(x) for x in ratings) or "<p class='muted'>Источники рейтинга пока не подключены.</p>"
    raw_locations=data.get("locations") or []
    def render_location(i,x):
        title=esc(x.get("name") or x.get("address") or x.get("city") or "Филиал")
        address=f"<p>{esc(x.get('address'))}</p>" if x.get("address") else ""
        phone=f"<p><a href=\"tel:{esc(x.get('phone'))}\">{esc(x.get('phone'))}</a></p>" if x.get("phone") else ""
        hours=x.get("hours") or x.get("working_hours") or x.get("schedule") or ""
        if isinstance(hours,dict): hours=hours.get("text") or hours.get("label") or ""
        hours_html=f"<p><span class='muted'>Часы:</span> {esc(hours)}</p>" if hours else ""
        route=x.get("route_url") or x.get("map_url") or ""
        route_html=f"<a class='source-link' href='{esc(route)}' target='_blank' rel='noopener nofollow'>Построить маршрут ↗</a>" if isinstance(route,str) and route.startswith("https://") else ""
        return f"<article class='card location-card'><span class='location-number'>{i:02d}</span><strong>{title}</strong>{address}{phone}{hours_html}<span class='muted'>{esc(x.get('city') or '')}</span>{route_html}</article>"
    location_html="".join(render_location(i,x) for i,x in enumerate((x for x in raw_locations if isinstance(x,dict)),1)) or "<p class='muted'>Филиалы пока не опубликованы.</p>"
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
    legal_name=data.get("legal_name") or ""
    same_as=[x.get("url") for x in (data.get("sources") or []) if isinstance(x,dict) and isinstance(x.get("url"),str) and x.get("url").startswith("https://")]
    schema={"@context":"https://schema.org","@type":"Organization","name":name,"url":website or canonical}
    if legal_name: schema["legalName"]=legal_name
    if description: schema["description"]=description
    if city: schema["areaServed"]={"@type":"City","name":city}
    if services: schema["knowsAbout"]=services
    if same_as: schema["sameAs"]=same_as
    logo_media=next((src for x,src in public_media if str(x.get("type") or "").lower()=="logo"),None)
    cover_media=next((src for x,src in public_media if str(x.get("type") or "").lower()=="cover"),None)
    def absolute_media(src):
        if not src: return ""
        if src.startswith("https://"): return src
        if re.fullmatch(r"media/[A-Za-z0-9._-]+",src): return canonical+src
        return ""
    schema_logo=absolute_media(logo_media)
    schema_image=absolute_media(cover_media or (public_media[0][1] if public_media else ""))
    if schema_logo: schema["logo"]=schema_logo
    if schema_image: schema["image"]=schema_image
    schema_json=json.dumps(schema,ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
    native_html=f"<article class='card'><div class='label'>Отзыв.com</div><div class='rating'>{esc(native_rating if native_rating is not None else '—')}</div><div class='muted'>{esc(native_count)} опубликованных отзывов</div></article>"
    def render_review(x):
        response=x.get("company_response") or x.get("response")
        if isinstance(response,dict): response=response.get("text") or response.get("body")
        response_html=f"<div class='company-response'><strong>Ответ компании</strong><p>{esc(response)}</p></div>" if response else ""
        author=esc(x.get("author_display_name") or x.get("author_name") or "Пользователь")
        try: rating=max(0,min(5,int(x.get("rating") or 0)))
        except (TypeError,ValueError): rating=0
        return f"<article class='review'><div class='review-head'><strong>{author}</strong><div class='stars'>{'★' * rating}</div></div><p>{esc(x.get('text') or x.get('body') or '')}</p>{response_html}</article>"
    review_html="".join(render_review(x) for x in reviews) or "<p class='muted'>Собственных опубликованных отзывов пока нет.</p>"
    media_html="".join(f"<figure class='media-card'><button class='media-open' type='button' data-media-src='{esc(src)}' aria-label='Открыть фотографию'><img src='{esc(src)}' alt='{esc(x.get('alt') or x.get('caption') or name)}' loading='lazy'></button><figcaption><span class='media-type'>{esc(x.get('type') or 'photo')}</span>{esc(x.get('caption') or '')}</figcaption></figure>" for x,src in public_media)
    if not media_html:
        media_html="<p class='muted'>Фотографии подготовлены владельцем, но публичные изображения пока не опубликованы.</p>"
    doc=f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{esc(description[:160])}"><meta name="theme-color" content="#101828"><link rel="canonical" href="{canonical}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(name)} — отзывы и информация о компании"><meta property="og:description" content="{esc(description[:160])}"><meta property="og:url" content="{canonical}">{('<meta property=\"og:image\" content=\"'+esc(schema_image)+'\">') if schema_image else ''}
<title>{esc(name)} — отзывы, филиалы и услуги{(' в '+esc(city)) if city else ''} | Отзыв.com</title><link rel="icon" href="https://xn--b1ajuq0c.com/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="profile.css"><script type="application/ld+json">{schema_json}</script></head>
<body><header class="top"><a class="brand" href="https://xn--b1ajuq0c.com/" aria-label="Отзыв.com — главная">отзыв<span>.com</span></a></header>
<nav class="nav" aria-label="Разделы профиля"><a href="#overview">Обзор</a><a href="#ratings">Рейтинги</a><a href="#media">Фото</a><a href="#reviews">Отзывы</a><a href="#locations">Филиалы</a><a href="#services">Услуги</a><a href="#about">О компании</a><a href="#ai">Для AI</a><a href="#freshness">Актуальность</a></nav>
<main>
<section id="overview" class="hero"><div><nav class="crumbs" aria-label="Хлебные крошки">Компании{(' / '+esc(city)) if city else ''}</nav><span class="eyebrow">НЕЗАВИСИМЫЙ ПРОФИЛЬ КОМПАНИИ · {esc(status).upper()}</span><h1>{esc(name)}</h1><p class="lead">{esc(description)}</p><div class="meta"><span>{esc(city)}</span><span>{len(raw_locations)} филиалов</span><span>{len(services)} услуг</span><span>Общий рейтинг не рассчитывается</span></div><div class="hero-actions"><a class="button" href="#reviews">Отзывы</a><a class="button secondary" href="#locations">Выбрать филиал</a>{f'<a class="button secondary" href="{esc(website)}" target="_blank" rel="noopener nofollow">Официальный сайт ↗</a>' if website else ''}</div></div></section>
<section id="ratings"><div class="head"><span class="eyebrow">ИСТОЧНИКИ</span><h2>Рейтинги на площадках</h2><p class="muted">Каждая площадка показана отдельно. Отзыв.com не складывает оценки разных источников в искусственный средний балл.</p></div><div class="grid">{native_html}{rating_html}</div></section>
<section id="media"><div class="head"><span class="eyebrow">МЕДИА</span><h2>Фото компании</h2></div><div class="media-grid">{media_html}</div>{'<p class="muted">Опубликовано изображений: '+str(len(public_media))+'.</p>' if public_media else ''}</section>
<section id="reviews"><div class="head"><span class="eyebrow">ОТЗЫВ.COM</span><h2>Отзывы пользователей</h2><p class="muted">Собственные отзывы публикуются отдельно от внешних рейтингов и проходят модерацию.</p></div><div class="reviews">{review_html}</div><div class="policy-grid"><article><strong>Проверка перед публикацией</strong><p>Новые отзывы проходят модерацию.</p></article><article><strong>Ответ компании</strong><p>Ответ подтверждённого представителя отображается отдельно.</p></article><article><strong>Жалоба и исправление</strong><p>Решения модерации не изменяют исходный текст автора незаметно.</p></article></div></section>
<section id="locations"><div class="head"><span class="eyebrow">АДРЕСА</span><h2>Филиалы</h2></div><div class="grid">{location_html}</div></section>
<section id="services"><div class="head"><span class="eyebrow">НАПРАВЛЕНИЯ</span><h2>Услуги</h2></div><div class="chips">{service_html}</div></section>
<section id="about"><div class="head"><span class="eyebrow">КОМПАНИЯ</span><h2>О компании</h2></div><p>{esc(description)}</p>{f'<p><a class="button" href="{esc(website)}" rel="nofollow noopener">Официальный сайт ↗</a></p>' if website else ''}</section>
<section id="freshness"><div class="head"><span class="eyebrow">АКТУАЛЬНОСТЬ</span><h2>Состояние данных</h2></div><p>Последнее изменение профиля: <strong>{esc(updated_at or 'не указано')}</strong></p></section>
<section id="ai" class="ai"><span class="eyebrow">AI / MACHINE READABLE</span><h2>Данные для нейросетей</h2><p>Структурированные сведения этого профиля доступны в JSON, Markdown и llms.txt.</p><div class="links"><a href="profile.json">JSON</a><a href="profile.md">Markdown</a><a href="llms.txt">llms.txt</a></div></section>
</main><dialog id="media-lightbox" class="media-lightbox" aria-label="Просмотр фотографий компании"><button type="button" class="lightbox-close" aria-label="Закрыть">×</button><button type="button" class="lightbox-prev" aria-label="Предыдущее фото">‹</button><img alt=""><button type="button" class="lightbox-next" aria-label="Следующее фото">›</button></dialog><footer><strong>{esc(name)}</strong><span> · публичный профиль на Отзыв.com</span></footer>
<script>
(()=>{{const lb=document.getElementById('media-lightbox'),lbImg=lb.querySelector('img'),media=[...document.querySelectorAll('.media-open')];let mediaIndex=0;const showMedia=i=>{{if(!media.length)return;mediaIndex=(i+media.length)%media.length;const item=media[mediaIndex];lbImg.src=item.dataset.mediaSrc;lbImg.alt=item.querySelector('img')?.alt||'Фотография компании'}};media.forEach((b,i)=>b.addEventListener('click',()=>{{showMedia(i);lb.showModal()}}));lb.querySelector('.lightbox-close').addEventListener('click',()=>lb.close());lb.querySelector('.lightbox-prev').addEventListener('click',()=>showMedia(mediaIndex-1));lb.querySelector('.lightbox-next').addEventListener('click',()=>showMedia(mediaIndex+1));lb.addEventListener('click',e=>{{if(e.target===lb)lb.close()}});document.addEventListener('keydown',e=>{{if(!lb.open)return;if(e.key==='ArrowLeft')showMedia(mediaIndex-1);if(e.key==='ArrowRight')showMedia(mediaIndex+1)}});const nav=document.querySelector('.nav');const links=[...nav.querySelectorAll('a[href^="#"]')];const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
function center(a){{const left=a.offsetLeft-(nav.clientWidth-a.offsetWidth)/2;nav.scrollTo({{left:Math.max(0,left),behavior:'smooth'}})}}
function activate(id){{links.forEach(a=>{{const on=a.getAttribute('href')==='#'+id;a.classList.toggle('active',on);if(on){{a.setAttribute('aria-current','true');center(a)}}else a.removeAttribute('aria-current')}})}}
const io=new IntersectionObserver(es=>{{const hit=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(hit)activate(hit.target.id)}},{{rootMargin:'-25% 0px -60% 0px',threshold:[0,.1,.5]}});
sections.forEach(s=>io.observe(s));links.forEach(a=>a.addEventListener('click',()=>activate(a.getAttribute('href').slice(1))));if(sections[0])activate(sections[0].id);
}})();
</script></body></html>"""
    (out/"index.html").write_text(doc,encoding="utf-8")
    (out/"profile.css").write_text("""*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f6f6f3;color:#111;font:16px/1.5 system-ui,-apple-system,sans-serif}.top{height:64px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:flex-start;padding:0 max(20px,calc((100% - 1120px)/2));position:sticky;top:0;z-index:5}.brand,.brand:visited,.brand:hover,.brand:active{font-size:22px;line-height:1;font-weight:800;letter-spacing:-.04em;text-decoration:none;color:#101828}.brand span{font-weight:400;color:#667085}.nav{background:#fff;border-bottom:1px solid #ddd;display:flex;gap:26px;overflow-x:auto;overflow-y:hidden;padding:13px max(20px,calc((100% - 1120px)/2));position:sticky;top:64px;z-index:4;scrollbar-width:none;-ms-overflow-style:none}.nav::-webkit-scrollbar{display:none}.nav a,.links a{color:#111;text-decoration:none;white-space:nowrap}.nav a{position:relative}.nav a.active{font-weight:750}.nav a.active:after{content:"";position:absolute;left:0;right:0;bottom:-13px;height:2px;background:#111}main,footer{max-width:1120px;margin:auto;padding:0 20px}.hero{padding:70px 0 54px}.hero h1{font-size:clamp(38px,7vw,72px);line-height:1;margin:14px 0 20px}.lead{font-size:20px;max-width:760px;color:#444}.crumbs{font-size:13px;color:#777;margin-bottom:22px}.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em}.meta,.chips,.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.meta span,.chip,.links a{background:#fff;border:1px solid #d8d8d2;border-radius:999px;padding:8px 13px}section{padding:46px 0;border-top:1px solid #d8d8d2}.head h2{font-size:34px;margin:7px 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card,.review,.media-card{background:#fff;border:1px solid #ddd;border-radius:16px;padding:20px}.card p{margin:8px 0}.location-card{position:relative;padding-top:46px}.location-number{position:absolute;top:16px;right:18px;font-size:12px;font-weight:800;color:#888}.policy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px}.policy-grid article{background:#fff;border:1px solid #ddd;border-radius:14px;padding:18px}.policy-grid p{color:#686868;margin-bottom:0}.label,.muted{color:#686868}.source-check{display:block;margin-top:12px}.source-link{display:inline-block;margin-top:12px;color:#111;font-weight:700;text-underline-offset:3px}.rating{font-size:36px;font-weight:800;margin:8px 0}.stars{font-size:20px;letter-spacing:2px}.reviews{display:grid;gap:12px}.media-type{text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.1em;margin-right:8px}.media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.media-card{margin:0;overflow:hidden}.media-open{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}.media-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}.media-lightbox{width:min(94vw,1200px);height:min(92vh,900px);padding:0;border:0;border-radius:16px;background:#111;overflow:hidden}.media-lightbox::backdrop{background:rgba(0,0,0,.82)}.media-lightbox[open]{display:flex;align-items:center;justify-content:center}.media-lightbox img{max-width:100%;max-height:100%;object-fit:contain}.lightbox-close{position:absolute;top:12px;right:12px;width:42px;height:42px;border:0;border-radius:50%;background:#fff;color:#111;font-size:26px;cursor:pointer}.lightbox-prev,.lightbox-next{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:54px;border:0;border-radius:12px;background:rgba(255,255,255,.9);color:#111;font-size:34px;cursor:pointer}.lightbox-prev{left:12px}.lightbox-next{right:12px}.company-response{margin-top:14px;padding:14px;border-left:3px solid #111;background:#f6f6f3}.company-response p{margin:5px 0 0}.review-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.media-card figcaption{padding-top:10px}.button{display:inline-block;background:#111;color:#fff;text-decoration:none;border:1px solid #111;border-radius:10px;padding:11px 16px}.button.secondary{background:#fff;color:#111}.ai{background:#111;color:#fff;border-radius:20px;padding:30px;margin-top:30px}.ai .links a{background:#222;border-color:#444;color:#fff}footer{padding:34px 20px 60px;color:#666}@media(max-width:600px){.top{height:56px}.brand,.brand:visited,.brand:hover,.brand:active{font-size:22px}.nav{top:56px}.hero{padding-top:48px}.head h2{font-size:28px}}""",encoding="utf-8")
    (out/"profile.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    md=[f"# {name}","",description,"",f"- Slug: {a.slug}",f"- Город: {city or 'не указан'}",f"- Юридическое наименование: {legal_name or 'не указано'}",f"- Официальный сайт: {website or 'не указан'}",f"- Статус профиля: {status}",f"- Последнее изменение: {updated_at or 'не указано'}","",f"## Филиалы ({len(raw_locations)})"]
    md += [f"- {x.get('name') or x.get('address') or 'Филиал'} — {x.get('address') or ''}, {x.get('city') or city}".rstrip(" ,") for x in raw_locations if isinstance(x,dict)]
    md += ["",f"## Услуги ({len(services)})", *[f"- {x}" for x in services], "", "## Рейтинги", f"- Отзыв.com: {native_rating if native_rating is not None else 'нет опубликованного рейтинга'}; отзывов: {native_count}"]
    md += [f"- {x.get('source')}: {x.get('rating') if x.get('rating') is not None else 'рейтинг пока не получен'}; оценок: {x.get('rating_count') or 0}; отзывов: {x.get('review_count') or 0}" for x in ratings]
    md += ["",f"## Собственные отзывы ({len(reviews)})","",f"## Публичные изображения ({len(public_media)})","",f"Canonical: {canonical}"]
    (out/"profile.md").write_text("\n".join(md)+"\n",encoding="utf-8")
    ll=[f"# {name}",f"url: {canonical}",f"slug: {a.slug}",f"city: {city}",f"profile_status: {status}",f"updated_at: {updated_at}",f"locations_count: {len(raw_locations)}",f"services_count: {len(services)}",f"rating_sources_count: {len(ratings)}",f"native_reviews_count: {native_count}",f"public_media_count: {len(public_media)}","","Machine-readable canonical company profile. Ratings from different external sources are not averaged into one score.","JSON: profile.json","Markdown: profile.md"]
    (out/"llms.txt").write_text("\n".join(ll)+"\n",encoding="utf-8")

if __name__=="__main__": main()
