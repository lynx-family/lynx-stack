import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import { withDefaultConfig } from './src/rstest-config.ts';
import { reactLynxPreactSingletonAlias, reactLynxSelfTestTransform } from './src/internal/rstest-test-transform.ts';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        tools: {
          swc: {
            jsc: {
              transform: {
                useDefineForClassFields: true,
              },
            },
          },
        },
        plugins: [
          ...(config.plugins || []),
          reactLynxSelfTestTransform(root),
        ],
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            ...reactLynxPreactSingletonAlias(),
          },
        },
        source: {
          ...config.source,
          define: {
            ...config.source?.define,
            __ALOG__: 'true',
          },
        },
        include: ['src/**/*.test.{js,jsx,ts,tsx}', '!src/__tests__/3.1/**/*.{js,jsx,ts,tsx}'],
      };
    },
  }),
  root,
  // Vitest resets a spy's call history when the same method is spied on
  // again; Rstest keeps the existing spy and its recorded calls. These tests
  // re-`spyOn` shared prototypes in every test and rely on that reset, so
  // restore spies between tests to give them the isolation they assume.
  restoreMocks: true,
  name: 'react/testing-library',
});
