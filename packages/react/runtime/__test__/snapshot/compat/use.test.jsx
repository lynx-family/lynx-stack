// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { Suspense } from 'preact/compat';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@rstest/core';

import { createContext } from '../../../src/index';
import { use } from '../../../compat';
import { setupBackgroundDocument } from '../../../src/document';
import { backgroundSnapshotInstanceManager, setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

describe('use', () => {
  /** @type {import('../../../src/snapshot').SnapshotInstance} */
  let scratch;

  beforeAll(() => {
    setupBackgroundDocument();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    globalEnvManager.switchToBackground();
    scratch = document.createElement('root');
  });

  afterEach(() => {
    render(null, scratch);
    elementTree.clear();
    backgroundSnapshotInstanceManager.clear();
  });

  it('reads a context value', () => {
    const Theme = createContext('light');
    let seen;

    function Reader() {
      seen = use(Theme);
      return <view />;
    }

    render(
      <Theme.Provider value='dark'>
        <Reader />
      </Theme.Provider>,
      scratch,
    );

    expect(seen).toBe('dark');
  });

  it('falls back to the default context value outside a provider', () => {
    const Theme = createContext('light');
    let seen;

    function Reader() {
      seen = use(Theme);
      return <view />;
    }

    render(<Reader />, scratch);

    expect(seen).toBe('light');
  });

  it('may be called conditionally', () => {
    const Theme = createContext('light');
    const seen = [];

    function Reader({ enabled }) {
      seen.push(enabled ? use(Theme) : 'skipped');
      return <view />;
    }

    render(<Reader enabled={false} />, scratch);
    render(<Reader enabled />, scratch);

    expect(seen).toEqual(['skipped', 'light']);
  });

  it('suspends on a pending promise and renders the resolved value', async () => {
    let resolvePromise;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    let seen;

    function Reader() {
      seen = use(promise);
      return <view />;
    }

    render(
      <Suspense fallback={<text>loading</text>}>
        <Reader />
      </Suspense>,
      scratch,
    );

    // Still pending: `use` threw the promise, so the boundary shows its fallback.
    expect(seen).toBeUndefined();

    resolvePromise('done');
    await waitSchedule();

    expect(seen).toBe('done');
  });
});
