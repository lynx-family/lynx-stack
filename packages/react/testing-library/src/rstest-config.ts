import type { ExtendConfig, ExtendConfigFn } from '@rstest/core';
import { createRequire } from 'node:module';
import type { RsbuildConfig } from '@rsbuild/core';

export interface LynxConfigOptions {
  /**
   * The root path of the project.
   *
   * @default `process.cwd()`
   */
  rootPath?: string;

  /**
   * The path to the Lynx config file.
   *
   * @default `lynx.config.ts`
   */
  configPath?: string;
}

export interface RstestConfigOptions {
  /**
   * The engine version passed to the ReactLynx transform.
   *
   * @default `''`
   */
  engineVersion?: string;

  /**
   * Customize the generated rstest config.
   */
  modifyRstestConfig?: (config: ExtendConfig) => ExtendConfig | Promise<ExtendConfig>;
}

export interface LynxRstestConfigOptions extends LynxConfigOptions, RstestConfigOptions {}

const require = createRequire(import.meta.url);

// Resolve `preact` (and its sub-paths) to the SINGLE physical copy shipped
// with `@lynx-js/react`. Without this, the bundler pulls a second copy from
// `node_modules/.pnpm`, producing two preact `options` singletons: hooks
// register `_render` on one while the diff path reads the other, so
// `currentComponent` is undefined and `useState` throws
// `Cannot read properties of undefined (reading '__H')`.
function createPreactSingletonAlias(): Record<string, string> {
  const reactRequire = createRequire(
    require.resolve('@lynx-js/react/package.json'),
  );
  return Object.fromEntries(
    ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'].map(
      (s) => [`${s}$`, reactRequire.resolve(s).replace(/\.js$/, '.mjs')],
    ),
  );
}

function createBaseRstestConfig(): ExtendConfig {
  return {
    testEnvironment: 'jsdom',
    setupFiles: [require.resolve('./setupFiles/rstest')],
    globals: true,
  };
}

function createDefaultRstestConfig(
  options?: RstestConfigOptions,
): ExtendConfig {
  return {
    ...createBaseRstestConfig(),
    // Apply the ReactLynx transform via an rspack loader that runs
    // `transformReactLynxSync` from `@lynx-js/react/transform` directly. We do
    // NOT use `@lynx-js/react-rsbuild-plugin` here, because it transitively
    // depends on `use-sync-external-store`, which would create a turbo build
    // cycle for that package's tests.
    resolve: {
      alias: createPreactSingletonAlias(),
    },
    tools: {
      rspack: {
        module: {
          rules: [
            {
              test: /\.(?:jsx|tsx|ts)$/,
              use: [
                {
                  loader: require.resolve('./setupFiles/transform-loader.cjs'),
                  options: {
                    engineVersion: options?.engineVersion ?? '',
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };
}

function normalizeSetupFiles(
  setupFiles: ExtendConfig['setupFiles'],
): string[] {
  if (!setupFiles) {
    return [];
  }

  return Array.isArray(setupFiles) ? setupFiles : [setupFiles];
}

async function applyRstestConfigModifier(
  config: ExtendConfig,
  modifyRstestConfig?: (config: ExtendConfig) => ExtendConfig | Promise<ExtendConfig>,
): Promise<ExtendConfig> {
  if (!modifyRstestConfig) {
    return config;
  }

  return await modifyRstestConfig(config);
}

export function withDefaultConfig(
  options?: RstestConfigOptions,
): ExtendConfigFn {
  return async () => {
    return await applyRstestConfigModifier(
      createDefaultRstestConfig(options),
      options?.modifyRstestConfig,
    );
  };
}

export function withLynxConfig(
  options?: LynxRstestConfigOptions,
): ExtendConfigFn {
  return async () => {
    const { loadConfig } = await import('@lynx-js/rspeedy');
    const lynxConfig = await loadConfig({
      cwd: options?.rootPath,
      configPath: options?.configPath,
    });

    const { toRstestConfig } = await import('@rstest/adapter-rsbuild');
    const rstestConfig = toRstestConfig({
      rsbuildConfig: lynxConfig.content as RsbuildConfig,
    });
    const defaultConfig = createBaseRstestConfig();
    const setupFiles = Array.from(
      new Set([
        ...normalizeSetupFiles(rstestConfig.setupFiles),
        ...normalizeSetupFiles(defaultConfig.setupFiles),
      ]),
    );

    const mergedConfig: ExtendConfig = {
      ...rstestConfig,
      ...defaultConfig,
      plugins: [
        ...(rstestConfig.plugins || []),
        {
          name: 'lynx-adapter:remove-useless-plugins',
          remove: ['lynx:rsbuild:qrcode'],
          setup: () => {},
        },
      ],
      setupFiles,
    };

    return await applyRstestConfigModifier(
      mergedConfig,
      options?.modifyRstestConfig,
    );
  };
}
