// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// One preset for all supported private host APIs, independent of the library
// being bundled. ProvidePlugin only creates dependencies for referenced names.
export const lynxRuntimePreset = {
  constructors: {
    Element: 'function',
    HTMLElement: 'function',
    SVGElement: 'function',
    NodeList: 'function',
    EventTarget: 'function',
  },
  dom: {
    document: 'object',
    window: 'object',
    getComputedStyle: 'function',
  },
  performance: { performance: 'object' },
  microtask: { queueMicrotask: 'function' },
  animationFrame: {
    requestAnimationFrame: 'function',
    cancelAnimationFrame: 'function',
  },
} as const;
