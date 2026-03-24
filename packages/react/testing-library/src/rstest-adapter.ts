import type { ExtendConfigFn } from '@rstest/core';
import { createRequire } from 'node:module';
import type { RsbuildConfig } from '@rsbuild/core';

export interface TestingLibraryOptions {
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

const require = createRequire(import.meta.url);

export function withLynxConfig(
  options?: TestingLibraryOptions,
): ExtendConfigFn {
  return async () => {
    const { loadConfig, toRsbuildConfig } = await import('@lynx-js/rspeedy');
    const lynxConfig = await loadConfig({
      cwd: options?.rootPath,
      configPath: options?.configPath,
    });

    const { toRstestConfig } = await import('@rstest/adapter-rsbuild');

    const rstestConfig = toRstestConfig({
      rsbuildConfig: toRsbuildConfig(lynxConfig.content) as RsbuildConfig,
    });

    return {
      ...rstestConfig,
      plugins: [
        ...(rstestConfig.plugins || []),
        {
          name: 'lynx-adapter:remove-useless-plugins',
          remove: ['lynx:rsbuild:qrcode'],
          setup: () => {},
        },
      ],
      testEnvironment: 'jsdom',
      setupFiles: [require.resolve('./setupFiles/rstest')],
      globals: true,
    };
  };
}
