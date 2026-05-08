---
applyTo: "{packages/rspeedy/create-rspeedy/template-*/**,.github/workflows/test.yml}"
---

Do not add pnpm workspace policy files to `create-rspeedy` templates just to satisfy pnpm 11 smoke tests. Generated projects must stay package-manager-neutral where possible; write CI-local pnpm build policy inside the temporary smoke-test project before running `pnpm install`.

For the `test-publish` smoke test, keep the temporary pnpm 11 policy explicit: allow `esbuild` and deny `core-js`. This keeps the smoke test focused on published package/template usability instead of testing pnpm's approval failure-and-retry flow.
