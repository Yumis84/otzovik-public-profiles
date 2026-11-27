# Company generator integration candidate

Branch `work1/company-publisher-completion-20261127`; companion SQL/test package in otzovik-company-profile `work1/company-final-20261127`, sql/candidates/company-publication.

The existing renderer keeps its styling and now honors rating_scale, unknown counts versus explicit numeric zero, and canonical author/response.statement/program_label fields. No generated live profiles are changed.

`company-publication-worker.py` is loopback-only integration tooling: it claims a DB snapshot, validates completeness, sanitizes media, runs the original renderer, verifies exact JSON identity, hashes/readbacks the file manifest and atomically records proof plus finalization. The trusted DB owns publication authority; a failed/stale/expired build cannot publish. No jobs, secrets or production access are installed.

`company-publication-media.py` supports the fixed salmcnhexlftrgtiryyo staging Storage origin only, with redirects denied, 5 MB/16 MP/single-frame caps, company-scoped paths, image decode/reencode and metadata stripping. A key is read from OTZOVIK_STAGING_MEDIA_KEY only when an operator runs the CLI. Tests inject synthetic download bytes; hosted download is not claimed.

`company-publication-preview.py` binds only 127.0.0.1 and serves /company/<slug>/ verified immutable revisions. Every request checks DB readability and file hashes. It is local acceptance tooling, not a publicly deployed server. Suspended/stale profiles return 404; corrupted artifacts return 503. No-store/nosniff/noindex headers apply.

Run `python tests/company-publication-generator.py` with Pillow. The companion PG17 integration test exercises positive/negative DB-to-renderer-to-photo-to-HTTP publication and rollback. Production, profile output folders, main, workflows and hosting remain unchanged. Independent audit and hosted rollout are still required.
