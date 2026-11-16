# Company artifact attestation — non-SQL research candidate

The Ed25519 helper in `runtime/company-attestation-candidate.mjs` is isolated
code for review and tests. It is **not** connected to the existing router,
does not create or persist keys, and is not an issuer service. No key in this
test or repository is a production credential.

It signs a domain-separated serialization of slug, company ID, version,
manifest digest, key ID and a bounded validity window. Verification requires
an externally supplied current binding, a trusted public key by key ID, and
the exact manifest bytes. It rejects mismatches, bad signatures, expiry,
noncanonical signatures and unknown keys. The one-hour maximum window is a
review-only test limit, not an approved operating policy.

Possession of the signing key is not proof that a publisher was authorized:
the operator's identity, approval of actual manifest contents and script
hashes, trust root, key rotation, revocation, audit, atomic CAS with the
current company state, restore fencing, and race-free route binding remain
unimplemented. The exact manifest bytes still require the existing router's
full schema/file/CSP validation. A valid signature alone does not prove that
a profile is published, active, not blocked or not deleted. The supplied
current binding must come from an independently authenticated, strongly
consistent authoritative source; passing a fabricated binding is unsafe.

This candidate must not be wired into production or represented as an
authoritative issuer before SQL-contract review, design approval, real
authentication, lifecycle integration and independent audit. In-flight
takedown guarantees remain open. Run only the non-SQL test with
`node --test tests/company-attestation-candidate.test.mjs`.
