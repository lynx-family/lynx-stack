import { defineProject, type UserConfigExport } from 'vitest/config';

const config: UserConfigExport = defineProject({
  test: {
    name: 'tailwind-preset',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});

export default config;
