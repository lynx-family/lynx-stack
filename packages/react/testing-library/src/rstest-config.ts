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

  /**
   * The build tool the config file belongs to.
   *
   * Inferred from `configPath`, or from the config files present in
   * `rootPath`. Set it when a custom `configPath` carries no such hint.
   */
  buildTool?: 'rsbuild' | 'rspeedy';
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
export function isRspeedyProject(
  options: LynxConfigOptions | undefined,
  exists: (path: string) => boolean = existsSync,
): boolean {
  const cwd = options?.rootPath ?? process.cwd();
  const configPath = options?.configPath;
  return options?.buildTool
    ? options.buildTool === 'rspeedy'
    // A custom `configPath` names no build tool of its own, so fall back to
    // what the project root holds.
    : (configPath && RSPEEDY_CONFIG_FILES.some((name) => configPath.endsWith(name)))
      || RSPEEDY_CONFIG_FILES.some((name) => exists(join(cwd, name)));
}

async function loadLynxConfig(
  options?: LynxConfigOptions,
): Promise<RsbuildConfig> {
  const cwd = options?.rootPath ?? process.cwd();

  if (isRspeedyProject(options)) {
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
          // `lynx:rsbuild:target` builds for Lynx, but the tests run in jsdom
          // against DOM packages. An Rsbuild project applies `pluginLynx`
          // itself, so its config carries the plugin; an Rspeedy one does not.
          remove: ['lynx:rsbuild:qrcode', 'lynx:rsbuild:target'],
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
