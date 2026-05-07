---
applyTo: "packages/rspeedy/create-rspeedy/template-common/pnpm-workspace.yaml"
---

Keep generated Rspeedy apps on pnpm 11's explicit dependency build policy. The template workspace file should intentionally ignore `core-js` builds so `pnpm install` in CI does not fail with `ERR_PNPM_IGNORED_BUILDS`.
