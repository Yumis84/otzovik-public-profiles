/** Review candidate. Mount only on authoritatively classified specialist routes.
 * Never route a null/error result to static files. No production configuration. */
const canonicalSuffix='.xn--b1ajuq0c.com';
const slugPattern=/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const fields=['slug','display_name','profession','specialization','city','description'];
const max={slug:63,display_name:150,profession:120,specialization:160,city:120,description:2000};
const escape=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const headers={
 'cache-control':'no-store, max-age=0, private',
 'surrogate-control':'no-store',
 'cdn-cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
function hostSlug(req){
 const hs=[];for(let i=0;i<req.rawHeaders.length;i+=2)if(req.rawHeaders[i].toLowerCase()==='host')hs.push(req.rawHeaders[i+1]);
 if(hs.length!==1||typeof hs[0]!=='string')return null;
 const host=hs[0].toLowerCase();if(!host.endsWith(canonicalSuffix))return null;
 const slug=host.slice(0,-canonicalSuffix.length);
 return slugPattern.test(slug)&&!slug.includes('--')?slug:null;
}
async function boundedJson(response){
 if(!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')||''))throw Error('bad type');
 const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>16384))throw Error('oversized');
 if(!response.body)throw Error('missing body');const reader=response.body.getReader();let size=0,chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)throw Error('oversized');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let p=0;for(const part of chunks){bytes.set(part,p);p+=part.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function valid(value,slug){
 if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!==fields.slice().sort().join(','))return false;
 if(value.slug!==slug)return false;
 for(const field of fields){const v=value[field];if(v===null&&['specialization','city','description'].includes(field))continue;if(typeof v!=='string'||[...v].length>max[field])return false;}
 return !!value.display_name.trim()&&!!value.profession.trim();
}
function documentHtml(p){
 const rows=[['Профессия',p.profession],['Специализация',p.specialization],['Город',p.city],['Описание',p.description]].filter(([,v])=>v);
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(p.display_name)+' | Отзыв.com</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f7f8fa;color:#172033}main{box-sizing:border-box;max-width:760px;margin:24px auto;padding:24px;background:white;border-radius:12px;overflow-wrap:anywhere}h1{font-size:clamp(1.5rem,5vw,2.25rem)}p{white-space:pre-wrap;line-height:1.55}.label{font-weight:700}</style></head><body><main><h1>'+escape(p.display_name)+'</h1>'+rows.map(([k,v])=>'<p><span class="label">'+escape(k)+':</span> '+escape(v)+'</p>').join('')+'</main></body></html>';
}
/** Fixed backend origin; fetch injection is for isolated tests only. */
export function createSpecialistHandler({backendOrigin,anonKey,fetcher=globalThis.fetch,allowLoopbackForTests=false}){
 const base=new URL(backendOrigin);
 if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||(!['https:'].includes(base.protocol)&&!(allowLoopbackForTests&&base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname))))throw Error('invalid fixed backend origin');
 if(typeof anonKey!=='string'||!anonKey||anonKey.length>4096||/[\r\n]/.test(anonKey))throw Error('invalid public key');
 let isPublicKey=anonKey.startsWith('sb_publishable_');
 if(!isPublicKey){try{const parts=anonKey.split('.');isPublicKey=parts.length===3&&JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role==='anon';}catch{isPublicKey=false;}}
 if(!isPublicKey)throw Error('public anon key required');
 const endpoint=new URL('/rest/v1/rpc/get_public_specialist_v1',base).href;
 return async function handle(req,res){
  const respond=(code,body='')=>{res.writeHead(code,{...headers,'content-type':code===200?'text/html; charset=utf-8':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':body);};
  if(req.method!=='GET'&&req.method!=='HEAD')return respond(405,'Not found');
  const slug=hostSlug(req);if(!slug||!['/','/index.html'].includes(req.url))return respond(404,'Not found');
  try{
   const response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','apikey':anonKey,'authorization':'Bearer '+anonKey,'cache-control':'no-store'},body:JSON.stringify({p_slug:slug}),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(3000)});
   if(response.status!==200)throw Error('upstream unavailable');
   const result=await boundedJson(response);if(result===null)return respond(404,'Not found');
   if(!valid(result,slug))throw Error('invalid projection');
   return respond(200,documentHtml(result));
  }catch{return respond(503,'Unavailable');}
 };
}
