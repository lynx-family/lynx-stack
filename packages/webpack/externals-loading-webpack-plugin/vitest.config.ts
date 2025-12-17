import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'webpack/externals-loading',
    setupFiles: ['test/helpers/setup-env.js'],
  },
});

export default config;
