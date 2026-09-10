---
applyTo: "{.github/actions/**/*.yml,.github/workflows/**/*.yml}"
---

When a workflow needs pnpm 11, prefer installing and enabling Corepack after `actions/setup-node` rather than using `pnpm/action-setup@v4`; that action still executes on the GitHub Actions Node 20 runtime and cannot self-install pnpm 11, which requires Node >=22.13.

Pin the Corepack version in CI instead of installing `corepack@latest`; upgrade it deliberately alongside the repository's package-manager pin.

Cache both `pnpm store path` and `pnpm cache path`. Include OS, architecture, Node version, package-manager declaration, and lockfile content in the cache key so native packages and pnpm metadata are not shared across incompatible toolchains.

Run `pnpm dedupe --check --lockfile-only` and `pnpm peers check --lockfile-only` together as lockfile quality gates; the checks should not depend on or modify `node_modules`.
