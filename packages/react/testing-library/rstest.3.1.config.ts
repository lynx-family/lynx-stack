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
          reactLynxSelfTestTransform(root, { engineVersion: '3.1' }),
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
        include: ['src/__tests__/3.1/**/*.{js,jsx,ts,tsx}'],
      };
    },
  }),
  root,
  restoreMocks: true,
  name: 'react/testing-library/engine-3.1',
});
