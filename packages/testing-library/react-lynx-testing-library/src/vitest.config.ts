import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vitest/config';
import resolver from 'enhanced-resolve';
import { createRequire } from 'module';

export interface CreateVitestConfigOptions {
  /**
   * The package name of the ReactLynx runtime package.
   *
   * @default `@lynx-js/react`
   */
  runtimePkgName?: string;
}

export const createVitestConfig = (options?: CreateVitestConfigOptions) => {
  const utils = {
    require: typeof require === 'undefined'
      ? createRequire(import.meta.url)
      : require,
    __filename: typeof __filename === 'undefined'
      ? fileURLToPath(import.meta.url)
      : __filename,
    __dirname: typeof __dirname === 'undefined'
      ? path.dirname(fileURLToPath(import.meta.url))
      : __dirname,
  };

  const runtimePkgName = options?.runtimePkgName ?? '@lynx-js/react';
  const runtimeOSSPkgName = '@lynx-js/react';
  let runtimeDir = null;
  try {
    runtimeDir = path.dirname(
      utils.require.resolve(`${runtimePkgName}/package.json`, {
        paths: [process.cwd()],
      }),
    );
  } catch (e) {
    // ignore since user may not using internal version
  }

  let runtimeOSSDir = null;
  try {
    runtimeOSSDir = path.dirname(
      utils.require.resolve(`${runtimeOSSPkgName}/package.json`, {
        paths: [process.cwd(), runtimeDir].filter(Boolean) as string[],
      }),
    );
  } catch (e) {
    console.error(
      `Package ${runtimeOSSPkgName} not found, please check if your Lynx project is setup correctly.`,
    );
    throw e;
  }
  if (process.env.DEBUG) {
    console.log('runtimeDir', runtimeDir);
    console.log('runtimeOSSDir', runtimeOSSDir);
  }
  const runtimeOSSExports =
    utils.require(path.join(runtimeOSSDir, 'package.json')).exports;
  const runtimeOSSAlias = [];
  const resolve = resolver.create.sync({
    conditionNames: [
      'import',
    ],
  });
  Object.keys(runtimeOSSExports).forEach((key) => {
    const name = path.posix.join(runtimeOSSPkgName, key);
    runtimeOSSAlias.push({
      find: new RegExp('^' + name + '$'),
      replacement: resolve(
        runtimeOSSDir,
        name,
      ),
    });
  });

  // last precedence
  runtimeOSSAlias.push({
    // No `$` sign, make sure all relative path imports work
    // such as `import { SnapshotInstance } from '@lynx-js/react/runtime/lib/snapshot.js'`
    find: new RegExp('^' + runtimeOSSPkgName + '/'),
    replacement: path.join(
      runtimeOSSDir,
    ) + '/',
  });
  if (process.env.DEBUG) {
    console.log('runtimeOSSAlias', runtimeOSSAlias);
  }

  const preactPkgName = 'preact';
  const preactDir = path.dirname(
    resolve(
      runtimeOSSDir,
      `${preactPkgName}/package.json`,
    ) as string,
  );
  const preactExports =
    utils.require(path.join(preactDir, 'package.json')).exports;
  const preactAlias = Object.keys(preactExports).map((entry) => {
    const name = path.join('preact', entry);
    return ({
      find: new RegExp(name + '$'),
      replacement: resolve(
        runtimeOSSDir,
        name,
      ) as string,
    });
  });
  if (process.env.DEBUG) {
    console.log('preactAlias', preactAlias);
  }

  function transformReactLynxPlugin(): Plugin {
    return {
      name: 'transformReactLynxPlugin',
      enforce: 'pre',
      transform(sourceText, sourcePath) {
        const id = sourcePath;
        if (
          id.endsWith('.css') || id.endsWith('.less') || id.endsWith('.scss')
        ) {
          if (process.env.DEBUG) {
            console.log('ignoring css file', id);
          }
          return '';
        }

        const { transformReactLynxSync } = utils.require(
          '@lynx-js/react/transform',
        );
        const relativePath = path.relative(
          process.cwd(),
          sourcePath,
        );
        const basename = path.basename(sourcePath);
        const result = transformReactLynxSync(sourceText, {
          mode: 'test',
          pluginName: '',
          filename: basename,
          sourcemap: true,
          snapshot: {
            preserveJsx: true,
            runtimePkg: `${runtimeOSSPkgName}/internal`,
            jsxImportSource: runtimeOSSPkgName,
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
            runtimePkg: `${runtimeOSSPkgName}/internal`,
            target: 'MIXED',
          },
          refresh: false,
          cssScope: false,
        });

        if (result.errors.length > 0) {
          console.error(result.errors);
          throw new Error('transformReactLynxSync failed');
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
          path.join(utils.__dirname, '..'),
        ],
      },
    },
    plugins: [
      transformReactLynxPlugin(),
      react({ jsxImportSource: runtimeOSSPkgName }),
    ],
    resolve: {
      alias: [
        ...preactAlias,
        ...runtimeOSSAlias,
      ],
    },
    test: {
      // builtin environment:
      // environment: "jsdom",
      // custom environment:
      environment: path.join(utils.__dirname, 'vitest-environment-lynxdom'),
      // setupFiles: "src/__tests__/setup.ts",
      globals: true,

      setupFiles: [path.join(utils.__dirname, 'vitest-global-setup')],
    },
  });
};
