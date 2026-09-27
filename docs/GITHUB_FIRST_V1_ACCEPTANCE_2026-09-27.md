# GitHub-first v1 acceptance

Date: 2026-09-27

## Status

**ACCEPTED — GitHub-first public-profile stage is functionally complete.**

Current production candidate path:

`Supabase canonical data -> authenticated automatic publish emitter -> GitHub repository_dispatch -> renderer/validation -> committed static artifacts -> GitHub Pages`.

GitHub Pages is the current hosting adapter. Jino/VPS remains a contingency only; no migration is part of this stage.

## Control profiles

- `student-agency`
- `ortomediya` (display name: `Ортопедия`)

Both have the required generated artifact set:

- `index.html`
- `profile.css`
- `profile.json`
- `profile.md`
- `llms.txt`
- local published media under `media/`

## Automatic publication evidence

The real owner/editor path was proven end-to-end on Ortomediya:

1. account/editor saved a temporary company-name change;
2. Supabase emitted the publish request;
3. GitHub repository_dispatch run #13 / `36328848145` succeeded;
4. publication commit `7f814bda3c86a38b2aa406db13bde86944bef1e1` contained the changed name;
5. owner reverted the test change in the account/editor;
6. automatic run #14 / `36328986232` succeeded;
7. publication commit `e8bd2650206473591e286a211f5930265278ec7d` restored canonical display name `Ортопедия`.

Manual workflow dispatch remains an admin/recovery path, not the normal owner publication path.

## Accepted profile behavior

The generated profile package includes the accepted header/navigation, media gallery/lightbox with previous/next and keyboard navigation, source ratings, locations, services, first-party reviews/company responses when data exist, SEO/structured metadata, and machine-readable JSON/Markdown/llms.txt outputs.

The private Supabase media bucket remains private; approved published media are copied into the static profile during publication.

## Architecture boundary

Do not reintroduce Cloudflare Worker rendering into the GitHub-first profile path. The generated static profile is the publication artifact. Hosting portability files may remain as contingency documentation, but the active hosting target for this stage is GitHub Pages.

Do not churn accepted profile cosmetics.

## Known hardening caveat

The current database emitter forwards the authenticated request JWT to the Edge Function. The real account/editor path is proven, but background/service database writes without authenticated request context can skip dispatch. The Edge Function also does not yet enforce company membership for an authenticated caller supplying another valid slug. These are future hardening items; they do not invalidate the proven owner/editor publication path.

## Stage conclusion

No further profile-generator or hosting work is required for the GitHub-first v1 stage unless a regression is found.

Next workstream should concern product-level completion (for example account/editor data quality, review lifecycle, subscription behavior, or eventual public-domain routing) and must not silently replace this accepted publication path.
