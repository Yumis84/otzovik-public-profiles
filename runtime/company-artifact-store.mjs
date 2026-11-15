// Candidate loader for existing profiles/<slug>/ files and separately issued bindings.
// Deploy only with read-only roots controlled by the release operator.
import fs from 'node:fs/promises';
import {constants as C} from 'node:fs';
import path from 'node:path';
const segment=/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
async function rootCheck(root){
 if(!path.isAbsolute(root))throw Error('absolute immutable root required');
 const stat=await fs.lstat(root);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('unsafe root');
 const real=await fs.realpath(root);if(real!==path.resolve(root))throw Error('symlink root');return real;
}
async function safeRead(root,parts,limit){
 if(!parts.length||parts.some(p=>!segment.test(p)||p==='.'||p==='..'))throw Error('invalid path');
 let current=root;
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);const st=await fs.lstat(current);
  if(st.isSymbolicLink()||(i<parts.length-1&&!st.isDirectory()))throw Error('unsafe path');
 }
 const file=await fs.open(current,C.O_RDONLY|C.O_NOFOLLOW);
 try{const st=await file.stat();if(!st.isFile()||st.size>limit)throw Error('invalid file');
  const resolved=await fs.realpath(current);if(resolved!==current||!resolved.startsWith(root+path.sep))throw Error('escaped root');
  const out=Buffer.allocUnsafe(limit+1);let used=0;
  while(used<out.length){const {bytesRead}=await file.read(out,used,out.length-used,used);if(bytesRead===0)break;used+=bytesRead;}
  if(used>limit)throw Error('file too large');return out.subarray(0,used);
 }finally{await file.close();}
}
export async function createCompanyArtifactStore({profilesRoot,manifestsRoot}){
 const profiles=await rootCheck(profilesRoot),manifests=await rootCheck(manifestsRoot);
 return {
  readManifest:binding=>safeRead(manifests,[binding.slug+'.json'],131072),
  readArtifact:(binding,name)=>safeRead(profiles,[binding.slug,...name.split('/')],10485760)
 };
}
