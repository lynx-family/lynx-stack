import type { ExtendConfig, ExtendConfigFn } from '@rstest/core';
import { createRequire } from 'node:module';
import type { RsbuildConfig } from '@rsbuild/core';

import { reactLynxTestAlias, reactLynxTestTransform } from './rstest-transform.js';

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
   * Enable experimental React Compiler support.
   *
   * Requires `@babel/core`, `babel-plugin-react-compiler`,
   * `@babel/plugin-syntax-jsx` and `@babel/plugin-syntax-typescript` in your
   * project root.
   *
   * @default `false`
   */
  experimental_enableReactCompiler?: boolean;

  /**
   * Customize the generated rstest config.
   */
  modifyRstestConfig?: (config: ExtendConfig) => ExtendConfig | Promise<ExtendConfig>;
}

export interface LynxRstestConfigOptions extends LynxConfigOptions, RstestConfigOptions {}

const require = createRequire(import.meta.url);

function createDefaultRstestConfig(): ExtendConfig {
  return {
    testEnvironment: 'jsdom',
    setupFiles: [require.resolve('./setupFiles/rstest')],
    globals: true,
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
  options?: LynxRstestConfigOptions,
): ExtendConfigFn {
  const transformOptions = {
    ...(options?.rootPath ? { rootPath: options.rootPath } : {}),
    ...(options?.engineVersion ? { engineVersion: options.engineVersion } : {}),
    ...(options?.experimental_enableReactCompiler
      ? { experimental_enableReactCompiler: true as const }
      : {}),
  };
  return async () => {
    return await applyRstestConfigModifier(
      {
        ...createDefaultRstestConfig(),
        // Compile test code with the ReactLynx transform. Deliberately not via
        // `@lynx-js/react-rsbuild-plugin`: that transitively depends on
        // `use-sync-external-store`, which would make a Turbo build cycle out
        // of that package's own tests. It also builds the two threads as
        // separate layers, whereas the testing library needs one `MIXED`
        // bundle driving both.
        plugins: [reactLynxTestTransform(transformOptions)],
        // Project-scoped on purpose. Rstest builds every project of a root
        // `projects` list in one Rsbuild instance, so setting these from a
        // plugin would rewrite the other projects' module resolution too.
        //
        // Only applied here: `withLynxConfig` derives its own `resolve` from
        // the project's Lynx config, which must not be overwritten.
        resolve: {
          dedupe: ['preact'],
          alias: reactLynxTestAlias(transformOptions),
        },
      },
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
    const defaultConfig = createDefaultRstestConfig();
    const setupFiles = Array.from(
      new Set([
        ...normalizeSetupFiles(rstestConfig.setupFiles),
        ...normalizeSetupFiles(defaultConfig.setupFiles),
      ]),
    );

    const mergedConfig: ExtendConfig = {
      ...rstestConfig,
      ...defaultConfig,
      // Pin the Rsbuild root to the project. When this config runs as one
      // entry of a root `projects` list, Rsbuild would otherwise be rooted at
      // the workspace root, where `pluginReactLynx`'s alias resolution cannot
      // find `@lynx-js/react`.
      ...(options?.rootPath ? { root: options.rootPath } : {}),
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
