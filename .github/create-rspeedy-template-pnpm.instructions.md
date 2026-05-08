---
applyTo: "{packages/rspeedy/create-rspeedy/template-*/**,.github/workflows/test.yml}"
---

Do not add pnpm workspace policy files to `create-rspeedy` templates just to satisfy pnpm 11 smoke tests. Generated projects must stay package-manager-neutral where possible; handle pnpm 11 dependency build approvals inside the temporary CI smoke-test project instead.
