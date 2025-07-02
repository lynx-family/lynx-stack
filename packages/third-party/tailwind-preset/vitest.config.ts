import { defineProject, type UserConfigExport } from 'vitest/config';
import path from 'path';

const config: UserConfigExport = defineProject({
  resolve: {
    alias: {
      'plugins/lynx': path.resolve(__dirname, 'src/plugins/lynx/index.ts'),
    },
  },
  test: {
    name: 'tools/tailwind-preset',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});

export default config;
