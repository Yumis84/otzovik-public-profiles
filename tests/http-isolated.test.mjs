import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';
const host='alex-photo.xn--b1ajuq0c.com';
const data={slug:'alex-photo',display_name:'Alex',profession:'Master',specialization:null,city:null,description:'Synthetic profile'};
const listen=s=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s.address().port));});
const close=s=>new Promise(resolve=>s.close(resolve));
test('HTTP GET calls local RPC on every request, never serves stale artifacts',async()=>{
 let current=data,calls=0;
 const upstream=http.createServer((req,res)=>{calls++;assert.equal(req.url,'/rest/v1/rpc/get_public_specialist_v1');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(current));});
 const upPort=await listen(upstream);
 const handler=createSpecialistHandler({backendOrigin:'http://127.0.0.1:'+upPort,anonKey:'sb_publishable_synthetic',allowLoopbackForTests:true});
 const app=http.createServer(handler),appPort=await listen(app);
 const get=()=>new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:appPort,path:'/',headers:{host}},r=>{let body='';r.setEncoding('utf8');r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));});req.on('error',reject);});
 try{
  let r=await get();assert.equal(r.status,200);assert.match(r.body,/Synthetic profile/);assert.match(r.headers['cache-control'],/no-store/);
  current=null;r=await get();assert.equal(r.status,404);assert(!(r.body.includes('Synthetic profile')));
  current=data;r=await get();assert.equal(r.status,200);
  current=null;r=await get();assert.equal(r.status,404);assert.equal(calls,4);
  await close(upstream);r=await get();assert.equal(r.status,503);assert(!(r.body.includes('Synthetic profile')));
 }finally{await close(app);if(upstream.listening)await close(upstream);}
});
