import { defineConfig } from 'vitest/config';
import { VitestPackageInstaller } from 'vitest/node';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function ensurePackagesInstalled() {
  const installer = new VitestPackageInstaller();
  const installed = await installer.ensureInstalled(
    'jsdom',
    process.cwd(),
  );
  if (!installed) {
    console.log('ReactLynx Testing Library requires jsdom to be installed.');
    process.exit(1);
  }
}

/**
 * @returns {import('vitest/config').ViteUserConfig}
 */
export const createVitestConfig = async (options) => {
  await ensurePackagesInstalled();

  const runtimeOSSPkgName = '@lynx-js/react';
  const runtimePkgName = options?.runtimePkgName ?? runtimeOSSPkgName;
  const runtimeDir = path.dirname(require.resolve(`${runtimePkgName}/package.json`));
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

  const generateAlias = (pkgName, pkgDir, resolveDir) => {
    const pkgExports = require(path.join(pkgDir, 'package.json')).exports;
    const pkgAlias = [];
    Object.keys(pkgExports).forEach((key) => {
      const name = path.posix.join(pkgName, key);
      pkgAlias.push({
        find: new RegExp('^' + name + '$'),
        replacement: require.resolve(name, {
          paths: [resolveDir, __dirname],
        }),
      });
    });
    return pkgAlias;
  };

  const runtimeOSSAlias = generateAlias(runtimeOSSPkgName, runtimeOSSDir, runtimeDir);
  let runtimeAlias = [];
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
        paths: [runtimeDir],
      }),
    },
    {
      find: /^react\/jsx-runtime$/,
      replacement: require.resolve(path.posix.join(runtimeOSSPkgName, 'jsx-runtime'), {
        paths: [runtimeDir],
      }),
    },
    {
      find: /^react\/jsx-dev-runtime$/,
      replacement: require.resolve(path.posix.join(runtimeOSSPkgName, 'jsx-dev-runtime'), {
        paths: [runtimeDir],
      }),
    },
  ];

  function transformReactCompilerPlugin() {
    let rootContext, compilerDeps, babel;

    function resolveCompilerDeps(rootContext) {
      const missingBabelPackages = [];
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
        rootContext = config.root;

        const reactCompilerRuntimeAlias = [];
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
          // console.log('react-compiler-runtime not found, skip alias');
        }

        config.test.alias.push(...reactCompilerRuntimeAlias);

        compilerDeps = resolveCompilerDeps(rootContext);
        const { babelPath } = compilerDeps;
        babel = require(babelPath);
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
            this.error(e);
          }
        }

        return null;
      },
    };
  }

  function transformReactLynxPlugin() {
    return {
      name: 'transformReactLynxPlugin',
      enforce: 'pre',
      transform(sourceText, sourcePath) {
        const id = sourcePath;
        // Only transform JS files
        // Using the same regex as rspack's `CHAIN_ID.RULE.JS` rule
        const regex = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)(\?.*)?$/;
        if (!regex.test(id)) return null;

        const { transformReactLynxSync } = require(
          '@lynx-js/react/transform',
        );
        // relativePath should be stable between different runs with different cwd
        const relativePath = normalizeSlashes(path.relative(
          __dirname,
          sourcePath,
        ));
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
          result.errors.forEach(error => {
            this.error(
              error.text,
              error.location,
            );
          });
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => {
            this.warn(
              warning.text,
              warning.location,
            );
          });
        }

        return {
          code: result.code,
          map: result.map,
        };
      },
    };
  }

  return defineConfig({
    server: {
      fs: {
        allow: [
          path.join(__dirname, '..'),
        ],
      },
    },
    plugins: [
      ...(options?.experimental_enableReactCompiler
        ? [
          transformReactCompilerPlugin(),
        ]
        : []),
      transformReactLynxPlugin(),
    ],
    test: {
      environment: require.resolve(
        './env/vitest',
      ),
      globals: true,
      setupFiles: [path.join(__dirname, 'vitest-global-setup')],
      alias: [...runtimeOSSAlias, ...runtimeAlias, ...preactAlias, ...reactAlias],
      include: options?.include ?? ['src/**/*.test.{js,jsx,ts,tsx}'],
    },
  });
};

function normalizeSlashes(file) {
  return file.replaceAll(path.win32.sep, '/');
}
