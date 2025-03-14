import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from './src/vitest.config';

const defaultConfig = createVitestConfig({
  runtimePkgName: '@lynx-js/react',
});
const config = defineConfig({});

export default defineConfig(mergeConfig(defaultConfig, config));
