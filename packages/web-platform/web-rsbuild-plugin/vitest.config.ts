import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'web-platform',
    expect: {
      poll: {
        timeout: 3000,
      },
    },
  },
});

export default config;
