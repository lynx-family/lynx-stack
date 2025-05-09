import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'tools/tailwind-preset',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});
