// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

__injectGlobals(globalThis);

const require = createRequire(import.meta.url);

// eslint-disable-next-line import/no-commonjs
const mockModule = require('../mock-module/index');

const CustomSections = {
  'background': mockModule,
  'mainThread': mockModule,
};

function __injectGlobals(target) {
  target.printLogger = process.argv.includes('--verbose');

  target.lynx = {
    fetchBundle: (url) => {
      return {
        wait: () => ({ url, code: 0, err: null }),
        then: (callback) => callback({ url, code: 0, err: null }),
      };
    },
    loadScript: (sectionPath) => {
      const module = CustomSections[sectionPath] ?? {};
      return module;
    },
  };

  target.Lodash = {};
}
