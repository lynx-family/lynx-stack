---
applyTo: "{packages/rspeedy/create-rspeedy/template-*/**,.github/workflows/test.yml}"
---

Do not add pnpm workspace policy files to `create-rspeedy` templates just to satisfy pnpm 11 smoke tests. Generated projects must stay package-manager-neutral where possible; handle pnpm 11 dependency build approvals inside the temporary CI smoke-test project instead.

For the `test-publish` smoke test, keep the pnpm 11 approval command explicit: allow `esbuild` and deny `core-js`. Do not include packages that are not actually awaiting approval, because `pnpm approve-builds` fails on unknown package names.
