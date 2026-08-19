// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPnprConfig } from './pnpr-config.js';

test('creates exact local rules for public canary packages', () => {
  const config = createPnprConfig(
    [
      { packageJson: { name: 'alpha' } },
      { packageJson: { name: '@lynx-js/private', private: true } },
      { packageJson: { name: '@lynx-js/beta', private: false } },
    ],
    '/tmp/pnpr-storage',
  );

  assert.deepEqual(config, {
    storage: '/tmp/pnpr-storage',
    resolver: {
      enabled: false,
    },
    registries: {
      local: {
        type: 'hosted',
        access: '$all',
        packages: {
          '@lynx-js/beta-canary': {
            access: '$all',
            publish: '$all',
          },
          'alpha-canary': {
            access: '$all',
            publish: '$all',
          },
        },
      },
      npmjs: {
        type: 'upstream',
        url: 'https://registry.npmjs.org/',
        public: true,
      },
      main: {
        type: 'router',
        sources: ['local', 'npmjs'],
      },
    },
    defaultRegistry: 'main',
    log: {
      type: 'stdout',
      format: 'pretty',
      level: 'error',
    },
  });
});
