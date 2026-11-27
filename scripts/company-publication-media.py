"""Fail-closed staging media exporter; never reads production Storage."""
import io, pathlib, re, urllib.request, uuid
from PIL import Image, ImageOps

ORIGIN='https://salmcnhexlftrgtiryyo.supabase.co'
LIMIT=5*1024*1024
FORMATS={'.jpg':'JPEG','.jpeg':'JPEG','.png':'PNG','.webp':'WEBP'}

def export_media(data,out,key=None,fetch=None):
    company=str(uuid.UUID(data['id'])); out=pathlib.Path(out)
    entries=[]
    for i,m in enumerate(data['media']):
        obj=m.get('object_name'); ext=pathlib.PurePosixPath(obj or '').suffix.lower()
        if not isinstance(obj,str) or not re.fullmatch(r'[0-9a-f-]{36}/[a-z_]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)',obj) or obj.split('/')[0]!=company or ext not in FORMATS: raise ValueError('invalid company media path')
        entries.append((m,obj,ext,f'{i:02d}-image{ext}'))
    if fetch is None:
        if not key: raise ValueError('staging media key required')
        def fetch(obj):
            req=urllib.request.Request(ORIGIN+'/storage/v1/object/authenticated/company-media/'+obj,headers={'apikey':key,'Authorization':'Bearer '+key})
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self,*args,**kwargs): raise ValueError('redirect denied')
            with urllib.request.build_opener(NoRedirect).open(req,timeout=30) as r:
                if r.status!=200: raise ValueError('media fetch failed')
                return r.read(LIMIT+1)
    out.mkdir(parents=True,exist_ok=False)
    for m,obj,ext,name in entries:
        raw=fetch(obj)
        if not 0<len(raw)<=LIMIT: raise ValueError('invalid image size')
        with Image.open(io.BytesIO(raw)) as im:
            if im.format!=FORMATS[ext] or not 0<im.width*im.height<=16000000 or getattr(im,'n_frames',1)!=1: raise ValueError('invalid image format')
            im.verify()
        with Image.open(io.BytesIO(raw)) as im:
            im.load(); im=ImageOps.exif_transpose(im)
            mode='RGBA' if ext in ('.png','.webp') and ('A' in im.getbands() or 'transparency' in im.info) else 'RGB'
            clean=Image.new(mode,im.size); clean.paste(im.convert(mode)); clean.save(out/name,format=FORMATS[ext])
        if (out/name).stat().st_size>LIMIT: raise ValueError('sanitized image too large')
        m.pop('object_name'); m['url']='media/'+name
