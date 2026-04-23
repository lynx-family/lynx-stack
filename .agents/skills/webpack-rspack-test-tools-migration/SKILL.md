---
name: webpack-rspack-test-tools-migration
description: Use this skill when a webpack plugin package is already running on rstest and you need to migrate test helpers from @lynx-js/test-tools to @rspack/test-tools.
---

# webpack `@lynx-js/test-tools` to `@rspack/test-tools` Migration

Use this skill to migrate webpack plugin test helpers in `packages/webpack/` from `@lynx-js/test-tools` to `@rspack/test-tools` after the package is already on `rstest`.

## When to use

- The package lives under `packages/webpack/`.
- The package's tests already run with `rstest`.
- The remaining migration step is replacing `@lynx-js/test-tools` with `@rspack/test-tools`.
- Do not use this skill for Vitest-to-Rstest migration work.

## Preconditions

- The package already has `rstest.config.ts`.
- The package can run at least one focused `rstest` command.
- If config fixtures depend on package-local `lib/` outputs, verify those build artifacts already exist before running the migrated tests.

## Migration Checklist

1. Replace each case entry import from `@lynx-js/test-tools` with the matching `@rspack/test-tools` entrypoint instead of keeping compatibility aliases.
2. If the package still wires config cases through legacy entrypoints, make sure the migrated helper swap happens in the package's active config-case entry rather than splitting coverage across old and new runners.
3. Keep `rstest.config.ts` aligned with `@rspack/test-tools` expectations. Verify `setupFiles` still point at the correct helpers and preserve required environment values such as `__TEST_PATH__` and `__TEST_DIST_PATH__` when the package relies on them.
4. If the package needs a newer patched `@rspack/test-tools` for rstest support than the shared `catalog:rspack` version provides, pin that package's `package.json` to the exact version directly instead of changing the shared catalog entry. Reuse an existing local pattern such as `packages/webpack/cache-events-webpack-plugin` pinning `@rspack/test-tools` to `1.7.9`.
5. If the migrated `@rspack/test-tools` runner in that package looks for `test.config.js`, rename legacy `test.config.cjs` helpers to `test.config.js` and update their exports to match the loader it actually uses.
6. In config cases, replace legacy `bundlePath` assumptions with `findBundle()` lookups before asserting on emitted assets.
7. If config fixtures import the local plugin build output, keep those imports explicit and ESM-safe, for example `../../../../lib/index.js`.
8. Preserve explicit output naming when chunk splitting is involved. If the old test depended on stable chunk names, keep patterns such as `[name].js`; removing them can collapse emitted assets back onto `bundle.js`.
9. Update lazy-bundle mocked async chunk payloads to match the real generated chunk id, module key, and required runtime helpers when the migrated runtime no longer tolerates shorthand mocks.

## Validation Checklist

- Run the package's focused `rstest` command for migrated cases before broadening scope.
- If the package previously relied on legacy config-case entrypoints, confirm the migrated helper swap is happening through the package's active config-case entrypoint and that obsolete legacy coverage no longer hides missing assertions.
- Verify `rstest.config.ts` still injects any needed setup files and environment variables, including `__TEST_PATH__` and `__TEST_DIST_PATH__` where applicable.
- If the package needed newer rstest support from `@rspack/test-tools`, verify only that package is pinned to the required version and the shared `catalog:rspack` entry was left unchanged.
- Check renamed config fixtures resolve through `test.config.js` without CommonJS fallback behavior.
- Re-run config-case assertions that read emitted files and confirm they use `findBundle()` instead of hard-coded bundle paths.
- Inspect chunk-splitting fixtures to confirm explicit output names still preserve separate assets rather than regressing to `bundle.js`.
- Re-run lazy-bundle scenarios and verify the mocked async chunk payload still matches the runtime shape consumed by the migrated helpers.

## Common Failure Modes

- Importing the top-level `@rspack/test-tools` package when the old test depended on a more specific entrypoint. This usually fails as missing helpers or mismatched harness behavior.
- Leaving config cases under `test/cases/**` while also introducing `test/configCases/**`, which can split coverage across two runners and hide missing assertions.
- Updating helpers without updating `rstest.config.ts`, especially when `setupFiles`, `__TEST_PATH__`, or `__TEST_DIST_PATH__` were previously injected indirectly.
- Bumping the shared `catalog:rspack` version just to unblock one package's rstest migration, which can accidentally change unrelated webpack packages; pin that package's `package.json` directly instead.
- Renaming fixture logic but leaving the file as `test.config.cjs`, causing the migrated loader path to miss the config file.
- Keeping hard-coded `bundlePath` usage after migration, which breaks when emitted asset names or directories shift; use `findBundle()` instead.
- Removing explicit output filenames from chunk-splitting tests and accidentally collapsing multiple assets back to `bundle.js`.
- Copying old lazy-bundle mocks unchanged even though the generated async chunk now expects the real chunk id, module key, or extra runtime helpers.

## Minimal Examples

Basic `test.config.js` helper when the runner looks for `test.config.js`:

```js
export function findBundle() {
  return 'main.js';
}

export function beforeExecute() {
  global.lynxCoreInject = {
    tt: {},
  };
}
```

Package-local `@rspack/test-tools` pin when only one webpack package needs newer rstest support:

```json
{
  "devDependencies": {
    "@rspack/test-tools": "1.7.9"
  }
}
```

Prefer this local pin over changing the shared `catalog:rspack` version when the migration only affects one package.

Lazy-bundle mock chunk payload:

```js
function lazyComponent() {
  return null;
}

export function findBundle() {
  return 'main.js';
}

export function beforeExecute() {
  const chunkId = '<lazy-chunk-id-from-emitted-output>';
  const moduleKey = '<lazy-module-key-from-emitted-output>';

  global.lynxCoreInject = {
    tt: {},
  };
  global.lynx = {
    requireModuleAsync: (_request, callback) => {
      callback(null, {
        ids: [chunkId],
        modules: {
          [moduleKey]: function(
            __unused_webpack___webpack_module__,
            __webpack_exports__,
            __webpack_require__,
          ) {
            __webpack_require__.r(__webpack_exports__);
            __webpack_require__.d(__webpack_exports__, {
              default: () => __WEBPACK_DEFAULT_EXPORT__,
            });
            const __WEBPACK_DEFAULT_EXPORT__ = lazyComponent;
          },
        },
        runtime: (__webpack_require__) => {
          __webpack_require__.r = (exports) => {
            if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
              Object.defineProperty(exports, Symbol.toStringTag, {
                value: 'Module',
              });
            }
            Object.defineProperty(exports, '__esModule', { value: true });
          };
        },
      });
    },
  };
}
```

Derive `chunkId` and `moduleKey` from the emitted files under `test/js/...` instead of copying literal values from another package.

## Out of Scope

- Migrating a package from Vitest or Jest to `rstest`; use the dedicated rstest migration workflow first.
- Converting package source, build output, or fixture code between CommonJS and ESM beyond the minimal config-loader compatibility this migration requires.
- Documenting temporary local patches used only to get a package's ESM config loading during one-off investigation.
- Rewriting unrelated webpack or rspack assertions that are already passing under the current package test harness.
