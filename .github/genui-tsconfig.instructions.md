---
applyTo: "packages/genui/**/*"
---

When adding a new package under `packages/genui`, add a package-level `tsconfig.json` and wire it into `packages/genui/tsconfig.json` references in the same change. Root type-aware ESLint uses the TypeScript project service, so new GenUI source files that are not reachable from those references will fail pre-commit parsing before code linting even starts.
