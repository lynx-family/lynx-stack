// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Internal to this package's own `rstest.config.ts` / `rstest.3.1.config.ts`.
// NOT exported from any public entry point: an ordinary Rstest consumer of
// `@lynx-js/react/testing-library` configures through `withDefaultConfig` /
// `withLynxConfig` alone (see the docs), and needs neither this file nor a
// bundler plugin of its own — that already covers hook-only and JSX-rendering
// test suites (verified directly: `packages/motion`, `packages/lynx/
// gesture-runtime` and `packages/use-sync-external-store` all pass with bare
// `withDefaultConfig()`).
//
// This package's OWN test suite is different: `src/__tests__/worklet.test.jsx`
// and the cross-slot patch assertions in `src/__tests__/slot-jsx.test.jsx`
// inspect the exact snapshot/patch codegen ReactLynx produces, and worklets
// (`main-thread:bindtap={... 'main thread' ...}`) only exist as a compile-time
// construct. Neither works through plain JSX-pragma compilation, and building
// the way a real Lynx app does (`pluginReactLynx`, which is what `withLynxConfig`
// or a hand-wired plugin would give here) splits the main and background
// threads into separate layers and produces different codegen than the
// dual-thread jsdom environment this library's `render()` expects — confirmed
// by running this suite through bare `pluginReactLynx()`, which mismatches
// exactly those patch-shape assertions. `mode: 'test'` with a `MIXED` target
// (one bundle driving both threads) is what the Vitest plugin
// (`src/plugins/vitest.ts`) already uses for the same reason; this mirrors it
// for Rstest.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RsbuildPlugin } from '@rsbuild/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export interface ReactLynxSelfTestTransformOptions {
  /** @defaultValue `''` */
  engineVersion?: string;
}

export function reactLynxSelfTestTransform(
  projectRoot: string,
  options?: ReactLynxSelfTestTransformOptions,
): RsbuildPlugin {
  const runtimePkgName = '@lynx-js/react';

  return {
    name: 'lynx:reactlynx-testing-library:self-test-transform',
    setup(api) {
      api.transform(
        { test: /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/, order: 'pre' },
        ({ code, resourcePath }) => {
          const { transformReactLynxSync } = require(
            '@lynx-js/react/transform',
          ) as typeof import('@lynx-js/react/transform');

          // Snapshot and worklet ids are derived from this path, so it has
          // to stay relative to the project root — exactly as the Vitest
          // plugin derives it from `config.root`.
          const relativePath = path
            .relative(projectRoot, resourcePath)
            .replaceAll(path.win32.sep, '/');

          const result = transformReactLynxSync(code, {
            mode: 'test',
            pluginName: '',
            filename: path.basename(resourcePath),
            sourcemap: true,
            snapshot: {
              preserveJsx: false,
              runtimePkg: `${runtimePkgName}/internal`,
              jsxImportSource: runtimePkgName,
              filename: relativePath,
              target: 'MIXED',
            },
            engineVersion: options?.engineVersion ?? '',
            dynamicImport: {
              injectLazyBundle: false,
              layer: 'test',
              runtimePkg: `${runtimePkgName}/internal`,
            },
            directiveDCE: false,
            defineDCE: false,
            shake: false,
            compat: false,
            worklet: {
              filename: relativePath,
              runtimePkg: `${runtimePkgName}/internal`,
              target: 'MIXED',
            },
            refresh: false,
            cssScope: false,
          });

          if (result.errors.length > 0) {
            throw new Error(result.errors.map((error) => error.text).join('\n'));
          }

          return { code: result.code, map: result.map ?? null };
        },
      );
    },
  };
}

/**
 * Aliases every `preact` subpath to the single copy shipped with
 * `@lynx-js/react`. Without it, the bundler pulls a second copy from
 * `node_modules/.pnpm`, producing two `options` singletons: hooks register
 * `_render` on one while the diff path reads the other, and `useState` throws
 * `Cannot read properties of undefined (reading '__H')`.
 */
export function reactLynxPreactSingletonAlias(): Record<string, string> {
  const runtimeOSSDir = path.dirname(
    require.resolve('@lynx-js/react/package.json', { paths: [__dirname] }),
  );
  const preactDir = path.dirname(
    require.resolve('preact/package.json', { paths: [runtimeOSSDir] }),
  );
  return Object.fromEntries(
    ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
      (specifier) => [
        `${specifier}$`,
        require.resolve(specifier, { paths: [preactDir] }).replace(/\.js$/, '.mjs'),
      ],
    ),
  );
}
