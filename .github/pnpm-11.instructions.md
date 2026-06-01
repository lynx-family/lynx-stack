---
applyTo: "{pnpm-workspace.yaml,**/package.json,.github/renovate.json5}"
---

When upgrading or maintaining pnpm 11, use the `allowBuilds` map in `pnpm-workspace.yaml`; `onlyBuiltDependencies` and `ignoredBuiltDependencies` are pnpm 10-era settings and should not be reintroduced.

When bumping the `packageManager` pnpm version in package.json files, keep the `+sha512.<hex>` suffix aligned with the npm package tarball integrity; convert the `npm view pnpm@<version> dist.integrity` base64 payload to hex for Corepack's strict package-manager pin.

When adding Renovate npm minimum-release-age presets, mirror the delay in pnpm with `minimumReleaseAge` in `pnpm-workspace.yaml`; Renovate delegates lockfile maintenance to the package manager and does not enforce its own minimum release age for those updates.

Do not add broad React or React DOM overrides in `pnpm-workspace.yaml`. Keep workspace React consumers on exact `react` and `react-dom` patch versions, and use scoped package metadata fixes when a tool package such as Rspress needs its internal React dependencies pinned to the same patch; Rspress SSG fails when pnpm resolves `react` and `react-dom` to different patch versions.
