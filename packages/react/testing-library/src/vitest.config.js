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
        const relativePath = path.relative(
          __dirname,
          sourcePath,
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
      transformReactLynxPlugin(),
    ],
    test: {
      environment: require.resolve(
        './env/vitest',
      ),
      globals: true,
      setupFiles: [path.join(__dirname, 'vitest-global-setup')],
    },
  });
};
