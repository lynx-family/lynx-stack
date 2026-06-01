---
applyTo: "{package.json,packages/**/package.json,pnpm-workspace.yaml,.meta-updater/main.mjs,.github/workflows/*.yml}"
---

Use `@pnpm/meta-updater` for workspace package metadata consistency checks. Keep repository metadata generation in `.meta-updater/main.mjs`, and wire CI checks through `meta-updater --test` instead of duplicating workspace package discovery in custom scripts.
