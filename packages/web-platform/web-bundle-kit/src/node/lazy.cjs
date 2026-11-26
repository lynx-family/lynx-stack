// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// An object that forwards to another one that only exists after setup.
// Functions are bound to their owner, as memfs methods expect.
module.exports = function lazyObject(getTarget) {
  const proxy = new Proxy({}, {
    get(_target, key) {
      if (key === '__esModule') return false;
      if (key === 'default') return proxy;
      const target = getTarget();
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(_target, key, value) {
      getTarget()[key] = value;
      return true;
    },
    has: (_target, key) => key in getTarget(),
    ownKeys: () => Reflect.ownKeys(getTarget()),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = getTarget()[key];
      return value === undefined
        ? undefined
        : { value, enumerable: true, configurable: true, writable: true };
    },
  });
  return proxy;
};
