import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSpecialistHandler} from '../runtime/specialist-public.mjs';
const slug='alice-photo';
const projection={slug,display_name:'<Alice & Co>',profession:'Photographer',specialization:null,city:'Test',description:'<script>alert(1)</script>'};
function result(data,status=200,type='application/json'){return new Response(JSON.stringify(data),{status,headers:{'content-type':type}});}
async function call(handle,{host=slug+'.xn--b1ajuq0c.com',url='/',method='GET',extra=[]}={}){
 let out={};let req={method,url,rawHeaders:['Host',host,...extra]};let res={writeHead:(status,headers)=>{out.status=status;out.headers=headers;},end:body=>{out.body=body;}};await handle(req,res);return out;
}
test('fresh authoritative projection per request; unpublish, republish, erasure',async()=>{
 let data=projection,calls=0;const handle=createSpecialistHandler({backendOrigin:'https://db.example',anonKey:'sb_publishable_test',fetcher:async(url,options)=>{calls++;assert.equal(url,'https://db.example/rest/v1/rpc/get_public_specialist_v1');assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');assert.deepEqual(JSON.parse(options.body),{p_slug:slug});return result(data);}});
 let r=await call(handle);assert.equal(r.status,200);assert.match(r.body,/&lt;script&gt;/);assert(!r.body.includes('<script>'));assert.match(r.body,/&lt;Alice &amp; Co&gt;/);assert.match(r.headers['cache-control'],/no-store/);assert.match(r.headers['content-security-policy'],/default-src 'none'/);
 data=null;assert.equal((await call(handle)).status,404);data=projection;assert.equal((await call(handle)).status,200);data=null;assert.equal((await call(handle)).status,404);assert.equal(calls,4);
});
test('strict host, slug, method and asset rejection; forwarded headers ignored',async()=>{
 let calls=0;const handle=createSpecialistHandler({backendOrigin:'https://db.example',anonKey:'sb_publishable_test',fetcher:async()=>{calls++;return result(projection);}});
 for(const input of [{host:'xn--b1ajuq0c.com'},{host:'nested.'+slug+'.xn--b1ajuq0c.com'},{host:'x--y.xn--b1ajuq0c.com'},{host:'evil.com'},{host:slug+'.xn--b1ajuq0c.com:443'},{url:'/profile.json'},{url:'/?x=1'},{method:'POST'},{extra:['Host','evil.com']}])assert.notEqual((await call(handle,input)).status,200);
 assert.equal(calls,0);assert.equal((await call(handle,{extra:['X-Forwarded-Host','evil.com']})).status,200);
 const head=await call(handle,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,'');
});
test('upstream failure, redirect, wrong shape, excessive bytes and leaked fields fail closed',async()=>{
 const items=[()=>{throw Error('offline')},()=>result(null,302),()=>result(projection,200,'text/html'),()=>result({...projection,owner_id:'secret'}),()=>result({...projection,slug:'other'}),()=>result({...projection,description:'x'.repeat(20000)})];
 for(const fn of items){const handle=createSpecialistHandler({backendOrigin:'https://db.example',anonKey:'sb_publishable_test',fetcher:fn});let r=await call(handle);assert.equal(r.status,503);assert(!r.body.includes('secret'));assert.match(r.headers['cache-control'],/no-store/);}
});
test('valid Unicode names follow database character limits',async()=>{
 const handle=createSpecialistHandler({backendOrigin:'https://db.example',anonKey:'sb_publishable_test',fetcher:async()=>result({...projection,display_name:'😀'.repeat(100)})});
 assert.equal((await call(handle)).status,200);
});
test('fixed backend URL rejects credentials, query, non-HTTPS and unexpected prefix',()=>{
 for(const origin of ['http://db.example','https://user:pass@db.example','https://db.example/x','https://db.example/?q=1'])assert.throws(()=>createSpecialistHandler({backendOrigin:origin,anonKey:'sb_publishable_test'}));
 const elevated='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';
 assert.throws(()=>createSpecialistHandler({backendOrigin:'https://db.example',anonKey:elevated}));
});
test('in-flight pre-takedown snapshot can finish, subsequent request rechecks',async()=>{
 let unblock,started;const entered=new Promise(resolve=>started=resolve),release=new Promise(resolve=>unblock=resolve);let first=true;
 const handle=createSpecialistHandler({backendOrigin:'https://db.example',anonKey:'sb_publishable_test',fetcher:async()=>{if(first){first=false;started();await release;return result(projection);}return result(null);}});
 const pending=call(handle);await entered;assert.equal((await call(handle)).status,404);unblock();assert.equal((await pending).status,200);assert.equal((await call(handle)).status,404);
});
