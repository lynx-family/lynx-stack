// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, rstest } from '@rstest/core';
import semver from 'semver';

import { createElement } from '@lynx-js/react';
import reactPkg from '@lynx-js/react/package.json' with { type: 'json' };
import { render } from '@lynx-js/react/testing-library';

import ReactCompat, {
  startTransition,
  use,
  useInsertionEffect,
  useTransition,
} from '../index.js';
import pkg from '../package.json' with { type: 'json' };

describe('@lynx-js/react-compat', () => {
  it('satisfies the `react` peer ranges of React libraries', () => {
    const reactPeerRanges = {
      'use-latest-callback': '>=16.8',
      '@react-navigation/core': '>= 19.2.0',
      '@types/react': '^18 || ^19.0.0',
    };
    for (const [library, range] of Object.entries(reactPeerRanges)) {
      expect(semver.satisfies(pkg.version, range), library).toBe(true);
    }
  });

  it('accepts the workspace `@lynx-js/react` as its peer', () => {
    expect(
      semver.satisfies(
        reactPkg.version,
        pkg.peerDependencies['@lynx-js/react'],
      ),
    ).toBe(true);
  });

  it('exports the React APIs that `@lynx-js/react` lacks', () => {
    expect(typeof startTransition).toBe('function');
    expect(typeof use).toBe('function');
    expect(typeof useInsertionEffect).toBe('function');
    expect(typeof useTransition).toBe('function');
    expect(ReactCompat.useInsertionEffect).toBe(useInsertionEffect);
    expect(ReactCompat.createElement).toBe(createElement);
  });

  it('runs `useInsertionEffect` when a component renders', () => {
    const effect = rstest.fn();
    function App() {
      useInsertionEffect(effect, []);
      return null;
    }

    render(createElement(App));

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
