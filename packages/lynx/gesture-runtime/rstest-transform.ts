// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Internal to this package's own `rstest.config.ts`. Not published, not
// imported by anything outside this file.
//
// This suite renders through `render(<App />, { enableMainThread: true,
// enableBackgroundThread: true })`, so it needs a single bundle driving both
// threads (`mode: 'test'`, `MIXED` target) the way
// `@lynx-js/react-rsbuild-plugin`'s `pluginReactLynx()` does not — that
// builds the two threads as separate layers, matching a real Lynx app, and
// produces different element/patch codegen. `pluginReactLynx()` also cannot
// be used here regardless: its alias resolution cannot find `@lynx-js/react`
// once Rstest runs this config as one entry of the root aggregator's
// `projects` list.
//
// `transformReactLynxSync` itself is `@lynx-js/react/transform`'s own public
// export (the same one `pluginReactLynx` calls into); this only assembles it
// into an Rsbuild `api.transform` plugin via `modifyRstestConfig`, the
// extension point Rstest configs already use for this kind of customization.
import { createRequire } from 'node:module';
import path from 'node:path';

import type { RsbuildPlugin } from '@rsbuild/core';

const require = createRequire(import.meta.url);

export function reactLynxTestModeTransform(projectRoot: string): RsbuildPlugin {
  return {
    name: 'lynx:gesture-runtime:test-mode-transform',
    setup(api) {
      api.transform(
        { test: /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/, order: 'pre' },
        ({ code, resourcePath }) => {
          const { transformReactLynxSync } = require(
            '@lynx-js/react/transform',
          ) as typeof import('@lynx-js/react/transform');

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
              runtimePkg: '@lynx-js/react/internal',
              jsxImportSource: '@lynx-js/react',
              filename: relativePath,
              target: 'MIXED',
            },
            engineVersion: '',
            dynamicImport: {
              injectLazyBundle: false,
              layer: 'test',
              runtimePkg: '@lynx-js/react/internal',
            },
            directiveDCE: false,
            defineDCE: false,
            shake: false,
            compat: false,
            worklet: {
              filename: relativePath,
              runtimePkg: '@lynx-js/react/internal',
              target: 'MIXED',
            },
            refresh: false,
            cssScope: false,
          });

          if (result.errors.length > 0) {
            throw new Error(
              result.errors.map((error) => error.text).join('\n'),
            );
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
    require.resolve('@lynx-js/react/package.json'),
  );
  const preactDir = path.dirname(
    require.resolve('preact/package.json', { paths: [runtimeOSSDir] }),
  );
  return Object.fromEntries(
    ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
      (specifier) => [
        `${specifier}$`,
        require.resolve(specifier, { paths: [preactDir] }).replace(
          /\.js$/,
          '.mjs',
        ),
      ],
    ),
  );
}
