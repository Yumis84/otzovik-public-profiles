#!/usr/bin/env python3
"""Manual staging-only delivery adapter. Never schedules or deploys itself."""
import argparse,hashlib,importlib.util,json,mimetypes,os,pathlib,subprocess,sys,tempfile,urllib.error,urllib.request,uuid
ORIGIN='https://salmcnhexlftrgtiryyo.supabase.co'
BUCKET='company-publication-artifacts-staging'
ROUTE=ORIGIN+'/functions/v1/company-public-profile/'
LIMIT=5242880

def load_module(name):
 s=importlib.util.spec_from_file_location(name,pathlib.Path(__file__).with_name(name));m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

class StagingPublisher:
 def __init__(self,key,transport=None):
  if not key:raise ValueError('staging service key required')
  self.key=key;self.transport=transport or self.http;self.worker=load_module('company-publication-worker.py');self.media=load_module('company-publication-media.py')
 def http(self,url,method,headers,data):
  if not url.startswith(ORIGIN+'/'):raise ValueError('non-staging request denied')
  class NoRedirect(urllib.request.HTTPRedirectHandler):
   def redirect_request(self,*args,**kwargs):raise ValueError('redirect denied')
  req=urllib.request.Request(url,method=method,headers=headers,data=data)
  try:
   with urllib.request.build_opener(NoRedirect).open(req,timeout=30) as r:return r.status,r.read(LIMIT+1)
  except urllib.error.HTTPError as e:return e.code,b''
 def request(self,url,method='GET',data=None,mime=None,auth=True):
  if not url.startswith(ORIGIN+'/'):raise ValueError('non-staging request denied')
  headers={'apikey':self.key,'Authorization':'Bearer '+self.key} if auth else {}
  if mime:headers['Content-Type']=mime
  if method=='POST' and '/storage/' in url:headers['x-upsert']='false'
  status,body=self.transport(url,method,headers,data)
  if len(body)>LIMIT:raise ValueError('oversize response')
  return status,body
 def rpc(self,name,args):
  status,body=self.request(ORIGIN+'/rest/v1/rpc/'+name,'POST',json.dumps(args).encode(),'application/json')
  if status!=200:raise ValueError('staging RPC failed: '+name)
  return json.loads(body)
 def run_once(self,renderer=None):
  status,body=self.request(ROUTE+'health',auth=False)
  if status!=200 or json.loads(body)!={'project_id':'salmcnhexlftrgtiryyo','protocol':'company-publication-v1'}:raise ValueError('staging route is not ready')
  run=str(uuid.uuid4());job=self.rpc('company_publish_worker_claim',{'p_run':run})
  if job is None:return None
  attempt=str(uuid.UUID(job['id']));identity={'p_attempt':attempt,'p_run':run}
  try:
   snapshot=job['snapshot'];self.worker.validate_snapshot(snapshot)
   if str(uuid.UUID(snapshot['id']))!=job['company_id'] or snapshot['slug']!=job['slug'] or len(snapshot['media'])>20:raise ValueError('invalid job scope')
   def heartbeat():
    if self.rpc('company_publish_worker_heartbeat',identity) is not True:raise ValueError('lease lost')
   with tempfile.TemporaryDirectory(prefix='otzovik-company-staging-') as t:
    root=pathlib.Path(t);payload=json.loads(json.dumps(snapshot))
    def fetch_image(obj):
     heartbeat();status,body=self.request(ORIGIN+'/storage/v1/object/authenticated/company-media/'+obj)
     if status!=200:raise ValueError('source image unavailable')
     return body
    if payload['media']:self.media.export_media(payload,root/'media',fetch=fetch_image)
    src=root/'input.json';src.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    heartbeat();subprocess.run([sys.executable,str(renderer or pathlib.Path(__file__).with_name('render-profile.py')),'--slug',payload['slug'],'--data',str(src),'--output',str(root/'render')],check=True,capture_output=True)
    artifact=root/'render'/payload['slug']
    if (root/'media').exists():(root/'media').rename(artifact/'media')
    if json.loads((artifact/'profile.json').read_text(encoding='utf-8'))!=payload:raise ValueError('rendered identity mismatch')
    manifest=self.worker.manifest(artifact);digest=self.worker.digest(manifest)
    for name,expected in manifest.items():
     heartbeat();raw=(artifact/name).read_bytes()
     if len(raw)>LIMIT:raise ValueError('artifact too large')
     object_name=job['company_id']+'/'+digest+'/'+name
     upload=ORIGIN+'/storage/v1/object/'+BUCKET+'/'+object_name
     mime={'.html':'text/html','.css':'text/css','.json':'application/json','.md':'text/plain','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[pathlib.Path(name).suffix]
     status,_=self.request(upload,'POST',raw,mime)
     if status not in (200,201,400,409):raise ValueError('artifact upload failed')
     status,readback=self.request(ORIGIN+'/storage/v1/object/authenticated/'+BUCKET+'/'+object_name)
     if status!=200 or hashlib.sha256(readback).hexdigest()!=expected:raise ValueError('artifact readback mismatch')
    registered=self.rpc('company_publish_worker_register',dict(identity,p_manifest=manifest,p_digest=digest))
    if registered is not True:raise ValueError('registration denied')
    # Same public route used by the cabinet, without service credentials.
    status,public=self.request(ROUTE+job['slug']+'/',auth=False)
    if status!=200 or hashlib.sha256(public).hexdigest()!=manifest['index.html']:raise ValueError('public delivery verification failed')
    return {'attempt_id':attempt,'revision':digest,'public_url':ROUTE+job['slug']+'/','status':'published'}
  except Exception:
   self.rpc('company_publish_worker_fail',identity)
   raise

def main():
 p=argparse.ArgumentParser(description=__doc__);p.parse_args()
 publisher=StagingPublisher(os.environ.get('OTZOVIK_STAGING_SERVICE_KEY'))
 try:print(json.dumps(publisher.run_once()))
 except Exception:raise SystemExit('Staging publication failed; inspect private operator diagnostics')

if __name__=='__main__':main()
