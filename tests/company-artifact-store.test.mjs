import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createCompanyArtifactStore} from '../runtime/company-artifact-store.mjs';
test('read original company files without traversing links or accepting unsafe paths',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'otzovik-store-'));
 try{
  const profiles=path.join(tmp,'profiles'),manifests=path.join(tmp,'bindings');await fs.mkdir(profiles);await fs.mkdir(manifests);await fs.mkdir(path.join(profiles,'firm-one'));await fs.writeFile(path.join(profiles,'firm-one','index.html'),'unchanged');await fs.writeFile(path.join(manifests,'firm-one.json'),'manifest');
  const store=await createCompanyArtifactStore({profilesRoot:profiles,manifestsRoot:manifests}),binding={slug:'firm-one'};
  assert.equal(String(await store.readManifest(binding)),'manifest');assert.equal(String(await store.readArtifact(binding,'index.html')),'unchanged');
  await assert.rejects(store.readArtifact(binding,'../secret'));await fs.symlink('/etc/passwd',path.join(profiles,'firm-one','escape'));await assert.rejects(store.readArtifact(binding,'escape'));
  await fs.symlink('/etc',path.join(profiles,'firm-one','media'));await assert.rejects(store.readArtifact(binding,'media/passwd'));
  await fs.symlink(profiles,path.join(tmp,'profiles-link'));await assert.rejects(createCompanyArtifactStore({profilesRoot:path.join(tmp,'profiles-link'),manifestsRoot:manifests}));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
