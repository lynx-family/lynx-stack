import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';

import {
  reactLynxPreactSingletonAlias,
  reactLynxTestModeTransform,
} from './rstest-transform.ts';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        plugins: [...(config.plugins || []), reactLynxTestModeTransform(root)],
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            ...reactLynxPreactSingletonAlias(),
          },
        },
      };
    },
  }),
  root,
  name: 'lynx/gesture-runtime',
  setupFiles: ['__test__/utils/setup.ts'],
  include: ['__test__/**/*.test.{js,jsx,ts,tsx}'],
  exclude: ['__test__/utils/**'],
  coverage: {
    include: ['src/**'],
  },
});
