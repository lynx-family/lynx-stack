---
applyTo: "{packages/**/package.json,pnpm-workspace.yaml,packages/rspeedy/upgrade-rspeedy/**}"
---

When adding a publishable `@lynx-js/*` workspace package, add it to `upgrade-rspeedy`'s devDependencies with `workspace:*` and update the lockfile importer. The CLI derives its upgrade targets from these dependencies, and `test/coverage.test.ts` verifies every published Lynx package is covered. Keep that coverage test enabled rather than excluding new public packages.
