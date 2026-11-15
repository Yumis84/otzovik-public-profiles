# Proposed persistent synthetic HTTPS staging — approval required

Status: plan only, 15 November 2026. No account, service, Supabase project, DNS or server configuration was created or changed. Do not deploy before independent review of the routing authority and explicit owner permission.

## Exact proposed resources and cost ceiling

1. One **Render Free Web Service** on the provider-issued `*.onrender.com` HTTPS hostname, Node 24, 512 MB RAM, one instance, $0/month compute. Do not add paid compute, paid disk, custom domain or paid add-ons. Render Free services spin down after 15 idle minutes, restart can take about a minute, have 750 shared free instance-hours/month and an ephemeral filesystem. Build time and bandwidth are shared with the account; overages can be billed if a payment method is attached. Check the actual account and set a $0 spend limit or no payment method; if this cannot be guaranteed, do not create the service. Official sources: https://render.com/docs/free and https://render.com/pricing .
2. One **separate Supabase Free project** dedicated to synthetic OTZOVIK staging, $0/month within free quotas, 500 MB database, 1 GB object storage, at most two active Free projects per account. Confirm an available free slot and no existing paid organization or charges before creation. A free project may pause after seven days of inactivity, so this is a stable URL but **not guaranteed always-on availability**. Official sources: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/free-project-pausing .
3. Planned total: **$0/month**, subject to confirmed free quotas and zero overage liability. Do not proceed if either resource is unavailable for $0 or if billing/spend protection cannot be verified. No paid fallback is approved.

## Access and isolation

Use separate synthetic accounts, API keys, database, storage bucket and short-lived narrow route identity from an independently audited issuer. No production Supabase, real people, company data, production secrets, service-role credential in browser, DNS, FirstVDS, Cloudflare or Joomla. The database and operator credentials remain server-side; the provider-issued HTTPS hostname avoids domain/DNS changes.

Render requires a listener on its externally routed port; the existing loopback-only adapter must stay behind a small **staging-only** ingress process. That ingress would bind `0.0.0.0:$PORT`, enforce authenticated test access and a fixed route such as `/demo/specialist`, rewrite it to `/` with one fixed synthetic `Host: demo-specialist.xn--b1ajuq0c.com`, and forward only to the loopback adapter. It must strip client Host/forwarding headers, use no-store end-to-end, and never map arbitrary public hostnames to companies. Do not create the wrapper or open ingress until its authentication, secret provisioning and rate limiting are reviewed. The provider URL proves the test flow only; it does **not** validate production wildcard DNS/TLS, company routing or zero-latency takedown.

## Preconditions and verification

- Resolve the shared classifier/manifest issuer and in-flight policy through Claude and owner decisions; current classifier is a contract prototype with no trusted backend implementation.
- Confirm isolated project quotas, account identity, spend cap and who can administer/visit the test service; obtain explicit owner authorization for both resources.
- Apply only reviewed candidate SQL in that new synthetic project, after separate permission for hosted SQL; use a narrowly scoped signed route identity, controlled expiry/revocation and a fixed backend origin. Keep public control disabled except explicitly approved synthetic tests.
- Verify login with two synthetic owners; publish, view, unpublish, republish, suspend, erasure, route-bound company generation and slug reuse; check CSP/no-store through actual HTTPS, 320/390/768/1280/1440, rollback and browser E2E. Confirm no stale static company fallback. Delete or pause the environment on the agreed expiry.

This plan does not itself authorize resource creation, SQL, enabling public projection, production deployment or paid usage. Prices and limits are provider-published snapshots and should be rechecked immediately before any approval.
