---
applyTo: "{package.json,packages/**/package.json,pnpm-lock.yaml,tsconfig.json,packages/**/tsconfig.json,packages/**/*.d.ts,pnpm-workspace.yaml,patches/**}"
---

When upgrading TypeScript across the workspace, check and update packages that encode the compiler version in peer or transformer compatibility ranges. In particular, keep `ts-blank-space`, `typia`, `typescript-eslint`, and `ts-patch` aligned with the target TypeScript major version, and update `@lynx-js/rspeedy`'s optional `typescript` peer range when its build-time transformer stack supports the new compiler line.

For TypeScript 6 upgrades, keep Rslib/Rspack peer resolution on the repository's cataloged versions unless the whole build stack is being upgraded together. If `@rslib/core` or `rsbuild-plugin-dts` accepts the new compiler but has a stale peer range, prefer scoped `pnpm.peerDependencyRules.allowedVersions` entries over pulling in a newer Rsbuild/Rspack major incidentally.

TypeScript 6 treats deprecated compiler options and side-effect imports more strictly in this repo. Add `ignoreDeprecations: "6.0"` where configs retain `baseUrl`, keep explicit Node ambient types when packages use Node globals or `node:*` imports, and add script-style CSS module declarations for side-effect CSS imports that are meant to type-check.

Rslib declaration generation with TS6 may need explicit `rootDir` for packages that emit declarations from `src`, and API Extractor can fail on global namespace-only public types. In public `.d.ts` files, prefer explicit `import type` declarations for externally-owned namespaces such as `React` so declaration bundlers can follow the symbol graph.

`typia-rspack-plugin@2.2.2` imports `typia/lib/transform.js`, which is not exported by Typia 12. If the plugin has not released a compatible version, carry a pnpm patch that changes the import to `typia/lib/transform`.

After upgrading TypeScript plus transformer/runtime dependencies, hook runtime failures in testing-library examples such as `Cannot read properties of undefined (reading '__H')` can come from stale installed artifacts. Before changing React/testing-library runtime code for that symptom, delete `node_modules`, run `pnpm install --frozen-lockfile`, then run a full `pnpm turbo build` and retry the focused test.
