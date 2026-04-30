---
applyTo: "packages/web-platform/web-elements/**/*"
---

When updating web element APIs, add targeted Playwright tests in packages/web-platform/web-elements/tests/web-elements.spec.ts and keep changes minimal.
Ensure Playwright browsers are installed (pnpm exec playwright install --with-deps <browser>) before running web-elements tests.
For x-input type="number" in web-elements, keep inner input type as text, set inputmode="decimal", and filter number input internally without setting input-filter explicitly.
Add new web-elements UI fixtures under packages/web-platform/web-elements/tests/fixtures and commit matching snapshots in packages/web-platform/web-elements/tests/web-elements.spec.ts-snapshots.

---
applyTo: "packages/webpack/template-webpack-plugin/**/*"
---

When changing initial CSS handling in template-webpack-plugin, add or update a code-splitting case that asserts the exact selector order in `tasm.json`, not just that CSS assets exist.
Prefer a shared-plus-split initial chunk fixture when validating CSS merge order so the expected rule sequence follows the source import order clearly.

---
applyTo: "packages/rspeedy/plugin-config/**/*"
---

When plugin-config source imports or type-imports workspace packages that are built via TypeScript project references, add the corresponding entries to `tsconfig.build.json` `references`. Do not rely on workspace linking alone for declaration generation, because `rslib build` can fail to resolve sibling package types if the referenced project is not part of the build graph.
