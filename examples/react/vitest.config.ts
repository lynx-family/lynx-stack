import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'examples/react',
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.tsx'],
    },
  },
});
