// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, vi } from 'vitest';

import { describeCases } from '@lynx-js/test-tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describeCases({
  name: 'runtime-wrapper',
  casePath: path.join(__dirname, 'cases'),
  beforeExecute() {
    vi.stubGlobal('bundleSupportLoadScript', true);
    // globalThis.fetch does not exist in Lynx environment at the beginning
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    delete globalThis.fetch;
  },
  afterExecute(result) {
    expect(result.length).toBe(1);
    expect(result[0].context).toHaveProperty('__bundle__holder');
    expect(result[0].context.__bundle__holder).toHaveProperty('init');

    const modules = new Map();
    result[0].context.__bundle__holder.init({
      tt: {
        define(name, factory) {
          modules.set(name, factory);
        },
        /**
         * @param {string} name - The module name
         */
        require(name) {
          const require = createRequire(import.meta.url);
          if (name.startsWith('node:')) {
            return require(name);
          }
          modules.get(name)?.(
            require,
            null,
            null,
            null,
            setTimeout,
            setInterval,
            clearInterval,
            clearTimeout,
            null,
            null,
            console,
          );
        },
      },
    });
  },
});
