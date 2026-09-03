// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RsbuildPlugin } from '@rsbuild/core';

import type { TestingLibraryOptions } from './plugins/vitest.js';

/** @internal */
export interface ReactLynxTestTransformOptions extends TestingLibraryOptions {
  /**
   * Project root used to derive the stable, relative module paths that
   * snapshot and worklet ids hash from.
   *
   * Pass the directory of the `rstest.config.ts`. Without it the ids change
   * depending on whether the project runs on its own or as one entry of a
   * root `projects` list, because Rsbuild is rooted differently in each case.
   *
   * @defaultValue the Rsbuild root
   */
  rootPath?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Compiles test code for the Rstest runner.
 *
 * Internal to `withDefaultConfig` — Rstest users configure the testing library
 * through `withDefaultConfig` / `withLynxConfig`, not by adding a plugin.
 *
 * Test code is compiled in `mode: 'test'` with a `MIXED` target so that a
 * single bundle drives both the main and the background thread, which is what
 * the testing library's dual-thread environment expects. Compiling it the way
 * a real Lynx app is built (`pluginReactLynx`) splits the two threads into
 * separate layers and yields different element/patch codegen.
 */
/**
 * Module aliases the ReactLynx testing environment needs.
 *
 * Belongs in a project's own `resolve.alias`, NOT in a plugin's
 * `modifyRsbuildConfig`: Rstest builds every project of a root `projects`
 * list in one Rsbuild instance, where a plugin-level `resolve` change would
 * also rewrite OTHER projects' resolution.
 */
export function reactLynxTestAlias(
  options?: ReactLynxTestTransformOptions,
): Record<string, string> {
  const runtimeOSSPkgName = '@lynx-js/react';
  const runtimePkgName = options?.runtimePkgName ?? runtimeOSSPkgName;
  const runtimeDir = path.dirname(
    require.resolve(`${runtimePkgName}/package.json`),
  );
  const runtimeOSSDir = path.dirname(
    require.resolve(`${runtimeOSSPkgName}/package.json`, {
      paths: [runtimeDir, __dirname],
    }),
  );
  const preactDir = path.dirname(
    require.resolve('preact/package.json', { paths: [runtimeOSSDir] }),
  );

  // Every `preact` / `@lynx-js/react` specifier has to land on ONE physical
  // module, and consumers (the example apps) do not depend on `preact`
  // themselves. Resolving from this plugin's own location — as the Vitest
  // plugin does — keeps both true regardless of where the project lives.
  const alias: Record<string, string> = {
    ...generateAlias(runtimeOSSPkgName, runtimeOSSDir, runtimeDir),
    ...(runtimePkgName !== runtimeOSSPkgName
      ? generateAlias(runtimePkgName, runtimeDir, __dirname)
      : {}),
    ...Object.fromEntries(
      Object.entries(generateAlias('preact', preactDir, runtimeOSSDir)).map((
        [key, value],
      ) => [key, value.replace(/\.js$/, '.mjs')]),
    ),
    'react$': require.resolve(runtimeOSSPkgName, {
      paths: [runtimeDir, __dirname],
    }),
    'react/jsx-runtime$': require.resolve(
      path.posix.join(runtimeOSSPkgName, 'jsx-runtime'),
      { paths: [runtimeDir, __dirname] },
    ),
    'react/jsx-dev-runtime$': require.resolve(
      path.posix.join(runtimeOSSPkgName, 'jsx-dev-runtime'),
      { paths: [runtimeDir, __dirname] },
    ),
  };

  try {
    const compilerRuntimeDir = path.dirname(
      require.resolve('react-compiler-runtime/package.json', {
        paths: [options?.rootPath ?? process.cwd()],
      }),
    );
    // Point at the TypeScript source so `react` still resolves to
    // `@lynx-js/react` through this plugin's transform.
    alias['react-compiler-runtime$'] = path.join(
      compilerRuntimeDir,
      'src',
      'index.ts',
    );
  } catch {
    // `react-compiler-runtime` is optional.
  }

  return alias;
}

export function reactLynxTestTransform(
  options?: ReactLynxTestTransformOptions,
): RsbuildPlugin {
  const runtimePkgName = options?.runtimePkgName ?? '@lynx-js/react';

  return {
    name: 'lynx:rstest:testing-library-transform',
    setup(api) {
      // Rstest builds every project of a root `projects` list in one Rsbuild
      // instance, so an unscoped `api.transform` would also compile OTHER
      // projects' sources — with this project's `runtimePkg` and relative
      // paths, which silently changes their snapshot ids. Only ever touch
      // files that live under this project.
      const projectRoot = options?.rootPath ?? api.context.rootPath;
      const isProjectSource = (resource: string): boolean => {
        const relative = path.relative(projectRoot, resource);
        return relative !== '' && !relative.startsWith('..')
          && !path.isAbsolute(relative);
      };

      api.transform(
        {
          test: (resource: string) =>
            /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(resource)
            && isProjectSource(resource),
          order: 'pre',
        },
        ({ code, resourcePath }) => {
          const { transformReactLynxSync } = require(
            '@lynx-js/react/transform',
          ) as typeof import('@lynx-js/react/transform');

          // Snapshot and worklet ids are derived from this path, so it has
          // to stay relative to the project root — exactly as the Vitest
          // plugin derives it from `config.root`.
          const relativePath = normalizeSlashes(
            path.relative(options?.rootPath ?? api.context.rootPath, resourcePath),
          );

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

      // Registered last on purpose: rspack runs a module's loaders in reverse
      // registration order, so this makes the React Compiler pass run BEFORE
      // the ReactLynx transform — which is what it needs, since that
      // transform lowers the JSX the compiler has to analyse.
      if (options?.experimental_enableReactCompiler) {
        setupReactCompiler(api, isProjectSource);
      }
    },
  };
}

function generateAlias(
  pkgName: string,
  pkgDir: string,
  resolveDir: string,
): Record<string, string> {
  const pkgExports = (
    require(path.join(pkgDir, 'package.json')) as { exports?: unknown }
  ).exports;
  if (!pkgExports || typeof pkgExports !== 'object') {
    return {};
  }
  const pkgAlias: Record<string, string> = {};
  for (const key of Object.keys(pkgExports)) {
    const name = path.posix.join(pkgName, key);
    try {
      // `$` pins the alias to an exact specifier, matching the anchored
      // regexes the Vitest plugin builds.
      pkgAlias[`${name}$`] = require.resolve(name, {
        paths: [resolveDir, __dirname],
      });
    } catch {
      // Subpaths that do not resolve in this environment get no alias.
    }
  }
  return pkgAlias;
}

function normalizeSlashes(file: string): string {
  return file.replaceAll(path.win32.sep, '/');
}

/**
 * Runs `babel-plugin-react-compiler` ahead of the ReactLynx transform, the
 * same way the Vitest plugin's `transformReactCompilerPlugin` does.
 */
function setupReactCompiler(
  api: Parameters<NonNullable<RsbuildPlugin['setup']>>[0],
  isProjectSource: (resource: string) => boolean,
): void {
  const rootContext = api.context.rootPath;

  const missing: string[] = [];
  const resolveFromRoot = (name: string): string => {
    try {
      return require.resolve(name, { paths: [rootContext] });
    } catch {
      missing.push(name);
      return '';
    }
  };

  const babelPath = resolveFromRoot('@babel/core');
  const babelPluginReactCompilerPath = resolveFromRoot(
    'babel-plugin-react-compiler',
  );
  const babelPluginSyntaxJsxPath = resolveFromRoot('@babel/plugin-syntax-jsx');
  const babelPluginSyntaxTypescriptPath = resolveFromRoot(
    '@babel/plugin-syntax-typescript',
  );

  if (missing.length > 0) {
    throw new Error(
      `With \`experimental_enableReactCompiler\` enabled, you need to install \`${
        missing.join('`, `')
      }\` in your project root to use React Compiler.`,
    );
  }

  const babel = require(babelPath) as {
    transformSync: (
      code: string,
      options: Record<string, unknown>,
    ) => { code?: string | null; map?: unknown } | null;
  };

  api.transform(
    {
      test: (resource: string) => /\.(?:jsx|tsx)$/.test(resource) && isProjectSource(resource),
      order: 'pre',
    },
    ({ code, resourcePath }) => {
      const isTSX = resourcePath.endsWith('.tsx');
      const result = babel.transformSync(code, {
        plugins: [
          // Target 17 so the compiler emits `react-compiler-runtime`'s
          // `useMemoCache` instead of `react/compiler-runtime`.
          [babelPluginReactCompilerPath, { target: '17' }],
          babelPluginSyntaxJsxPath,
          isTSX ? [babelPluginSyntaxTypescriptPath, { isTSX: true }] : null,
        ].filter(Boolean),
        filename: resourcePath,
        ast: false,
        sourceMaps: true,
      });

      if (result?.code == null) {
        throw new Error(
          `babel-plugin-react-compiler transform failed for ${resourcePath}`,
        );
      }

      return { code: result.code, map: result.map as string | null };
    },
  );
}
