# Shared route trust and takedown: review proposal, not implemented

This is a design for independent review, not an approved SQL contract or a deployment instruction. Current classifier and manifest are test fixtures. Existing route and company profiles remain unchanged.

## Authority and publication

* One authoritative primary must resolve a canonical slug to a unique live profile kind and immutable profile ID, or to a non-public result. Read replicas and caches must not be used to authorize a response unless their invalidation and consistency are proven equivalent.
* Company output must be bound to that ID, a monotonic publication generation and digest of a complete manifest. A separate privileged publisher computes the digest from a frozen artifact, reviews its inline-script hashes, and atomically registers the exact binding against the currently active company and its slug. Callers cannot choose a company ID, generation, digest, or CSP approvals through the public API.
* Review must establish publisher authentication, authority to approve scripts, credential rotation/revocation, immutable artifact storage, CAS/idempotency, rollback, and audit. No role or token is specified by this proposal; unverified claim text is not identity.
* Lifecycle transitions, ownership/type changes, unpublish, suspension, erasure and slug reassignment must invalidate the binding transactionally. Serialization and a generation that cannot be reused prevent an old manifest from becoming valid again. Independently review restore/PITR and external artifact deletion; a database restore can resurrect an old pointer unless fenced by a durable authority outside the restore domain.
* Public responses must fail closed if identity, state, binding, content, or current authority cannot be verified. No fallback to an old static profile is allowed. Approval and implementation of company binding must preserve existing company pages and existing company slug semantics.

## In-flight race and possible guarantees

The current two checks do not form a transaction with network delivery: after the last check, erasure may commit before the response is sent. No mechanism can recall bytes already delivered to a visitor. `no-store` cannot establish a bound on in-flight work or on a misconfigured intermediary.

1. **Fresh read only.** Queries accepted after the transaction commits consult an authoritative primary; requests already running may complete later. Simple, but neither their duration nor post-commit delivery is bounded without timeouts and network controls.
2. **Bounded drain with admission gate.** Mark the profile as closing, deny new readers, track existing readers at every serving instance, cancel or drain them, then commit or acknowledge the transition. Requires coordinated admission, process crash handling, bounded waits, fencing, and control of all origins and intermediaries. Already delivered bytes remain outside the guarantee.
3. **Lease/fencing protocol.** Short-lived read leases or versioned tokens permit bounded serving; disable waits for lease expiry plus a verified safety margin. Requires a trusted time source, bounded clock skew, renewal rules, partitions and fail-closed behavior. It gives a measurable delay, not instantaneous revocation.

Recommendation for evaluation: option 2 for a strict operational takedown gate, or option 3 where an explicit measurable delay is acceptable. Neither is accepted until the owner specifies the guarantee and independent review verifies enforcement across every origin, cache, CDN and failure mode. Requests timing out, server crashes, orphaned readers and partitions must not silently make the gate fail open. Do not hold a database lock across unbounded client network writes.

## Acceptance evidence for a future implementation

Use two real isolated owners, both profile kinds and concurrent sessions; test delete/reuse while reading, unpublish/republish, suspension, type collision, replay, stale artifact or CSP hashes, issuer impersonation, forged identity, inaccessible primary, transaction rollback and backup restore fencing. Verify all writer paths and lock ordering, least privilege and signed identity at the backend, and use the existing company regression suite. Measure the selected takedown bound at the actual HTTPS ingress with slow readers, multiple instances and every enabled intermediary. No production or hosted execution is authorized by this document.
