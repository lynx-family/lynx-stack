import type { ExtendConfig, ExtendConfigFn } from '@rstest/core';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
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
   * @default `lynx.config.ts` in an Rspeedy project, `rsbuild.config.ts` in an
   * Rsbuild one
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
      createDefaultRstestConfig(),
      options?.modifyRstestConfig,
    );
  };
}

const RSPEEDY_CONFIG_FILES = [
  'lynx.config.ts',
  'lynx.config.js',
  'lynx.config.mjs',
  'lynx.config.mts',
  'lynx.config.cjs',
  'lynx.config.cts',
];

/**
 * A Lynx project builds either with Rspeedy, which reads `lynx.config.*`, or
 * with Rsbuild and `pluginLynx`, which reads `rsbuild.config.*`. Load whichever
 * one this project has.
 */
async function loadLynxConfig(
  options?: LynxConfigOptions,
): Promise<RsbuildConfig> {
  const cwd = options?.rootPath ?? process.cwd();
  const isRspeedy = options?.configPath
    ? RSPEEDY_CONFIG_FILES.some((name) => options.configPath!.endsWith(name))
    : RSPEEDY_CONFIG_FILES.some((name) => existsSync(join(cwd, name)));

  if (isRspeedy) {
    const { loadConfig } = await import('@lynx-js/rspeedy');
    const { content } = await loadConfig({
      cwd: options?.rootPath,
      configPath: options?.configPath,
    });
    return content as RsbuildConfig;
  }

  const { loadConfig } = await import('@rsbuild/core');
  const { content } = await loadConfig({
    cwd,
    ...(options?.configPath ? { path: options.configPath } : {}),
  });
  return content;
}

export function withLynxConfig(
  options?: LynxRstestConfigOptions,
): ExtendConfigFn {
  return async () => {
    const lynxConfig = { content: await loadLynxConfig(options) };

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
