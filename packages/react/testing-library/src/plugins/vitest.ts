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

  /**
   * The engine version to use for the transform.
   *
   * @default `''`
   */
  engineVersion?: string;

  /**
   * Enable experimental React Compiler support.
   *
   * Requires `@babel/core`, `babel-plugin-react-compiler`,
   * `@babel/plugin-syntax-jsx`, and `@babel/plugin-syntax-typescript`
   * to be installed in your project.
   *
   * @default `false`
   */
  experimental_enableReactCompiler?: boolean;
}

export function testingLibraryPlugin(
  options?: TestingLibraryOptions,
): Vite.Plugin[] {
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
  preactAlias.forEach((alias) => {
    alias.replacement = alias.replacement.replace(/\.js$/, '.mjs');
  });
  const reactAlias = [
    {
      find: /^react$/,
      replacement: require.resolve(runtimeOSSPkgName, {
        paths: [runtimeDir, __dirname],
      }),
    },
    {
      find: /^react\/jsx-runtime$/,
      replacement: require.resolve(path.posix.join(runtimeOSSPkgName, 'jsx-runtime'), {
        paths: [runtimeDir, __dirname],
      }),
    },
    {
      find: /^react\/jsx-dev-runtime$/,
      replacement: require.resolve(path.posix.join(runtimeOSSPkgName, 'jsx-dev-runtime'), {
        paths: [runtimeDir, __dirname],
      }),
    },
  ];

  function transformReactCompilerPlugin(): Vite.Plugin {
    let rootContext: string, compilerDeps: ReturnType<typeof resolveCompilerDeps>, babel: any;

    function resolveCompilerDeps(rootContext: string) {
      const missingBabelPackages: string[] = [];
      const [
        babelPath,
        babelPluginReactCompilerPath,
        babelPluginSyntaxJsxPath,
        babelPluginSyntaxTypescriptPath,
      ] = [
        '@babel/core',
        'babel-plugin-react-compiler',
        '@babel/plugin-syntax-jsx',
        '@babel/plugin-syntax-typescript',
      ].map((name) => {
        try {
          return require.resolve(name, {
            paths: [rootContext],
          });
        } catch {
          missingBabelPackages.push(name);
        }
        return '';
      });
      if (missingBabelPackages.length > 0) {
        throw new Error(
          `With \`experimental_enableReactCompiler\` enabled, you need to install \`${
            missingBabelPackages.join(
              '`, `',
            )
          }\` in your project root to use React Compiler.`,
        );
      }

      return {
        babelPath,
        babelPluginReactCompilerPath,
        babelPluginSyntaxJsxPath,
        babelPluginSyntaxTypescriptPath,
      };
    }

    return {
      name: 'transformReactCompilerPlugin',
      enforce: 'pre',
      config(config) {
        rootContext = config.root!;

        const reactCompilerRuntimeAlias: Vite.Alias[] = [];
        try {
          reactCompilerRuntimeAlias.push(
            {
              find: /^react-compiler-runtime$/,
              replacement: path.join(
                path.dirname(require.resolve('react-compiler-runtime/package.json', {
                  paths: [rootContext],
                })),
                // Use ts to ensure `react` can be aliased to `@lynx-js/react`
                'src',
                'index.ts',
              ),
            },
          );
        } catch (e) {
          // react-compiler-runtime not found, skip alias
        }

        let mergedAlias: Vite.Alias[] = [...reactCompilerRuntimeAlias];
        if (config.test?.alias) {
          if (Array.isArray(config.test.alias)) {
            mergedAlias = [...config.test.alias, ...mergedAlias];
          } else {
            mergedAlias = [
              ...Object.entries(config.test.alias).map(([key, value]) => ({
                find: key,
                replacement: value,
              })),
              ...mergedAlias,
            ];
          }
        }

        config.test = config.test || {};
        config.test.alias = mergedAlias;

        compilerDeps = resolveCompilerDeps(rootContext);
        const { babelPath } = compilerDeps;
        babel = require(babelPath!);
      },
      async transform(sourceText, sourcePath) {
        if (/\.(?:jsx|tsx)$/.test(sourcePath)) {
          const { babelPluginReactCompilerPath, babelPluginSyntaxJsxPath, babelPluginSyntaxTypescriptPath } =
            compilerDeps;
          const isTSX = sourcePath.endsWith('.tsx');

          try {
            const result = babel.transformSync(sourceText, {
              plugins: [
                // We use '17' to make `babel-plugin-react-compiler` compiles our code
                // to use `react-compiler-runtime` instead of `react/compiler-runtime`
                // for the `useMemoCache` hook
                [babelPluginReactCompilerPath, { target: '17' }],
                babelPluginSyntaxJsxPath,
                isTSX ? [babelPluginSyntaxTypescriptPath, { isTSX: true }] : null,
              ].filter(Boolean),
              filename: sourcePath,
              ast: false,
              sourceMaps: true,
            });
            if (result?.code != null && result?.map != null) {
              return {
                code: result.code,
                map: result.map,
              };
            } else {
              this.error(
                `babel-plugin-react-compiler transform failed for ${sourcePath}: ${
                  result ? 'missing code or map' : 'no result'
                }`,
              );
            }
          } catch (e) {
            this.error(e as Error);
          }
        }

        return null;
      },
    };
  }

  let config: ResolvedConfig;

  function transformReactLynxPlugin(): Vite.Plugin {
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
          engineVersion: options?.engineVersion ?? '',
          dynamicImport: {
            injectLazyBundle: false,
            layer: 'test',
            runtimePkg: `${runtimePkgName}/internal`,
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
      config: () => ({
        test: {
          environment: require.resolve(
            `${runtimeOSSDir}/testing-library/dist/env/vitest`,
          ),
          globals: true,
          setupFiles: [
            require.resolve('../setupFiles/vitest'),
          ],
          alias: [...runtimeOSSAlias, ...runtimeAlias, ...preactAlias, ...reactAlias],
        },
      }),
      configResolved(_config) {
        // @ts-ignore
        config = _config;
      },
    };
  }

  return [
    ...(options?.experimental_enableReactCompiler
      ? [transformReactCompilerPlugin()]
      : []),
    transformReactLynxPlugin(),
  ];
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
        paths: [resolveDir, __dirname],
      }),
    });
  });
  return pkgAlias;
}

function normalizeSlashes(file: string) {
  return file.replaceAll(path.win32.sep, '/');
}
