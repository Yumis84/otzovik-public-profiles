// CRYPTOGRAPHIC CANDIDATE ONLY. No authority, publishing, persistence or routing.
// The caller must obtain binding from an independently authorized, current source.
import {createHash, sign, verify} from 'node:crypto';

const domain = Buffer.from('otzovik-company-manifest-v1\0', 'utf8');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = /^[a-f0-9]{64}$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const keyIdPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const maxLifetime = 3600;
const fields = ['slug','company_id','version','manifest_sha256'];

function validBinding(b) {
  return b && typeof b === 'object' && !Array.isArray(b) &&
    Object.keys(b).sort().join(',') === ['company_id','manifest_sha256','slug','version'].join(',') &&
    typeof b.slug === 'string' && slugPattern.test(b.slug) && !b.slug.includes('--') &&
    typeof b.company_id === 'string' && uuid.test(b.company_id) &&
    Number.isSafeInteger(b.version) && b.version > 0 &&
    typeof b.manifest_sha256 === 'string' && digest.test(b.manifest_sha256);
}
function validTime(n) { return Number.isSafeInteger(n) && n >= 0; }
function signingBytes(binding, keyId, issuedAt, expiresAt) {
  // Ordered array avoids object property-order ambiguity.
  return Buffer.concat([domain, Buffer.from(JSON.stringify([
    binding.slug, binding.company_id, binding.version, binding.manifest_sha256,
    keyId, issuedAt, expiresAt
  ]), 'utf8')]);
}
function keyCheck(key, type) {
  if (!key || key.type !== type || key.asymmetricKeyType !== 'ed25519') throw Error('invalid key');
}
function matchesManifest(manifest, binding) {
  if (!Buffer.isBuffer(manifest) || manifest.length > 131072 ||
      createHash('sha256').update(manifest).digest('hex') !== binding.manifest_sha256) return false;
  try {
    const m = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(manifest));
    return !!m && typeof m === 'object' && !Array.isArray(m) &&
      m.slug === binding.slug && m.company_id === binding.company_id && m.version === binding.version;
  } catch { return false; }
}

// Test/review candidate only: possession of a private key alone MUST NOT authorize issuance.
// Real issuer must authenticate operator and commit against current authoritative binding.
export function issueAttestationCandidate({binding, manifest, keyId, privateKey, issuedAt, expiresAt}) {
  if (!validBinding(binding) || !matchesManifest(manifest, binding) ||
      typeof keyId !== 'string' || !keyIdPattern.test(keyId) ||
      !validTime(issuedAt) || !validTime(expiresAt) ||
      expiresAt <= issuedAt || expiresAt - issuedAt > maxLifetime) throw Error('invalid input');
  keyCheck(privateKey, 'private');
  const signature = sign(null, signingBytes(binding, keyId, issuedAt, expiresAt), privateKey).toString('base64url');
  return {binding: {...binding}, key_id:keyId, issued_at:issuedAt, expires_at:expiresAt, signature};
}

// An attestation is not an authorization decision. Fetch expectedBinding fresh from
// the trusted primary; deny if unknown, disabled, missing or stale before calling.
export function verifyAttestationCandidate({attestation, expectedBinding, manifest, trustedKeys, now}) {
  try {
    if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation) ||
        Object.keys(attestation).sort().join(',') !== 'binding,expires_at,issued_at,key_id,signature' ||
        !validBinding(expectedBinding) || !validBinding(attestation.binding) ||
        !fields.every(k => attestation.binding[k] === expectedBinding[k]) ||
        !matchesManifest(manifest, expectedBinding) ||
        typeof attestation.key_id !== 'string' || !keyIdPattern.test(attestation.key_id) ||
        !validTime(now) || !validTime(attestation.issued_at) || !validTime(attestation.expires_at) ||
        attestation.issued_at > now || now >= attestation.expires_at ||
        attestation.expires_at <= attestation.issued_at ||
        attestation.expires_at - attestation.issued_at > maxLifetime ||
        typeof attestation.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(attestation.signature) ||
        !(trustedKeys instanceof Map) || !trustedKeys.has(attestation.key_id)) return false;
    const sig = Buffer.from(attestation.signature, 'base64url');
    if (sig.length !== 64 || sig.toString('base64url') !== attestation.signature) return false;
    const key = trustedKeys.get(attestation.key_id);
    keyCheck(key, 'public');
    return verify(null, signingBytes(attestation.binding, attestation.key_id, attestation.issued_at, attestation.expires_at), key, sig);
  } catch { return false; }
}
