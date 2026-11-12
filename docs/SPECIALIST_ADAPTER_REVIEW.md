# Specialist public adapter — review candidate, NO-GO for production

This adapter is part of the existing public-profiles repository; no existing generated company file or routing is modified. It serves **only** requests already assigned to the specialist route by a trusted, fail-closed routing layer. No such integrated routing layer is supplied or deployed in this change. Do not expose the adapter or configure a wildcard proxy before independent review and an owner-approved deployment.

## Contract

The local service accepts GET/HEAD on `/` and `/index.html`. It derives a slug solely from exactly one canonical Host header under `*.xn--b1ajuq0c.com`, rejects nested labels, ports, `--`, unrecognised hosts, other paths and methods. Forwarded headers are ignored. For every accepted request it calls the fixed configured `get_public_specialist_v1` RPC anew using a public anon/publishable key; redirects, non-200, malformed/oversized data, timeout, wrong slug or any extra field fail closed. `null` is 404; upstream/config failure is 503. It emits only the six-field v1 allowlist, escapes text, emits CSP and no-store headers, and has no static fallback. There is no review, photo, contact field, storage path or owner identifier. A description can voluntarily contain contact details.

`runtime/serve-specialist.mjs` binds only to loopback and requires `OTZOVIK_BACKEND_ORIGIN` (fixed HTTPS origin) and `OTZOVIK_PUBLIC_ANON_KEY` (anon JWT or publishable key, never service-role). `OTZOVIK_ADAPTER_PORT` defaults to 4174. Startup configuration must be restricted to a reviewed backend endpoint; egress, DNS and TLS must be controlled by the deployment. Do not pass user input as the backend origin. Local HTTP backend is available only to injected test instances, not the service entry point.

## Routing and takedown constraints

A null specialist result is intentionally indistinguishable between nonexistent, draft, suspended, unpublished and erased. **Never use null, a timeout, or any error as permission to serve a static fallback**. Existing company artifacts are static and must be delegated to their existing path unchanged only after an authoritative, race-safe company/specialist classification is designed and independently reviewed. An allowlist alone can go stale after slug reuse; trusting client-supplied forwarding headers is unacceptable. Until that problem is solved the combined wildcard route is BLOCKED. See Claude audit request 5e802609. Rollback must not replace this block with unsafe static fallback.

No-store must be enforced by every proxy/CDN and verified on actual responses and errors. On fail-closed backend errors the adapter deliberately returns 503, never cached HTML. A request already in flight before unpublish or erasure commits may still deliver data retrieved before that commit; no server can retract bytes already delivered. A strict zero-lag takedown claim requires an approved end-to-end concurrency/in-flight policy and measured acceptance threshold, not just HTTP no-store.

The backend projection itself, slug quarantine, account erasure ledger, trusted role, review-erasure P0, trust in FirstVDS, TLS, trusted ingress, DNS and external caches are not accepted by these tests. No production GO, persistent test URL, hosted resource, deploy, DNS or server changes are implied.

## Tests

`node --test tests/specialist-public.test.mjs tests/http-isolated.test.mjs` runs synthetic mock and real loopback HTTP checks. `OTZOVIK_CABINET_ROOT=/path/to/otzovik-company-profile node --test tests/sql-projection-isolated.test.mjs` additionally loads exact local candidate SQL into disposable PGlite and tests publish -> page -> unpublish -> republish -> erasure. The SQL test simulates PostgREST and uses synthetic identities; it is not a full real Supabase/Auth/Storage E2E. GitHub Actions checks out PR #50 at a pinned SHA and runs these only in disposable CI. An independent audit and real-stack/browser tests remain mandatory.
