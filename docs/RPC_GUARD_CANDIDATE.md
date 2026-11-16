# RPC guard — isolated non-SQL candidate

`rpc-guard-candidate.mjs` is a review-only wrapper, not wired into the shared
router. It has global in-flight bounds, fail-closed saturation, a timeout
with abort propagation, a consecutive-failure circuit breaker, one half-open
probe, and fixed aggregate counters. No slug cache, per-client identity,
backend credential, real quotas, logging or production settings are added.
In-flight permits are retained until the actual backend operation settles,
even when it ignores cancellation; this bounds hidden work but can exhaust
capacity and needs operational monitoring/recovery.

Defaults are test values, not approved production limits. The breaker is
process-local: multiple instances, trusted time, cancellation propagation,
distributed quotas, ingress rate limits and alerting require design and
independent review. Counts do not include user identifiers or inputs. Never
serve a stale value when the breaker opens or substitute synthetic success.
