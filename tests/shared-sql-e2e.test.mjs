import {test} from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';import {createSharedRouter} from '../runtime/shared-router.mjs';
const root=process.env.OTZOVIK_CABINET_ROOT,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s.address().port));});const close=s=>new Promise(resolve=>s.close(resolve));
test('combined ingress with actual candidate SQL and synthetic classifier',{skip:!root},async()=>{
 const base=path.resolve(root),{database,A}=await import(pathToFileURL(path.join(base,'tests/database.mjs')).href);const db=await database({editor:true});let app,upstream;
 try{
  await db.exec("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$; GRANT USAGE ON SCHEMA public,storage TO service_role; DROP TRIGGER specialist_object_integrity ON storage.objects;");
  for(const f of ['release/60_GATEWAY_CANDIDATE.sql','release/65_GATEWAY_REMEDIATION_CANDIDATE.sql','release/66_SPECIALIST_OPERATOR_CANDIDATE.sql','20261106_specialist_publication_foundation_CANDIDATE.sql','20261106_specialist_slug_quarantine_CANDIDATE.sql','20261112_specialist_erasure_barrier_CANDIDATE.sql','20261112_specialist_revision_retention_CANDIDATE.sql','20261112_specialist_publish_CANDIDATE.sql','20261112_specialist_public_getter_CANDIDATE.sql'])await db.exec(await fs.readFile(path.join(base,'sql',f),'utf8'));
  await db.query('UPDATE public.specialist_public_control SET enabled=true');
  const companyId='33333333-3333-4333-8333-333333333334',slug='reuse-company',companyHtml=Buffer.from('<html><h1>Synthetic company</h1></html>');
  await db.query('INSERT INTO public.companies(id,slug,name) VALUES($1,$2,$3)',[companyId,slug,'Synthetic company']);
  const manifest=Buffer.from(JSON.stringify({slug,company_id:companyId,version:1,script_hashes:[],files:{'index.html':{sha256:hash(companyHtml),size:companyHtml.length}}}));
  upstream=http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;const input=JSON.parse(body);const data=await db.session(null,c=>c.query('SELECT public.get_public_specialist_v1($1) data',[input.p_slug]).then(r=>r.rows[0].data),'anon');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));}catch{res.writeHead(500);res.end();}});
  const u=await listen(upstream),specialist=createSpecialistHandler({backendOrigin:'http://127.0.0.1:'+u,anonKey:'sb_publishable_test',allowLoopbackForTests:true});let swap=false,swappedId;
  const classify=async name=>{const row=(await db.query('SELECT profile_kind,profile_id FROM public.profile_slug_registry WHERE slug=$1',[name])).rows[0];if(!row)return {kind:'unknown',slug:name};if(row.profile_kind==='specialist')return {kind:'specialist',slug:name};return {kind:'company',slug:name,company_id:row.profile_id,version:1,manifest_sha256:hash(manifest)};};
  const router=createSharedRouter({classify,readManifest:async()=>manifest,readArtifact:async()=>{if(swap){swap=false;await db.query('DELETE FROM public.companies WHERE id=$1',[companyId]);swappedId=(await db.call(A,'create_my_specialist_draft',['Specialist',slug,'Builder'])).id;}return companyHtml;},specialist});
  app=http.createServer(router);const p=await listen(app);const get=()=>new Promise((resolve,reject)=>{const q=http.get({host:'127.0.0.1',port:p,path:'/',headers:{host:slug+'.xn--b1ajuq0c.com'}},r=>{let body='';r.setEncoding('utf8');r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,body,headers:r.headers}));});q.on('error',reject);});
  let r=await get();assert.equal(r.status,200);assert.equal(r.body,companyHtml.toString());assert.match(r.headers['cache-control'],/no-store/);
  swap=true;r=await get();assert.equal(r.status,503);assert(!r.body.includes('Synthetic company'));assert(swappedId);
  r=await get();assert.equal(r.status,404);assert(!r.body.includes('Synthetic company'));
  await db.call(A,'publish_my_specialist_v1',[swappedId,1,crypto.randomUUID()]);r=await get();assert.equal(r.status,200);assert.match(r.body,/Specialist/);assert(!r.body.includes('Synthetic company'));
  await db.call(A,'unpublish_my_specialist_v1',[swappedId]);assert.equal((await get()).status,404);
  await db.call(A,'publish_my_specialist_v1',[swappedId,1,crypto.randomUUID()]);assert.equal((await get()).status,200);
  await db.call(A,'confirm_my_specialist_erasure',[swappedId,crypto.randomUUID()]);assert.equal((await get()).status,404);
  await db.call(A,'delete_my_specialist_draft',[swappedId]);assert.equal((await get()).status,404);
 }finally{if(app?.listening)await close(app);if(upstream?.listening)await close(upstream);await db.close();}
});
