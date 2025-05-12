import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/tests/*.vitest.spec.ts'],
    name: 'web-platform/web-tests',
    benchmark: {
      include: ['**/tests/*.bench.vitest.spec.ts'],
    },
  },
});
