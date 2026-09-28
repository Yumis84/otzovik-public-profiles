# Hosting-neutral deployment

The generated `profiles/` tree is the deployable public artifact for Отзыв.com.

## Contract

A hosting adapter MUST publish the repository paths without changing their contents:

- `profiles/<slug>/index.html`
- `profiles/<slug>/profile.css`
- `profiles/<slug>/profile.json`
- `profiles/<slug>/profile.md`
- `profiles/<slug>/llms.txt`
- `profiles/<slug>/media/*`

The canonical company data remains in Supabase. GitHub is a build/versioning adapter, not a runtime requirement.

## Host mapping

For a request to `https://<slug>.отзыв.com/<path>`, the web server maps:

- `/` -> `profiles/<slug>/index.html`
- `/<path>` -> `profiles/<slug>/<path>`

Unknown slugs and missing files return HTTP 404. Directory traversal must be impossible.

## Nginx example

See `deploy/nginx/otzovik-profiles.conf.example`.

The example is intentionally server-agnostic. Replace `/srv/otzovik-public-profiles` with the actual release path and provision TLS using the chosen host/provider.

## Release model

Deploy the complete generated tree atomically where possible. Do not render company data on the web server. A later Jino/VPS adapter may sync the same tree via SSH/rsync/SFTP without changing the renderer.


## Apex discovery contract

The portable hosting release also contains discovery artifacts at its release root:

- `sitemap.xml`
- `robots.txt`
- `manifest.json`

A hosting adapter that serves the canonical apex host `xn--b1ajuq0c.com` SHOULD expose:

- `https://xn--b1ajuq0c.com/sitemap.xml` -> release-root `sitemap.xml`
- `https://xn--b1ajuq0c.com/robots.txt` -> release-root `robots.txt`

This apex mapping is separate from wildcard company-host routing. Do not map apex requests into `profiles/<slug>/`, and do not change the existing `<slug>.xn--b1ajuq0c.com` contract.

The current repository/Pages tree does not itself deploy these generated release-root files. A provider-specific apex adapter must be activated and HTTP-verified before canonical discovery is considered live.
