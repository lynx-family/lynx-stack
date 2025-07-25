import { defineConfig, type ViteUserConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from './plugins/index.js';
import type { TestingLibraryOptions } from './plugins/vitest.js';

export async function createVitestConfig(options?: TestingLibraryOptions): Promise<ViteUserConfig> {
  return defineConfig({
    plugins: [
      vitestTestingLibraryPlugin(options),
    ],
  });
}
