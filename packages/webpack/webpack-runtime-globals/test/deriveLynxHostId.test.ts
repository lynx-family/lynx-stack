// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { deriveLynxHostId } from '../src/index.js';

describe('deriveLynxHostId', () => {
  test('pairs a main-thread runtime with its background runtime', () => {
    expect(deriveLynxHostId('pkg', 'main__main-thread')).toBe('pkg#main');
    expect(deriveLynxHostId('pkg', 'main')).toBe('pkg#main');
  });

  test('strips the suffix from every member of a multi-runtime chunk', () => {
    expect(
      deriveLynxHostId('pkg', ['app__main-thread', 'widget__main-thread']),
    ).toBe('pkg#app+widget');
    expect(deriveLynxHostId('pkg', ['app', 'widget'])).toBe('pkg#app+widget');
  });

  test('tolerates missing inputs', () => {
    expect(deriveLynxHostId(undefined, undefined)).toBe('#');
    expect(deriveLynxHostId('', 'main')).toBe('#main');
  });
});
