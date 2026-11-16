# Shared routing backend — implementation handoff, not an approved contract

Do not deploy, create roles, execute SQL, or connect this document's design to
the router. It depends on independent review of PR50 C1–C6 and on an approved
source of truth for company publication and artifact binding.

## Current facts and unresolved sources

The existing PR50 candidate uses `public.profile_slug_registry` with
`slug`, `profile_kind`, `profile_id`; specialist publishing locks the
registry entry and sets `specialist_publication_state` and revision pointer.
The specialist getter checks `specialist_public_control` and published
state. These are candidates, not verified production contracts. The current
shared-router accepts exactly `{kind:'company',slug,company_id,version,
manifest_sha256}` or `{kind:'specialist'|'unknown',slug}`. It checks company
manifest bytes and identity, reclassifies after the file read, and never falls
back to static content when classification or specialist lookup fails.

The repository does not yet supply a reviewed source mapping current company
publication status to a monotonic artifact generation and manifest digest.
Registry membership alone must not authorize serving old static HTML.

## Proposed classifier implementation

1. Server-authenticated, least-privilege RPC, fixed canonical ASCII slug.
   Backend validates signed caller identity; a decoded JWT claim is not proof.
2. Read one authoritative primary snapshot; check unique registry kind and ID,
   owner lifecycle, publication/suspension/erasure state and global disable.
   Unknown, conflicting, deleted, disabled, inconsistent or missing data must
   never resolve to company. Errors return unavailable, not fallback content.
3. Company result requires an active current binding containing exact profile
   ID, slug, strictly monotonic generation and digest of approved manifest.
   No active binding means protected/unavailable, not a static lookup.
4. Specialist and unknown take the existing specialist getter path. Getter
   performs its own publication check every request; its null result covers
   draft, unpublished, erased, suspended and absent cases indistinguishably.
5. Claim, release, suspend, erase and binding invalidation must serialize on
   the same approved slug/lifecycle authority. A reused slug must not validate
   an old company ID, generation or digest. No negative cache is assumed.

SQL signatures, table ownership, grants, row-lock order and exact source
tables remain deliberately unspecified until Claude audits C1–C6 and the
owner approves the source-of-truth design. A privileged test classifier or a
caller-provided ID is not a substitute.

## Issuer implementation sequence

Use the existing Ed25519 candidate only as a signing primitive. Authenticate
an explicitly authorized operator or release service against a separately
reviewed issuer identity with short-lived credentials and revocation; enforce
the authority server-side, not via caller-provided identity. Build a manifest
from immutable approved files and explicitly reviewed CSP hashes. Read
current authoritative company identity and version; perform an atomic CAS
against active lifecycle/slug and register the digest and generation together
with audit evidence. Deny if any input, authorization, CAS or audit fails.
Only serve bytes matching the binding returned by the fresh classifier.

Define signing key validity, overlapping rotation and emergency revocation in
an independently managed trust store, with no private keys in browser,
repository or logs. Verify the signer independently of storage and database
bindings. Persist monotonic release/erasure fencing outside any single
database restore domain; after PITR, deny publication until reconciliation
proves a restored binding and key are still authorized. Existing backup
contents and immutable storage still need a separate erasure policy.

## Acceptance cases (to implement against approved backend)

* Two owners and both profile types: valid company, published specialist,
  unpublished, suspended, erasing, deleted and unknown all have correct
  fail-closed results without exposing private fields.
* Company-to-company and company-to-specialist slug reuse under concurrency;
  changed ID, generation, digest and altered file all reject stale output.
* Issuer impersonation, stale signed manifest, revoked/expired key, signing
  after suspend, failed CAS, duplicate request and issuer/audit outage fail.
* Delete vs publish/read, unpublish vs read, key revoke vs read, timeout and
  process crash; test authoritative primary consistency and every writer.
* Restore a snapshot taken before erase or revocation and demonstrate that
  external fencing prevents resurrection before reconciliation.
* Verify real browser routes, CSP, existing company files, and controlled
  ingress including slow readers. Select and measure takedown semantics; no
  test can retract bytes already delivered to a client.

No SQL or real integration was executed by adding this document.
