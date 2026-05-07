---
applyTo: ".github/workflows/**/*.yml"
---

When a workflow needs pnpm 11, prefer installing and enabling Corepack after `actions/setup-node` rather than using `pnpm/action-setup@v4`; that action still executes on the GitHub Actions Node 20 runtime and cannot self-install pnpm 11, which requires Node >=22.13.
