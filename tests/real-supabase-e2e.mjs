// Runs only after the pinned cabinet disposable Supabase acceptance stack.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';
const root=process.env.OTZOVIK_CABINET_ROOT;
assert(root,'isolated cabinet checkout required');
const {createClient}=createRequire(path.join(path.resolve(root),'package.json'))('@supabase/supabase-js');
const cfg=JSON.parse(await fs.readFile('/tmp/otzovik-local-status.json','utf8'));
for(const v of [cfg.API_URL,cfg.DB_URL])assert(['127.0.0.1','localhost','[::1]'].includes(new URL(v).hostname),'loopback only');
assert.equal(new URL(cfg.API_URL).port,'54321');assert(cfg.ANON_KEY&&cfg.SERVICE_ROLE_KEY);
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const stranger=createClient(cfg.API_URL,cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{if(r.error)throw Error('Isolated RPC failed: '+r.error.code);return r.data;};
const password='Synthetic-'+crypto.randomUUID()+'!',email='adapter-'+crypto.randomUUID()+'@example.test';
const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
ok(await owner.auth.signInWithPassword({email,password}));
const otherEmail='other-'+crypto.randomUUID()+'@example.test';ok(await admin.auth.admin.createUser({email:otherEmail,password,email_confirm:true}));ok(await stranger.auth.signInWithPassword({email:otherEmail,password}));
const slug='adapter-'+crypto.randomUUID().slice(0,12), profile=ok(await owner.rpc('create_my_specialist_draft',{p_display_name:'Synthetic Adapter',p_slug:slug,p_profession:'Master'}));
const handler=createSpecialistHandler({backendOrigin:cfg.API_URL,anonKey:cfg.ANON_KEY,allowLoopbackForTests:true});
const server=http.createServer(handler);const port=await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const get=()=>new Promise((resolve,reject)=>{let q=http.get({host:'127.0.0.1',port,path:'/',headers:{host:slug+'.xn--b1ajuq0c.com'}},r=>{let body='';r.setEncoding('utf8');r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));});q.on('error',reject);});
try{
 assert.equal((await get()).status,404);
 const args={p_specialist_id:profile.id,p_expected_version:1,p_request_id:crypto.randomUUID()};
 assert((await stranger.rpc('publish_my_specialist_v1',args)).error);ok(await owner.rpc('publish_my_specialist_v1',args));
 let r=await get();assert.equal(r.status,200);assert.match(r.body,/Synthetic Adapter/);assert.match(r.headers['cache-control'],/no-store/);
 ok(await owner.rpc('unpublish_my_specialist_v1',{p_specialist_id:profile.id}));r=await get();assert.equal(r.status,404);assert(!r.body.includes('Synthetic Adapter'));
 ok(await owner.rpc('publish_my_specialist_v1',{...args,p_request_id:crypto.randomUUID()}));assert.equal((await get()).status,200);
 ok(await owner.rpc('confirm_my_specialist_erasure',{p_specialist_id:profile.id,p_confirmation_id:crypto.randomUUID()}));r=await get();assert.equal(r.status,404);assert(!r.body.includes('Synthetic Adapter'));
 ok(await admin.auth.admin.deleteUser(user.id));assert.equal((await get()).status,404);
 console.log('PASS real disposable Auth/PostgREST + specialist adapter lifecycle');
}finally{await new Promise(resolve=>server.close(resolve));}
