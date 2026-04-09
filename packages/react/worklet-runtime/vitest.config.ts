import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  define: {
    __DEV__: false,
  },
  test: {
    name: 'react/worklet-runtime',
  },
});

export default config;
