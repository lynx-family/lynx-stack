// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ResolvedConfig, Vite } from 'vitest/node';
import { VitestPackageInstaller } from 'vitest/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export interface TestingLibraryOptions {
  /**
   * The package name of the ReactLynx runtime package.
   *
   * @default `@lynx-js/react`
   */
  runtimePkgName?: string;
}

export function testingLibraryPlugin(
  options?: TestingLibraryOptions,
): Vite.Plugin {
  const runtimeOSSPkgName = '@lynx-js/react';
  const runtimePkgName = options?.runtimePkgName ?? runtimeOSSPkgName;
  const runtimeDir = path.dirname(
    require.resolve(`${runtimePkgName}/package.json`),
  );
  const runtimeOSSDir = path.dirname(
    require.resolve(`${runtimeOSSPkgName}/package.json`, {
      paths: [runtimeDir],
    }),
  );

  const preactDir = path.dirname(
    require.resolve('preact/package.json', {
      paths: [runtimeOSSDir],
    }),
  );

  const runtimeOSSAlias = generateAlias(
    runtimeOSSPkgName,
    runtimeOSSDir,
    runtimeDir,
  );
  let runtimeAlias: Vite.Alias[] = [];
  if (runtimePkgName !== runtimeOSSPkgName) {
    runtimeAlias = generateAlias(runtimePkgName, runtimeDir, __dirname);
  }
  const preactAlias = generateAlias('preact', preactDir, runtimeOSSDir);

  let config: ResolvedConfig;

  return {
    name: 'transformReactLynxPlugin',
    enforce: 'pre',
    async buildStart() {
      await ensurePackagesInstalled();
    },
    transform(sourceText, sourcePath) {
      const id = sourcePath;
      // Only transform JS files
      // Using the same regex as rspack's `CHAIN_ID.RULE.JS` rule
      const regex = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)(\?.*)?$/;
      if (!regex.test(id)) return null;

      const { transformReactLynxSync } = require(
        '@lynx-js/react/transform',
      ) as typeof import('@lynx-js/react/transform');
      // relativePath should be stable between different runs with different cwd
      const relativePath = normalizeSlashes(
        path.relative(config.root, sourcePath),
      );
      const basename = path.basename(sourcePath);
      const result = transformReactLynxSync(sourceText, {
        mode: 'test',
        pluginName: '',
        filename: basename,
        sourcemap: true,
        snapshot: {
          preserveJsx: false,
          runtimePkg: `${runtimePkgName}/internal`,
          jsxImportSource: runtimePkgName,
          filename: relativePath,
          target: 'MIXED',
        },
        // snapshot: true,
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
        // https://rollupjs.org/plugin-development/#this-error
        result.errors.forEach((error) => {
          this.error(error.text ?? 'Unknown error', {
            line: 1,
            column: 1,
            ...error.location,
          });
        });
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          this.warn(warning.text ?? 'Unknown warning', {
            line: 1,
            column: 1,
            ...warning.location,
          });
        });
      }

      return {
        code: result.code,
        map: result.map!,
      };
    },
    configResolved(_config) {
      // @ts-ignore
      config = _config;
    },
    config: () => ({
      test: {
        environment: require.resolve(
          `${runtimeOSSDir}/testing-library/dist/env/vitest`,
        ),
        globals: true,
        setupFiles: [
          require.resolve('../setupFiles/vitest'),
        ],
        alias: [...runtimeOSSAlias, ...runtimeAlias, ...preactAlias],
      },
    }),
  };
}

async function ensurePackagesInstalled() {
  const installer = new VitestPackageInstaller();
  const installed = await installer.ensureInstalled('jsdom', process.cwd());
  if (!installed) {
    console.log('ReactLynx Testing Library requires jsdom to be installed.');
    process.exit(1);
  }
}

function generateAlias(pkgName: string, pkgDir: string, resolveDir: string) {
  const pkgExports = require(path.join(pkgDir, 'package.json')).exports;
  if (!pkgExports || typeof pkgExports !== 'object') {
    return [];
  }
  const pkgAlias: Vite.Alias[] = [];
  Object.keys(pkgExports).forEach((key) => {
    const name = path.posix.join(pkgName, key);
    // Escape special regex characters in the package name
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pkgAlias.push({
      find: new RegExp('^' + escapedName + '$'),
      replacement: require.resolve(name, {
        paths: [resolveDir],
      }),
    });
  });
  return pkgAlias;
}

function normalizeSlashes(file: string) {
  return file.replaceAll(path.win32.sep, '/');
}
