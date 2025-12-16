import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig();
const config = defineConfig({
  test: {
    include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
    exclude: ['__tests__/utils/**'],
  },
});

export default mergeConfig(defaultConfig, config);
