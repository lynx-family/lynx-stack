import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from './plugins/index.js';
import type { TestingLibraryOptions } from './plugins/index.js';

export function createVitestConfig(options?: TestingLibraryOptions): ViteUserConfig {
  return defineConfig({
    plugins: [
      ...vitestTestingLibraryPlugin(options),
    ],
  });
}
