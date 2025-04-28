import type { ViteUserConfig } from 'vitest/config.js';

export interface CreateVitestConfigOptions {
  /**
   * The package name of the ReactLynx runtime package.
   *
   * @default `@lynx-js/react`
   */
  runtimePkgName?: string;
}

export function createVitestConfig(options?: CreateVitestConfigOptions): Promise<ViteUserConfig>;
