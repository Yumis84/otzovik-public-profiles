// Review-only client contract. The matching classifier RPC and issuer DO NOT exist yet.
import {boundedJson} from './specialist-public.mjs';
function roleOf(token){try{const parts=token.split('.');if(parts.length!==3)return null;return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role||null;}catch{return null;}}
export function createRouteClassifier({backendOrigin,publicApiKey,routeToken,fetcher=globalThis.fetch,allowLoopbackForTests=false}){
 const base=new URL(backendOrigin);
 if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||(base.protocol!=='https:'&&!(allowLoopbackForTests&&base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))))throw Error('invalid fixed backend origin');
 if(typeof publicApiKey!=='string'||publicApiKey.length>4096||/[\r\n]/.test(publicApiKey)||(!publicApiKey.startsWith('sb_publishable_')&&roleOf(publicApiKey)!=='anon'))throw Error('public API key required');
 if(typeof routeToken!=='string'||routeToken.length>8192||/[\r\n]/.test(routeToken)||roleOf(routeToken)!=='specialist_route_reader')throw Error('narrow route identity required');
 const endpoint=new URL('/rest/v1/rpc/resolve_public_profile_route_v1',base).href;
 return async function classify(slug,signal){
  if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)||slug.includes('--'))throw Error('invalid slug');
  const r=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','apikey':publicApiKey,'authorization':'Bearer '+routeToken,'cache-control':'no-store'},body:JSON.stringify({p_slug:slug}),redirect:'manual',cache:'no-store',signal});
  if(r.status!==200)throw Error('route classification unavailable');
  return boundedJson(r); // shared router validates the result and binds every field.
 };
}
