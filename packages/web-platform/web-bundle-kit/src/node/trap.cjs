// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A Node.js built-in that has no browser equivalent. Importing it is fine;
// using it throws an error that names it.
module.exports = function trap(name) {
  const fail = (what) => {
    const error = new Error(
      `${name}.${what} is not available in @lynx-js/web-bundle-kit (a browser build)`,
    );
    error.code = 'ERR_WEB_BUNDLE_KIT_UNSUPPORTED';
    throw error;
  };
  const member = (path) =>
    new Proxy(function() {}, {
      apply: () => fail(`${path}()`),
      construct: () => fail(`new ${path}()`),
      get: (_target, key) => {
        if (key === 'prototype') return {};
        if (typeof key === 'symbol') return undefined;
        return member(`${path}.${String(key)}`);
      },
    });
  const proxy = new Proxy(function() {}, {
    get(_target, key) {
      if (key === '__esModule') return false;
      if (key === 'default') return proxy;
      if (typeof key === 'symbol' || key === 'then') return undefined;
      return member(String(key));
    },
    apply: () => fail('()'),
  });
  return proxy;
};
