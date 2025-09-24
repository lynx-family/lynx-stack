import { defineProject, mergeConfig } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig();

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'use-sync-external-store',
  },
});

const mergedConfig: UserWorkspaceConfig = mergeConfig(defaultConfig, config);

export default mergedConfig;
