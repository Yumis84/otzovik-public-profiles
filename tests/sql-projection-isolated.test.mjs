import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';
const root=process.env.OTZOVIK_CABINET_ROOT;
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s.address().port));});
const close=s=>new Promise(resolve=>s.close(resolve));
test('isolated SQL publication -> HTTP -> unpublish -> republish -> erasure', {skip:!root},async()=>{
 const base=path.resolve(root),{database,A}=await import(pathToFileURL(path.join(base,'tests/database.mjs')).href);
 const db=await database({editor:true});let app,upstream;
 try{
  await db.exec("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$; GRANT USAGE ON SCHEMA public,storage TO service_role; DROP TRIGGER specialist_object_integrity ON storage.objects;");
  for(const f of ['release/60_GATEWAY_CANDIDATE.sql','release/65_GATEWAY_REMEDIATION_CANDIDATE.sql','release/66_SPECIALIST_OPERATOR_CANDIDATE.sql','20261106_specialist_publication_foundation_CANDIDATE.sql','20261106_specialist_slug_quarantine_CANDIDATE.sql','20261112_specialist_erasure_barrier_CANDIDATE.sql','20261112_specialist_revision_retention_CANDIDATE.sql','20261112_specialist_publish_CANDIDATE.sql','20261112_specialist_public_getter_CANDIDATE.sql'])await db.exec(await fs.readFile(path.join(base,'sql',f),'utf8'));
  const slug='integrated-person',id=(await db.call(A,'create_my_specialist_draft',['Person',slug,'Builder'])).id;
  await db.query('UPDATE public.specialist_public_control SET enabled=true');
  let calls=0;upstream=http.createServer(async(req,res)=>{calls++;try{let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);const output=await db.session(null,c=>c.query('SELECT public.get_public_specialist_v1($1) data',[input.p_slug]).then(r=>r.rows[0].data),'anon');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(output));}catch{res.writeHead(500);res.end();}});
  const port=await listen(upstream),handler=createSpecialistHandler({backendOrigin:'http://127.0.0.1:'+port,anonKey:'sb_publishable_synthetic',allowLoopbackForTests:true});
  app=http.createServer(handler);const appPort=await listen(app);
  const get=()=>new Promise((resolve,reject)=>{const r=http.get({host:'127.0.0.1',port:appPort,path:'/',headers:{host:slug+'.xn--b1ajuq0c.com'}},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});r.on('error',reject);});
  assert.equal((await get()).status,404);
  await db.call(A,'publish_my_specialist_v1',[id,1,crypto.randomUUID()]);let r=await get();assert.equal(r.status,200);assert.match(r.body,/Person/);assert.match(r.headers['cache-control'],/no-store/);
  await db.call(A,'unpublish_my_specialist_v1',[id]);r=await get();assert.equal(r.status,404);assert(!r.body.includes('Person'));
  await db.call(A,'publish_my_specialist_v1',[id,1,crypto.randomUUID()]);assert.equal((await get()).status,200);
  await db.call(A,'confirm_my_specialist_erasure',[id,crypto.randomUUID()]);r=await get();assert.equal(r.status,404);assert(!r.body.includes('Person'));
  await db.call(A,'delete_my_specialist_draft',[id]);assert.equal((await get()).status,404);assert.equal(calls,6);
 }finally{if(app?.listening)await close(app);if(upstream?.listening)await close(upstream);await db.close();}
});
