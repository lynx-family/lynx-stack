import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'webpack/react-simple-styling',
    setupFiles: [
      '@lynx-js/vitest-setup/setup.ts',
      'test/setup-env.js',
    ],
  },
});

export default config;
