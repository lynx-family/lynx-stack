---
applyTo: "pnpm-workspace.yaml"
---

When upgrading or maintaining pnpm 11, use the `allowBuilds` map in `pnpm-workspace.yaml`; `onlyBuiltDependencies` and `ignoredBuiltDependencies` are pnpm 10-era settings and should not be reintroduced.
