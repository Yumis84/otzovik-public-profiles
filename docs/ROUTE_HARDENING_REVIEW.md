# Shared route hardening — isolated candidate

The artifact reader allocates the open file's reported size plus one sentinel
byte and rejects short reads and growth. Same-size concurrent modification is
not detected by size alone: the router must verify the manifest and content
digests, and the deployed roots must remain immutable and operator controlled.
The existing path checks do not protect against a privileged attacker swapping
ancestor directories between checks and open.

The loopback listener applies configurable response inactivity timeout,
maxConnections, and an active-handler limit. Defaults (15 seconds, 64
connections, 32 active handlers) are conservative **test defaults**, not
measured production sizing or an approved takedown SLA. A rejected handler
gets a small no-store 503; excess TCP connections can instead be dropped by
Node. Slots remain held until both the handler has settled and the response
has closed or finished; a noncooperative dependency can exhaust capacity.
Timeout closes idle sockets, but a client continuously consuming small
amounts can keep a response alive indefinitely: this is **not a total
response deadline or takedown bound**. Ingress per-client rate/concurrency
limits, bounded downloads, fair queueing, and deployment testing are needed.

## Classifier load proposal — not implemented

Two fresh classifier calls per company asset preserve the current recheck.
Before deployment, measure backend latency and maximum asset concurrency;
consider bounded in-flight classifier requests, per-ingress quotas, and a
short-lived circuit breaker which returns 503 on dependency failure without
serving stale state. No negative cache is enabled. Any cache/lease TTL,
classification semantics and transition atomicity require owner approval and
independent audit; do not use a cached company binding to bypass a fresh
authoritative read. Metrics should report aggregate bounded counters for
timeouts, overload and upstream failures without tokens, raw Host, user IDs,
full slugs or unbounded labels. Persisted route decisions and key-revocation
evidence require a separately reviewed audit architecture.

Remaining review items: token identity/expiry/rotation, issuer trust and
signing-key validity, immutable-root and hardlink checks, narrower company CSP
and a consistent Referrer-Policy, operator audit logging, in-flight semantics,
all existing profile templates, and real HTTPS/proxy testing. Static CSP
checks with three actual HTML/CSS files are not browser behavior tests.
Local TCP slow-reader and saturation tests run in this environment. Browser
behavior remains unverified here because Chromium's sandbox cannot create its
required socket; a suitable isolated browser runner is still needed. No SQL,
hosted infrastructure or deployment is authorized by this document.
