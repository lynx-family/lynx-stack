// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as bar from './external-bundle-mock/bar/index.js';
import * as baz from './external-bundle-mock/baz/index.js';
import * as foo from './external-bundle-mock/foo/index.js';
import * as qux from './external-bundle-mock/qux/index.js';

__injectGlobals(globalThis);

const CustomSections = {
  'background': foo,
  'mainThread': foo,
  'Bar__background': bar,
  'Bar__mainThread': bar,
  'Baz__background': baz,
  'Baz__mainThread': baz,
  'Qux__background': qux,
  'Qux__mainThread': qux,
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

  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {};

  target.__LoadStyleSheet = () => {
    return {};
  };
  target.__AdoptStyleSheet = () => {
    //
  };
  target.__FlushElementTree = () => {
    //
  };
}
