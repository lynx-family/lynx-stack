// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export interface LynxRstestConfigOptions {
  /** Project name shown in the rstest reporter. */
  name: string;
  /** Pass the `import.meta.url` of the `rstest.config.ts`. */
  url: string;
  /** Fixture directory name under `test/`. @defaultValue `'fixtures'` */
  fixtures?: string;
  /** Output directory name under `test/`. @defaultValue `'js'` */
  dist?: string;
  /** Test file globs. Defaults to all `*.{test,spec}.{js,ts}` under `test/`. */
  include?: string[];
  exclude?: string[];
  /**
   * Use the full `@rspack/test-tools/setup-expect` (which installs its global
   * snapshot *serializers*) instead of registering only the
   * `toMatchFileSnapshotSync` matcher. Suites whose committed snapshots were
   * serialized by it need this; suites with their own inline snapshots must
   * NOT enable it (the serializers rewrite Error/string output).
   *
   * @defaultValue `false`
   */
  setupExpect?: boolean;
  /** Appended after the default setup files. */
  setupFiles?: string[];
  /** Appended after the default externals. */
  externals?: (string | RegExp | Record<string, string>)[];
  env?: Record<string, string>;
}

/**
 * Shared rstest project config for packages testing through
 * `@lynx-js/test-tools` / `@rspack/test-tools`. Centralizes the boilerplate the
 * harness requires:
 *
 * - `env`: the `__*__` path placeholders `@rspack/test-tools` reads at
 *   barrel-load time (via its `setup-env`) to normalize absolute paths in
 *   snapshots.
 * - `output.externals: [/^@rspack\//]`: load `@rspack/*` natively —
 *   `@rspack/test-tools`' `compiler.js` does a CJS `require('@rspack/core')`
 *   (ESM-only), and routing it through rstest's module runner trips Node's
 *   "Cannot require() ES Module ... not yet fully loaded".
 * - `setupFiles`: `setup-env` plus ONLY the `toMatchFileSnapshotSync` matcher —
 *   NOT the full `setup-expect`, whose global snapshot serializers corrupt
 *   unrelated unit tests' inline snapshots.
 */
export function lynxRstestConfig(options: LynxRstestConfigOptions): {
  name: string;
  globals: boolean;
  testTimeout: number;
  include: string[];
  exclude: string[];
  output: {
    externals: (
      | string
      | RegExp
      | Record<string, string>
      | ((
        data: { request?: string },
        callback: (err?: Error, result?: string) => void,
      ) => void)
    )[];
  };
  setupFiles: string[];
  env: Record<string, string>;
  tools: {
    rspack: {
      module: { parser: { javascript: { url: false } } };
    };
  };
} {
  const root = path.dirname(fileURLToPath(options.url));
  const testDir = path.join(root, 'test');
  return {
    name: options.name,
    globals: true,
    // Hot cases chain several incremental rebuilds inside a single test;
    // rstest's 5s default times the chain out on slow CI runners (same
    // values as rspack's own suite).
    testTimeout: process.env['CI'] ? 60_000 : 30_000,
    include: options.include ?? ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', ...options.exclude ?? []],
    output: {
      externals: [
        // Load `@rspack/*` natively, resolved from THIS package (the only one
        // declaring them) — consumers depend solely on `@lynx-js/test-tools`.
        // Requests the wrapper itself cannot resolve (e.g.
        // `@rspack/lite-tapable`) fall through and stay bundled.
        (
          { request }: { request?: string },
          callback: (err?: Error, result?: string) => void,
        ) => {
          if (request?.startsWith('@rspack/')) {
            try {
              return callback(
                undefined,
                `node-commonjs ${require.resolve(request)}`,
              );
            } catch {
              // Not a wrapper dependency — let rstest bundle it.
            }
          }
          callback();
        },
        ...options.externals ?? [],
      ],
    },
    setupFiles: [
      require.resolve('@rspack/test-tools/setup-env'),
      options.setupExpect
        ? require.resolve('@rspack/test-tools/setup-expect')
        : require.resolve('@lynx-js/test-tools/setup-file-snapshot'),
      ...options.setupFiles ?? [],
    ],
    env: {
      DEBUG: 'rspeedy',
      // Keep rspack's stats output colorless on CI — otherwise ANSI escapes
      // leak into snapshots as `<CLR=…>` markers (same as rspack's own suite).
      // `FORCE_COLOR=0` too: CI runners set `FORCE_COLOR`, which Node gives
      // precedence over `NO_COLOR`.
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      RSPACK_HOT_TEST: 'true',
      __TEST_PATH__: testDir,
      __TEST_FIXTURES_PATH__: path.join(
        testDir,
        options.fixtures ?? 'fixtures',
      ),
      __TEST_DIST_PATH__: path.join(testDir, options.dist ?? 'js'),
      __ROOT_PATH__: root,
      __RSPACK_PATH__: path.dirname(
        require.resolve('@rspack/core/package.json'),
      ),
      __RSPACK_TEST_TOOLS_PATH__: path.dirname(
        require.resolve('@rspack/test-tools/package.json'),
      ),
      ...options.env,
    },
    // Tests reference fixtures via `new URL('./x', import.meta.url)`; rspack
    // would otherwise turn those into emitted asset URLs that don't exist on
    // disk.
    tools: {
      rspack: {
        module: { parser: { javascript: { url: false } } },
      },
    },
  };
}
