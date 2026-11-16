import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync} from 'node:crypto';
import {issueAttestationCandidate, verifyAttestationCandidate} from '../runtime/company-attestation-candidate.mjs';

const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const other = generateKeyPairSync('ed25519');
const manifest = Buffer.from(JSON.stringify({slug:'company-one',company_id:'11111111-1111-4111-8111-111111111111',version:4,files:{},script_hashes:[]}));
const binding = {slug:'company-one', company_id:'11111111-1111-4111-8111-111111111111', version:4,
  manifest_sha256:createHash('sha256').update(manifest).digest('hex')};
const trustedKeys = new Map([['release-1',publicKey]]);
const opts = {binding,manifest,keyId:'release-1',privateKey,issuedAt:1000,expiresAt:1100};
const issue = () => issueAttestationCandidate(opts);
const check = (attestation, changes={}) => verifyAttestationCandidate({attestation,expectedBinding:binding,manifest,trustedKeys,now:1050,...changes});

test('signed bytes verify only for current authoritative binding and manifest', () => {
  assert.equal(check(issue()),true);
  for (const change of [
    {slug:'company-two'}, {company_id:'22222222-2222-4222-8222-222222222222'},
    {version:5}, {manifest_sha256:'f'.repeat(64)}
  ]) assert.equal(check(issue(),{expectedBinding:{...binding,...change}}),false);
  assert.equal(check(issue(),{manifest:Buffer.from('different')}),false);
  assert.equal(check(issue(),{expectedBinding:null}),false);
});
test('forgery, unknown or revoked key, and noncanonical signature fail closed', () => {
  const a=issue();
  assert.equal(check({...a,signature:issueAttestationCandidate({...opts,privateKey:other.privateKey}).signature}),false);
  assert.equal(check({...a,key_id:'other'}),false);
  assert.equal(check(a,{trustedKeys:new Map()}),false);
  assert.equal(check({...a,signature:a.signature+'='}),false);
  assert.equal(check({...a,extra:'untrusted'}),false);
});
test('expiry, replay after version change, malformed dates and unsupported signing fail closed', () => {
  const a=issue();
  assert.equal(check(a,{now:1100}),false);
  assert.equal(check(a,{now:999}),false);
  assert.equal(check(a,{expectedBinding:{...binding,version:binding.version+1}}),false);
  assert.equal(check({...a,expires_at:999999}),false);
  assert.throws(()=>issueAttestationCandidate({...opts,expiresAt:5000}));
  assert.throws(()=>issueAttestationCandidate({...opts,privateKey:publicKey}));
  assert.throws(()=>issueAttestationCandidate({...opts,manifest:Buffer.from('tampered')}));
  const wrong=Buffer.from(JSON.stringify({slug:'another-company',company_id:binding.company_id,version:binding.version}));
  assert.throws(()=>issueAttestationCandidate({...opts,manifest:wrong,binding:{...binding,manifest_sha256:createHash('sha256').update(wrong).digest('hex')}}));
});
test('signed object and supplied authority may not alias through issuer input', () => {
  const b={...binding};
  const a=issueAttestationCandidate({...opts,binding:b});
  b.version=5;
  assert.equal(check(a),true);
  assert.equal(check(a,{expectedBinding:b}),false);
});
