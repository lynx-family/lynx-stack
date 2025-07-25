import { defineConfig, type UserWorkspaceConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

const config: UserWorkspaceConfig = defineConfig({
  plugins: [vitestTestingLibraryPlugin()],
  test: {
    name: 'use-sync-external-store',
  },
});

export default config;
