---
applyTo: "{pnpm-workspace.yaml,**/package.json,.github/renovate.json5}"
---

When upgrading or maintaining pnpm 11, use the `allowBuilds` map in `pnpm-workspace.yaml`; `onlyBuiltDependencies` and `ignoredBuiltDependencies` are pnpm 10-era settings and should not be reintroduced.

For pnpm 11, keep project settings in `pnpm-workspace.yaml`, not in the `pnpm` field of `package.json` or non-auth `.npmrc` keys. For example, migrate `peerDependencyRules`, `engineStrict`, `strictPeerDependencies`, `hoistWorkspacePackages`, and `publicHoistPattern` into `pnpm-workspace.yaml`; leave `.npmrc` for registry/auth settings.

When enabling `strictPeerDependencies`, keep known compatibility exceptions in `peerDependencyRules.allowedVersions` in `pnpm-workspace.yaml`; do not disable strict peer checks or move peer settings back into `package.json`/`.npmrc` to hide published packages whose peer ranges lag the versions used by this workspace.

When bumping the `packageManager` pnpm version in package.json files, keep the `+sha512.<hex>` suffix aligned with the npm package tarball integrity; convert the `npm view pnpm@<version> dist.integrity` base64 payload to hex for Corepack's strict package-manager pin.

Do not use pnpm's deprecated `$` version references in overrides. Define the shared version in a catalog and reference it with `catalog:` or `catalog:<name>` from both dependency declarations and overrides.

Do not add `ignorePatchFailures`; pnpm 11 removed the setting and always fails when a configured patch cannot be applied.

Keep `minimumReleaseAgeStrict` enabled when the repository configures `minimumReleaseAge`. Use `minimumReleaseAgeIgnoreMissingTime` to handle registries that omit publish times; disabling strict mode instead permits packages younger than the configured age when no mature version matches.

When adding Renovate npm minimum-release-age presets, mirror the delay in pnpm with `minimumReleaseAge` in `pnpm-workspace.yaml`; Renovate delegates lockfile maintenance to the package manager and does not enforce its own minimum release age for those updates.

Do not add broad React or React DOM overrides in `pnpm-workspace.yaml`. Keep workspace React consumers on exact `react` and `react-dom` patch versions, and use scoped package metadata fixes when a tool package such as Rspress needs its internal React dependencies pinned to the same patch; Rspress SSG fails when pnpm resolves `react` and `react-dom` to different patch versions.

When a tool's internal package imports TypeScript without declaring it, add an exact TypeScript dependency through a version-scoped `packageExtensions` entry. Do not override TypeScript globally, because tools such as `ts-blank-space` intentionally require an older TypeScript version.
