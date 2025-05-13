import { defineConfig } from 'vitest/config';
import codspeed from '@codspeed/vitest-plugin';

export default defineConfig({
  test: {
    include: ['**/tests/*.vitest.spec.ts'],
    exclude: ['**/tests/*.bench.vitest.spec.ts'],
    name: 'web-platform/web-tests',
    benchmark: {
      include: ['**/tests/*.bench.vitest.spec.ts'],
    },
  },
  plugins: [
    process.env['CI'] ? codspeed() : undefined,
  ],
});
