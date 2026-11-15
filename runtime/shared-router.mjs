// Isolated review candidate. No live classifier, artifact issuer, or deployment.
import {createHash} from 'node:crypto';
import {hostSlug} from './specialist-public.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hex=/^[0-9a-f]{64}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fixed={'index.html':'text/html; charset=utf-8','profile.css':'text/css; charset=utf-8','profile.json':'application/json; charset=utf-8','profile.md':'text/markdown; charset=utf-8','llms.txt':'text/plain; charset=utf-8'};
const imageTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const cspFor=hashes=>"default-src 'none'; style-src 'self'; img-src 'self' https: data:; script-src "+(hashes.length?hashes.map(h=>"'sha256-"+h+"'").join(' '):"'none'")+"; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const headers={'cache-control':'no-store, max-age=0, private','surrogate-control':'no-store','cdn-cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
async function bounded(port){const controller=new AbortController();let timer;try{return await Promise.race([Promise.resolve().then(()=>port(controller.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('dependency timeout'));},3000);})]);}finally{clearTimeout(timer);controller.abort();}}
function pathFor(url){
 if(typeof url!=='string'||!url.startsWith('/')||url.startsWith('//')||/[\\#\x00-\x20\x7f]/.test(url))return null;
 const pathname=url.split('?')[0];if(pathname.includes('%'))return null;
 const name=pathname==='/'?'index.html':pathname.slice(1);
 if(fixed[name])return {name,type:fixed[name]};
 const match=/^media\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,150})\.(png|jpg|jpeg|webp)$/.exec(name);
 return match?{name,type:imageTypes[match[2]]}:null;
}
function bindingValid(x,slug){
 if(!x||Array.isArray(x)||typeof x!=='object'||x.slug!==slug)return false;
 if(['specialist','unknown'].includes(x.kind))return Object.keys(x).sort().join(',')==='kind,slug';
 return x.kind==='company'&&Object.keys(x).sort().join(',')==='company_id,kind,manifest_sha256,slug,version'&&uuid.test(x.company_id)&&Number.isSafeInteger(x.version)&&x.version>0&&hex.test(x.manifest_sha256);
}
function equalBinding(a,b){return a.kind===b.kind&&a.slug===b.slug&&a.company_id===b.company_id&&a.version===b.version&&a.manifest_sha256===b.manifest_sha256;}
function verifyManifest(raw,b){
 if(!Buffer.isBuffer(raw)||raw.length>131072||sha(raw)!==b.manifest_sha256)throw Error('invalid manifest digest');
 const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(!m||Array.isArray(m)||Object.keys(m).sort().join(',')!=='company_id,files,script_hashes,slug,version'||m.slug!==b.slug||m.company_id!==b.company_id||m.version!==b.version||!Array.isArray(m.script_hashes)||m.script_hashes.length>8||new Set(m.script_hashes).size!==m.script_hashes.length||m.script_hashes.some(h=>typeof h!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(h))||!m.files||Array.isArray(m.files)||typeof m.files!=='object'||Object.keys(m.files).length>1000)throw Error('invalid manifest');
 return m;
}
/** Ports are trusted server dependencies. Never pass client-controlled implementations.
 * classifier is not yet implemented; production mounting is prohibited. */
export function createSharedRouter({classify,readManifest,readArtifact,specialist}){
 if([classify,readManifest,readArtifact,specialist].some(x=>typeof x!=='function'))throw Error('trusted ports required');
 return async function shared(req,res){
  const respond=(status,body='')=>{res.writeHead(status,{...headers,'content-type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':body);};
  if(!['GET','HEAD'].includes(req.method))return respond(405,'Not found');
  const slug=hostSlug(req),file=pathFor(req.url);if(!slug||!file)return respond(404,'Not found');
  try{
   const binding=await bounded(signal=>classify(slug,signal));if(!bindingValid(binding,slug))throw Error('invalid classification');
   if(binding.kind!=='company')return await specialist(req,res); // no static fallback
   const manifest=verifyManifest(await bounded(signal=>readManifest(binding,signal)),binding),entry=manifest.files[file.name];
   if(!entry)return respond(404,'Not found');
   if(!entry||Array.isArray(entry)||typeof entry!=='object'||Object.keys(entry).sort().join(',')!=='sha256,size'||!hex.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>10485760)throw Error('invalid file binding');
   const body=await bounded(signal=>readArtifact(binding,file.name,signal));if(!Buffer.isBuffer(body)||body.length!==entry.size||sha(body)!==entry.sha256)throw Error('artifact mismatch');
   const again=await bounded(signal=>classify(slug,signal));if(!bindingValid(again,slug)||!equalBinding(binding,again))throw Error('classification changed');
   res.writeHead(200,{...headers,'content-type':file.type,'content-security-policy':cspFor(manifest.script_hashes)});return res.end(req.method==='HEAD'?undefined:body);
  }catch{if(res.headersSent){res.destroy?.();return;}return respond(503,'Unavailable');}
 };
}
