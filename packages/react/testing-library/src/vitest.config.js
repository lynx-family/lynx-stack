import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * @returns {import('vitest/config').ViteUserConfig}
 */
export const createVitestConfig = (options) => {
  const runtimePkgName = options?.runtimePkgName ?? '@lynx-js/react';

  function transformReactLynxPlugin() {
    return {
      name: 'transformReactLynxPlugin',
      enforce: 'pre',
      transform(sourceText, sourcePath) {
        const id = sourcePath;
        if (
          id.endsWith('.css') || id.endsWith('.less') || id.endsWith('.scss')
        ) {
          if (process.env['DEBUG']) {
            console.log('ignoring css file', id);
          }
          return '';
        }

        const { transformReactLynxSync } = require(
          '@lynx-js/react/transform',
        );
        // relativePath should be stable between different runs with different cwd
        const relativePath = path.posix.relative(
          __dirname,
          sourcePath,
        );
        const basename = path.posix.basename(sourcePath);
        const result = transformReactLynxSync(sourceText, {
          mode: 'test',
          pluginName: '',
          filename: basename,
          sourcemap: true,
          snapshot: {
            preserveJsx: true,
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
          path.posix.join(__dirname, '..'),
        ],
      },
    },
    plugins: [
      transformReactLynxPlugin(),
      react({ jsxImportSource: runtimePkgName }),
    ],
    test: {
      environment: require.resolve(
        '@lynx-js/lynx-environment/env/vitest',
      ),
      globals: true,
      setupFiles: [path.posix.join(__dirname, 'vitest-global-setup')],
    },
  });
};
