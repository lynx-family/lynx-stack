// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// @ts-expect-error
globalThis.nativeConsole = {
  ...Object.keys(console).reduce((acc, key) => {
    // @ts-expect-error key must be a keyof Console
    acc[key] = typeof console[key] === 'function'
      // @ts-expect-error key must be a keyof Console
      ? console[key].bind(console)
      // @ts-expect-error key must be a keyof Console
      : console[key];
    return acc;
  }, {} as Console),
  alog: console.log.bind(console),
};

export { startBackgroundThread } from './background-apis/startBackgroundThread.js';
