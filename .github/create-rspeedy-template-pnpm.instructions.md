---
applyTo: "packages/rspeedy/create-rspeedy/template-common/pnpm-workspace.yaml"
---

Keep generated Rspeedy apps on pnpm 11's explicit dependency build policy. The template workspace file should mirror the root `allowBuilds` decisions for common toolchain dependencies, including intentionally ignored packages such as `core-js` and intentionally allowed packages such as `esbuild`, so `pnpm install` in CI does not fail with `ERR_PNPM_IGNORED_BUILDS`.
