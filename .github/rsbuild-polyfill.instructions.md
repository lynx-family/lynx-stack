---
applyTo: "{package.json,pnpm-lock.yaml,rstest.config.ts,packages/web-platform/web-rsbuild-plugin/**/*}"
---

When root Rstest runs exercise Rsbuild configs with `output.polyfill: "usage"`, keep `core-js` resolvable from the repository root. Rsbuild resolves `core-js` from `api.context.rootPath`, which is the repo root for `pnpm exec rstest run -c rstest.config.ts`; do not rely on unrelated workspace package devDependencies to provide it indirectly.
