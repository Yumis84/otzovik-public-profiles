# Public media publication contract

Public profile images are build artifacts, not direct links to private Supabase Storage objects.

## Rule

Only media explicitly marked `approved: true` may be copied into:

`profiles/<slug>/media/`

The generated public manifest is:

`profiles/<slug>/media.json`

Private bucket names, object paths, signed URLs, service-role credentials, moderation fields and unapproved media must not be committed.

## Input manifest

Example:

```json
[
  {
    "file": "logo.webp",
    "type": "logo",
    "approved": true,
    "alt": "Company logo",
    "caption": null
  }
]
```

Allowed types: logo, cover, interior, exterior, products, team, gallery.
Allowed extensions: jpg, jpeg, png, webp, avif.

## Intended pipeline

Supabase private Storage -> privileged publisher -> approval filter -> copy approved bytes -> public build -> GitHub Pages.

The privileged publisher belongs outside this public repository. This repository contains only the deterministic copy/validation stage and public output.
