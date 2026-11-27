import copy,importlib.util,io,json,pathlib,subprocess,sys,tempfile
from PIL import Image,PngImagePlugin
root=pathlib.Path(__file__).resolve().parents[1]
def module(name):
 s=importlib.util.spec_from_file_location(name,root/'scripts'/name);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
w=module('company-publication-worker.py'); media=module('company-publication-media.py')
c='00000000-0000-0000-0000-000000000001'
d=dict(id=c,slug='alpha',name='Synthetic <company>',sources=[dict(name='Scale',rating=8,rating_scale=10,rating_count=None,review_count=0)],native_rating={'rating':None,'review_count':0},reviews=[{'author':'Author','body':'Body','company_response':{'statement':'Official response'}}],questions_answers=[{'question':'Q','answer':'A','program_label':'Program'}],locations=[],services=[],media=[])
with tempfile.TemporaryDirectory() as t:
 p=pathlib.Path(t);f=p/'input.json';f.write_text(json.dumps(d));subprocess.run([sys.executable,str(root/'scripts/render-profile.py'),'--slug','alpha','--data',str(f),'--output',str(p)],check=True)
 b=p/'alpha'; h=(b/'index.html').read_text();md=(b/'profile.md').read_text()
 assert '8 / 10' in h and 'неизвестно оценок' in h and '0 отзывов' in h and '8 / 10' in md and 'Official response' in h and 'Author' in h and 'Program' in h
 assert 'Synthetic &lt;company&gt;' in h; print('PASS scale10, unknown counts vs zero, canonical author/response/program and escaping')
 m=w.manifest(b);(b/'profile.json').write_text('{}');assert w.manifest(b)!=m; print('PASS manifest detects changed bytes')
 raw=io.BytesIO();meta=PngImagePlugin.PngInfo();meta.add_text('private','SECRET');Image.new('RGB',(8,8)).save(raw,format='PNG',pnginfo=meta)
 d['media']=[{'object_name':c+'/cover/image.png','type':'cover'}];o=p/'media';media.export_media(d,o,fetch=lambda obj:raw.getvalue())
 assert 'object_name' not in d['media'][0] and d['media'][0]['url']=='media/00-image.png';assert 'private' not in Image.open(o/'00-image.png').info; print('PASS real image decode/reencode removes metadata and private object path')
 for obj,blob in [(c+'/cover/../image.png',raw.getvalue()),('00000000-0000-0000-0000-000000000099/cover/image.png',raw.getvalue()),(c+'/cover/image.png',b'not an image')]:
  q=copy.deepcopy(d);q['media']=[{'object_name':obj}]
  try: media.export_media(q,p/str(len(obj)+len(blob)),fetch=lambda obj:blob)
  except (ValueError,OSError):pass
  else:raise AssertionError('unsafe image accepted')
 print('PASS foreign/traversal/corrupt images rejected')
