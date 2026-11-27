#!/usr/bin/env python3
"""Disposable/local integration worker. It cannot connect to a hosted database."""
import argparse, hashlib, importlib.util, json, os, pathlib, re, shutil, subprocess, sys, tempfile, uuid

REQUIRED={'index.html','profile.css','profile.json','profile.md','llms.txt'}
FIELDS={'sources':list,'reviews':list,'questions_answers':list,'native_rating':dict,'locations':list,'services':list,'media':list}

def literal(value):
    return "convert_from(decode('"+json.dumps(value,ensure_ascii=False).encode().hex()+"','hex'),'UTF8')::jsonb"

def validate_snapshot(d):
    if not isinstance(d,dict) or any(not isinstance(d.get(k),t) for k,t in FIELDS.items()): raise ValueError('incomplete snapshot')
    uuid.UUID(d['id'])
    if not re.fullmatch('[a-z0-9][a-z0-9-]{0,62}',d['slug']): raise ValueError('invalid slug')
    n=d['native_rating']
    if 'rating' not in n or type(n.get('review_count')) is not int or n['review_count']<0: raise ValueError('incomplete native rating')

def manifest(root):
    if root.is_symlink() or any(p.is_symlink() for p in root.rglob('*')): raise ValueError('symlink')
    m={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
    if not REQUIRED<=m.keys() or any(not (root/p).stat().st_size for p in REQUIRED): raise ValueError('incomplete artifact')
    if any(not re.fullmatch(r'(index\.html|profile\.(css|json|md)|llms\.txt|media/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp))',p) for p in m): raise ValueError('unexpected artifact')
    return m

def digest(m):
    return hashlib.sha256('\n'.join(k+':'+m[k] for k in sorted(m)).encode()).hexdigest()

def resolve_local(db,root,slug):
    if not re.fullmatch('[a-z0-9][a-z0-9-]{0,62}',slug): return None
    raw=db.query("SELECT private.resolve_company_artifact_candidate('"+slug+"');")
    if not raw: return None
    item=json.loads(raw);rev=item['revision']
    if not re.fullmatch('[0-9a-f]{64}',rev): raise ValueError('invalid artifact revision')
    directory=pathlib.Path(root)/rev;m=manifest(directory)
    if m!=item['manifest'] or digest(m)!=rev: raise ValueError('stored artifact corrupted')
    data=json.loads((directory/'profile.json').read_text(encoding='utf-8'))
    if data['id']!=item['company_id'] or data['slug']!=slug: raise ValueError('artifact identity mismatch')
    return directory

class Database:
    def __init__(self,psql,port,name):
        if not re.fullmatch('[a-z][a-z0-9_]*',name): raise ValueError('invalid local database')
        self.args=[psql,'-h','127.0.0.1','-p',str(int(port)),'-U','postgres','-d',name,'-X','-qAt','-v','ON_ERROR_STOP=1']
    def query(self,sql):
        # stdin keeps snapshots and credentials out of process arguments.
        p=subprocess.run(self.args,input=sql,encoding='utf-8',errors='replace',env=dict(os.environ,PGCLIENTENCODING='UTF8'),capture_output=True,check=True)
        return p.stdout.strip()

def run_one(db,root,renderer,media_exporter=None,before_register=None):
    run=str(uuid.uuid4())
    raw=db.query("SELECT private.claim_publish_candidate('"+run+"');")
    if not raw: return None
    job=json.loads(raw); attempt=str(uuid.UUID(job['id'])); d=job['snapshot']
    try:
        validate_snapshot(d)
        if str(uuid.UUID(d['id']))!=job['company_id'] or d['slug']!=job['slug']: raise ValueError('job identity mismatch')
        root=pathlib.Path(root); root.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root) as tmp:
            tmp=pathlib.Path(tmp); payload=json.loads(json.dumps(d))
            if payload['media']:
                if media_exporter is None: raise ValueError('media exporter required')
                media_exporter(payload,tmp/'media')
            if any('object_name' in m for m in payload['media']): raise ValueError('private storage path')
            src=tmp/'input.json'; src.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
            subprocess.run([sys.executable,str(renderer),'--slug',job['slug'],'--data',str(src),'--output',str(tmp/'render')],check=True,capture_output=True)
            bundle=tmp/'render'/job['slug']
            if (tmp/'media').exists(): shutil.move(str(tmp/'media'),str(bundle/'media'))
            if json.loads((bundle/'profile.json').read_text(encoding='utf-8'))!=payload: raise ValueError('renderer payload mismatch')
            m=manifest(bundle); rev=digest(m)
            dest=root/rev
            if dest.exists():
                if manifest(dest)!=m: raise ValueError('existing revision corrupted')
            else: bundle.rename(dest)
            if before_register: before_register(dest,job)
            if manifest(dest)!=m: raise ValueError('artifact changed during build')
            sql="BEGIN; SET LOCAL lock_timeout='3s'; INSERT INTO private.company_publish_artifact_candidate(attempt_id,run_id,digest,manifest) VALUES('"+attempt+"','"+run+"','"+rev+"',"+literal(m)+"); DO $final$ BEGIN IF NOT private.transition_publish_candidate('"+attempt+"','"+run+"','published','"+rev+"') THEN RAISE EXCEPTION 'finalization rejected'; END IF; END $final$; SELECT true; COMMIT;"
            if db.query(sql).splitlines()[-1]!='t': raise ValueError('finalization rejected')
            return {'attempt_id':attempt,'revision':rev,'directory':str(dest),'manifest':m}
    except Exception:
        db.query("SELECT private.transition_publish_candidate('"+attempt+"','"+run+"','failed',NULL);")
        raise

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--psql',default='psql'); p.add_argument('--port',type=int,default=55487); p.add_argument('--database',required=True); p.add_argument('--output',required=True)
    a=p.parse_args()
    spec=importlib.util.spec_from_file_location('media_export',pathlib.Path(__file__).with_name('company-publication-media.py')); media=importlib.util.module_from_spec(spec);spec.loader.exec_module(media)
    print(json.dumps(run_one(Database(a.psql,a.port,a.database),a.output,pathlib.Path(__file__).with_name('render-profile.py'),lambda d,o:media.export_media(d,o,key=os.environ.get('OTZOVIK_STAGING_MEDIA_KEY')))))

if __name__=='__main__': main()
