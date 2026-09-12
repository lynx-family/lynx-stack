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
  name: 'motion',
  include: ['__tests__/**/*.test.{js,ts,jsx,tsx}'],
  exclude: ['__tests__/utils/**'],
  coverage: {
    include: ['src/**'],
  },
});
