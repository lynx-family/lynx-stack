import { defineProject, type UserConfigExport } from 'vitest/config';

const config: UserConfigExport = defineProject({
  test: {
    name: 'tools/tailwind-preset',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});

export default config;
