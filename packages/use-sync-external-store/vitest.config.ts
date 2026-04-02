import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

const config: UserWorkspaceConfig = defineProject({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
  test: {
    name: 'use-sync-external-store',
  },
});

export default config;
