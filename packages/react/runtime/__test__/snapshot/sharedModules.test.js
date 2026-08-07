// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it } from 'vitest';

import { getSharedModule, registerSharedModule } from '../../src/snapshot/worklet/sharedModules';

const REGISTRY = Symbol.for('__REACT_LYNX_SHARED_MODULES__');

afterEach(() => {
  delete globalThis[REGISTRY];
});

describe('shared module registry', () => {
  it('returns the registered namespace by id', () => {
    const namespace = { springCurve: () => 1 };
    registerSharedModule('a1b2', namespace);

    expect(getSharedModule('a1b2')).toBe(namespace);
  });

  it('reads through the global registry the bundler wrappers write to', () => {
    // A registering wrapper is a virtual module with no location to resolve a
    // runtime import from, so it reaches the registry through the global
    // symbol directly.
    const namespace = { gravity: 9.8 };
    (globalThis[REGISTRY] = globalThis[REGISTRY] || new Map()).set(
      'c3d4',
      namespace,
    );

    expect(getSharedModule('c3d4')).toBe(namespace);
  });

  it('throws for an id no module registered under', () => {
    expect(() => getSharedModule('missing')).toThrowError(
      /no such module is registered/,
    );
  });
});
