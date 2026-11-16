import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCompanyManifest} from '../runtime/company-manifest.mjs';
import {createSharedRouter} from '../runtime/shared-router.mjs';
for(const slug of ['test2','student-agency','ortomediya']){
 test('actual '+slug+' HTML and CSS match manifest and CSP script hash',async()=>{
  const html=await readFile('profiles/'+slug+'/index.html'),css=await readFile('profiles/'+slug+'/profile.css');
  const scripts=[...html.toString('utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);const hash=createHash('sha256').update(scripts[0][1]).digest('base64');
  const files=new Map([['index.html',html],['profile.css',css]]);
  const id='11111111-1111-4111-8111-111111111111';
  const manifest=createCompanyManifest({slug,companyId:id,version:1,files,approvedScriptHashes:[hash]});
  const binding={kind:'company',slug,company_id:id,version:1,manifest_sha256:manifest.sha256};
  const route=createSharedRouter({classify:async()=>binding,readManifest:async()=>manifest.raw,readArtifact:async(_,name)=>files.get(name),specialist:async()=>{throw Error('unexpected')}});
  let out={};await route({method:'GET',url:'/',rawHeaders:['Host',slug+'.xn--b1ajuq0c.com']},{writeHead:(status,headers)=>{out.status=status;out.headers=headers},end:body=>{out.body=body}});
  assert.equal(out.status,200);assert.deepEqual(out.body,html);
  assert(out.headers['content-security-policy'].includes("'sha256-"+hash+"'"));
  assert.match(html.toString('utf8'),/href="profile\.css"/);
  assert.match(out.headers['cache-control'],/no-store/);
 });
}
