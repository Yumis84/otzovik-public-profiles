import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSharedRouter} from '../runtime/shared-router.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const id='11111111-1111-4111-8111-111111111111',slug='company-one',name='index.html';
const files={'index.html':Buffer.from('<html><h1>Company unchanged</h1></html>'),'profile.css':Buffer.from('h1{color:blue}'),'media/logo.webp':Buffer.from('image bytes')};
const manifest=Buffer.from(JSON.stringify({slug,company_id:id,version:4,script_hashes:[],files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,{sha256:hash(b),size:b.length}]))}));
const binding={kind:'company',slug,company_id:id,version:4,manifest_sha256:hash(manifest)};
const make=(override={})=>createSharedRouter({classify:async()=>binding,readManifest:async()=>manifest,readArtifact:async(_,n)=>files[n],specialist:async(_,res)=>{res.writeHead(404,{'cache-control':'no-store'});res.end('Not found');},...override});
async function call(handler,{host=slug+'.xn--b1ajuq0c.com',url='/',method='GET',extra=[]}={}){let output={};await handler({method,url,rawHeaders:['Host',host,...extra]},{writeHead:(status,headers)=>{output.status=status;output.headers=headers},end:body=>{output.body=body}});return output;}
test('company bytes, CSS and media served only against exact identity and digest',async()=>{
 let classifications=0;const handler=make({classify:async()=>{classifications++;return binding;}});
 for(const [url,n] of [['/','index.html'],['/profile.css?rev=1%202','profile.css'],['/media/logo.webp','media/logo.webp']]){const r=await call(handler,{url});assert.equal(r.status,200);assert.deepEqual(r.body,files[n]);assert.match(r.headers['cache-control'],/no-store/);assert.match(r.headers['content-security-policy'],/script-src 'none'/);}
 assert.equal(classifications,6);const head=await call(handler,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body,undefined);
});
test('unknown, disabled, malformed or unavailable classifier never falls back to company static',async()=>{
 let reads=0;const invalid=[null,{}, {...binding,slug:'other'},{...binding,company_id:'not-a-uuid'}, {...binding,version:0}, {...binding,manifest_sha256:'bad'}, {...binding,unexpected:'secret'}];
 for(const x of invalid){let r=await call(make({classify:async()=>x,readManifest:async()=>{reads++;return manifest;}}));assert.equal(r.status,503);}
 assert.equal((await call(make({classify:async()=>{throw Error('offline')},readManifest:async()=>{reads++;return manifest;}}))).status,503);
 const fallback=make({classify:async()=>({kind:'unknown',slug}),readManifest:async()=>{reads++;return manifest;}});assert.equal((await call(fallback)).status,404);assert.equal(reads,0);
});
test('no stale company content after deletion, reassignment, version or digest changes',async()=>{
 for(const next of [{kind:'unknown',slug},{kind:'specialist',slug},{...binding,company_id:'22222222-2222-4222-8222-222222222222'},{...binding,version:5},{...binding,manifest_sha256:'f'.repeat(64)}]){
  let n=0;const handler=make({classify:async()=>++n===1?binding:next});const r=await call(handler);assert.equal(r.status,503);assert(!String(r.body).includes('Company unchanged'));assert.equal(n,2);
 }
});
test('wrong manifest, corrupted asset, unlisted file and path attacks fail closed',async()=>{
 assert.equal((await call(make({readManifest:async()=>Buffer.from('{}')}))).status,503);
 assert.equal((await call(make({readArtifact:async()=>Buffer.from('malicious')}))).status,503);
 assert.equal((await call(make(),{url:'/other.html'})).status,404);
 for(const url of ['/../index.html','/%2e%2e/profile.json','//evil.test/','/media/../index.html','/media/a.svg'])assert.equal((await call(make(),{url})).status,404);
 assert.equal((await call(make(),{extra:['Host','evil.invalid']})).status,404);
});
test('specialist classification invokes only specialist handler, never company source',async()=>{
 let reads=0,calls=0;const handler=make({classify:async()=>({kind:'specialist',slug}),readManifest:async()=>{reads++;return manifest;},specialist:async(_,res)=>{calls++;res.writeHead(200,{'cache-control':'no-store'});res.end('specialist');}});
 const r=await call(handler);assert.equal(r.status,200);assert.equal(r.body,'specialist');assert.equal(calls,1);assert.equal(reads,0);
});
test('a classifier that never resolves fails closed on timeout',async()=>{
 const started=Date.now();const r=await call(make({classify:()=>new Promise(()=>{})}));
 assert.equal(r.status,503);assert(Date.now()-started<5000);assert(!String(r.body).includes('Company unchanged'));
});
