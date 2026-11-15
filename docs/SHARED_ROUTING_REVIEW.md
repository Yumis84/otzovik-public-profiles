# Shared company/specialist routing — isolated candidate, NO-GO

This change does **not** enable routing or modify company artifacts. The specialist adapter remains unchanged in behavior; shared routing, classifier-client and manifest tools are review candidates. In particular the authoritative classifier RPC, route-token issuer, company manifest issuer and publication/revocation transaction do not yet exist. Never connect `shared-router.mjs` to the live wildcard route or treat the test classifier as production authorization.

## Candidate contract

Each request accepts one canonical ASCII Host and a bounded path. A trusted backend port `classify(slug, signal)` must return exactly one of:

- `{kind:'company', slug, company_id, version, manifest_sha256}` with the **currently published, authoritative** company identity, monotonic artifact version and SHA-256 of the exact manifest bytes;
- `{kind:'specialist', slug}` or `{kind:'unknown', slug}`; neither can delegate to static files.

Timeouts, invalid responses, untrusted ports or missing company binding fail closed. The company path reads `profiles/<slug>/...` and a separate manifest through the candidate immutable-root store. It verifies the manifest digest, exact slug/company ID/version, strict named files, byte length and SHA-256 for every output. It repeats classification after reading and compares all binding fields; a mismatch or failed recheck is 503, with no old static fallback. Unknown/specialist calls the existing specialist getter adapter, not static HTML. The classifier client expects a fixed origin and a narrowly scoped `specialist_route_reader` JWT; its role claim check is only a configuration sanity check, **not** JWT signature verification. The backend must verify the signature and role on every call; a trusted issuer, token renewal/revocation, least-privilege PostgreSQL contract and egress policy require independent design and implementation.

The manifest contains `{slug,company_id,version,script_hashes,files}`; approved script hashes are explicit SHA-256 CSP hashes, not auto-approved from content. Existing company HTML contains inline gallery/navigation JavaScript; a blanket `script-src 'none'` breaks it. `company-manifest.mjs` builds deterministic manifest bytes from already approved files and hashes but is **not** an authoritative issuer and does not write to the backend. An independently reviewed publisher must atomically bind the manifest hash to the actual current company identity/version, update and revoke it with publication/slug changes, and guarantee immutable read-only roots; release processes must not let arbitrary users choose approved scripts. `company-artifact-store.mjs` refuses traversal/symlinks and bounds reads; it still assumes operator-controlled immutable roots and an ingress concurrency/rate limit.

`serve-shared.mjs` only wires the candidate pieces and binds to loopback. It requires the fixed backend origin, public API key, proposed narrow-role JWT, and absolute immutable profile/binding roots. The referenced backend RPC is absent, so in a correctly configured environment it returns 503 rather than an unverified company page. No real role token is created by this work.

The proposed company CSP allows only explicitly approved script hashes. Real company templates have not all been checked against it; CSS, media, external links, SEO and mobile functionality require company-by-company verification. Existing company files, source, and routing are untouched. Review-erasure P0 remains open; the existing static company HTML can contain reviews and is not cleared for a new deployment by this proposal.

## Race and takedown

The two checks reject a binding changed during static read. They cannot retract bytes already sent, or guarantee that unpublish cannot commit immediately after the last check and before response delivery. A test demonstrates the same in-flight limitation for the specialist path. Production acceptance requires a specifically approved measurable bound and a reviewed concurrency barrier/invalidation design covering in-flight requests, backend read consistency, proxy/CDN caches and restore/PITR. No-cache headers alone are insufficient proof.

## Evidence and limitations

Unit tests cover invalid host/path, forged or malformed binding, unlisted/corrupt bytes, identity/version/digest changes, symlinks and absence of static fallback. `shared-sql-e2e.test.mjs` runs synthetic company→specialist slug reuse, publication, unpublish and erasure against the real PR50 SQL candidates in disposable PGlite plus a privileged TEST-ONLY registry reader and synthetic manifest map. `real-supabase-e2e.mjs` uses the same TEST-ONLY classifier against an isolated actual Supabase stack; neither test implements a secure production classifier, role issuer or artifact-signing process. `company-browser.test.mjs` uses the existing test2 company HTML and CSS from this repo with one test-only approved script hash; this is not proof for all companies.

SQL classifier design was sent for independent audit in Hub REQUEST 5e802609. Until its approval and implementation, and until operator decisions on artifact authority, takedown, public-host trust and staging are recorded, this is NO-GO for deployment. No production SQL, DNS, FirstVDS, Cloudflare or Joomla changes are authorized.
