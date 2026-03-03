import path from 'path';
import { createRequire } from 'module';

function normalizeSlashes(file) {
  return file.replaceAll(path.win32.sep, '/');
}

/**
 * Vite plugin that runs the ReactLynx SWC snapshot transform on source files.
 *
 * @param {object} pluginOptions
 * @param {string} pluginOptions.runtimePkgName - Runtime package name, e.g. '@lynx-js/react'
 * @param {string} pluginOptions.rootDir - Root directory for computing stable relative paths
 * @param {string} [pluginOptions.engineVersion] - Engine version string
 * @param {boolean|object} [pluginOptions.dynamicImport] - Dynamic import config, or false to disable
 * @param {boolean|object} [pluginOptions.worklet] - Worklet config (filename is auto-populated per file), or false to disable
 */
export function transformReactLynxPlugin(pluginOptions) {
  const {
    runtimePkgName,
    rootDir,
    engineVersion,
    dynamicImport = false,
    worklet = false,
  } = pluginOptions;

  const _require = createRequire(import.meta.url);

  return {
    name: 'transformReactLynxPlugin',
    enforce: 'pre',
    transform(sourceText, sourcePath) {
      // Only transform JS/TS files
      // Using the same regex as rspack's `CHAIN_ID.RULE.JS` rule
      const regex = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)(\?.*)?$/;
      if (!regex.test(sourcePath)) return null;

      const { transformReactLynxSync } = _require(
        '@lynx-js/react/transform',
      );
      // relativePath should be stable between different runs with different cwd
      const relativePath = normalizeSlashes(path.relative(
        rootDir,
        sourcePath,
      ));
      const basename = path.basename(sourcePath);

      // Auto-populate worklet.filename with per-file relativePath
      let workletOption = worklet;
      if (worklet && typeof worklet === 'object') {
        workletOption = { ...worklet, filename: relativePath };
      }

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
        engineVersion: engineVersion ?? '',
        dynamicImport,
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: workletOption,
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
