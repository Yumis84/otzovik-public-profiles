import importlib.util,json,pathlib,uuid
root=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('stage',root/'scripts/company-publication-staging.py');stage=importlib.util.module_from_spec(s);s.loader.exec_module(stage)
company='4616c65b-5ebb-4c13-b2ef-24e2bc40d623'
snapshot=dict(id=company,slug='synthetic',name='Synthetic',sources=[],reviews=[],questions_answers=[],native_rating={'rating':None,'review_count':0},locations=[],services=[],media=[])
class Transport:
 def __init__(self,mode='ok'):self.mode=mode;self.objects={};self.registered=False;self.failed=False;self.calls=[]
 def __call__(self,url,method,headers,data):
  self.calls.append(url);assert url.startswith(stage.ORIGIN+'/');assert 'rzhlcszqtuhkhfibygnk' not in url
  if url.endswith('/health'):return 200,json.dumps({'project_id':'salmcnhexlftrgtiryyo','protocol':'company-publication-v1'}).encode()
  if '/rpc/' in url:
   name=url.rsplit('/',1)[-1];p=json.loads(data)
   if name=='company_publish_worker_claim':return 200,json.dumps({'id':str(uuid.uuid4()),'company_id':company,'slug':'synthetic','snapshot':snapshot,'run_id':p['p_run']}).encode()
   if name=='company_publish_worker_heartbeat':return 200,b'true'
   if name=='company_publish_worker_register':self.registered=True;return 200,b'true'
   if name=='company_publish_worker_fail':self.failed=True;return 200,b'true'
  if '/storage/' in url:
   path=url.split(stage.BUCKET+'/')[-1]
   if method=='POST':assert headers['x-upsert']=='false';self.objects[path]=data;return 200,b'{}'
   raw=self.objects[path];return 200,(b'corrupted' if self.mode=='readback' else raw)
  if url==stage.ROUTE+'synthetic/':
   assert 'Authorization' not in headers
   return (503,b'') if self.mode=='route' else (200,next(v for k,v in self.objects.items() if k.endswith('/index.html')))
  raise AssertionError(url)
for mode in ['ok','readback','route']:
 transport=Transport(mode);worker=stage.StagingPublisher('fixture-secret',transport)
 try:result=worker.run_once()
 except ValueError:
  assert mode!='ok' and transport.failed
  if mode=='readback':assert not transport.registered
 else:assert mode=='ok' and result['status']=='published' and transport.registered and not transport.failed
 assert transport.objects
 print('PASS actual renderer + staged transport '+mode+'; immutable uploads/readback/route/failure semantics')
