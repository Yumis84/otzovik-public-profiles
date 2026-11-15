import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createCompanyManifest} from '../runtime/company-manifest.mjs';
const id='11111111-1111-4111-8111-111111111111',hash=s=>createHash('sha256').update(s).digest('base64');
test('stable binding of explicit company identity, reviewed script and exact bytes',()=>{
 const a=createCompanyManifest({slug:'company-one',companyId:id,version:2,files:new Map([['profile.css',Buffer.from('body{}')],['index.html',Buffer.from('hi')]]),approvedScriptHashes:[hash('reviewed script')]});
 const b=createCompanyManifest({slug:'company-one',companyId:id,version:2,files:new Map([['index.html',Buffer.from('hi')],['profile.css',Buffer.from('body{}')]]),approvedScriptHashes:[hash('reviewed script')]});
 assert.equal(a.sha256,b.sha256);assert.deepEqual(a.raw,b.raw);assert.equal(JSON.parse(a.raw).company_id,id);
 assert.notEqual(createCompanyManifest({slug:'company-one',companyId:id,version:3,files:new Map([['index.html',Buffer.from('hi')],['profile.css',Buffer.from('body{}')]]),approvedScriptHashes:[hash('reviewed script')]}).sha256,a.sha256);
});
test('missing explicit approval, unsafe paths and identity fail closed',()=>{
 const v={slug:'company-one',companyId:id,version:1,files:new Map([['index.html',Buffer.from('ok')]]),approvedScriptHashes:[]};
 for(const x of [{...v,approvedScriptHashes:undefined},{...v,approvedScriptHashes:['evil']},{...v,companyId:'fake'},{...v,slug:'a--b'}, {...v,files:new Map([['index.html',Buffer.from('ok')],['../etc',Buffer.from('secret')]])}])assert.throws(()=>createCompanyManifest(x));
});
