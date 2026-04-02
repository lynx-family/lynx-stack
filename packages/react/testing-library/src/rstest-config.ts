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
      createDefaultRstestConfig(),
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
    const setupFiles = defaultConfig.setupFiles ?? require.resolve('./setupFiles/rstest');

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
