// Candidate release helper. A separate reviewed issuer must authorize and persist the digest.
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const allowed=n=>typeof n==='string'&&(['index.html','profile.css','profile.json','profile.md','llms.txt'].includes(n)||/^media\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}\.(png|jpg|jpeg|webp)$/.test(n));
export function createCompanyManifest({slug,companyId,version,files,approvedScriptHashes}){
 if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)||slug.includes('--')||typeof companyId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(companyId)||!Number.isSafeInteger(version)||version<1)throw Error('invalid company identity');
 if(!(files instanceof Map)||!files.has('index.html')||files.size>1000||!Array.isArray(approvedScriptHashes)||approvedScriptHashes.length>8||new Set(approvedScriptHashes).size!==approvedScriptHashes.length||approvedScriptHashes.some(h=>typeof h!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(h)))throw Error('invalid reviewed files or scripts');
 const entries={};for(const [name,bytes] of [...files].sort(([a],[b])=>a<b?-1:a>b?1:0)){if(!allowed(name)||!Buffer.isBuffer(bytes)||bytes.length>10485760)throw Error('invalid file');entries[name]={sha256:sha(bytes),size:bytes.length};}
 const raw=Buffer.from(JSON.stringify({slug,company_id:companyId,version,script_hashes:approvedScriptHashes,files:entries}));if(raw.length>131072)throw Error('manifest too large');return {raw,sha256:sha(raw)};
}
