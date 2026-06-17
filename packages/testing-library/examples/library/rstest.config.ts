import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        name: 'testing-library/examples/library/rstest',
        plugins: [
          ...(config.plugins || []),
          pluginReactLynx(),
        ],
      };
    },
  }),
});
