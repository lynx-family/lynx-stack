// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPortal, createRef } from '../../../src/index';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import '../../../src/snapshot/lynx/component';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('createPortal', () => {
  it('returns null when container is null or undefined', () => {
    expect(createPortal(<text>x</text>, null)).toBeNull();
    expect(createPortal(<text>x</text>, undefined)).toBeNull();
  });

  it('throws when container is not a ReactLynx ref', () => {
    expect(() => createPortal(<text>x</text>, {}))
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: createPortal: container must be a ref obtained from a ReactLynx element. Refs from lynx.createSelectorQuery() or third-party sources are not supported.]`,
      );
  });

  it('throws when the container snapshot has no empty slot at element_index 0', () => {
    const ref = createRef();
    const App = () => <view ref={ref} />;
    __root.__jsx = <App />;
    renderPage();
    globalEnvManager.switchToBackground();
    render(<App />, __root);

    // The snapshot id embedded in the message is a file-position hash, so
    // match on the stable tail.
    expect(() => createPortal(<text>x</text>, ref.current))
      .toThrow(/must have a single empty slot at element index 0/);
  });

  it('returns a preact portal VNode for a valid portal-container ref', () => {
    const ref = createRef();
    const App = () => <view ref={ref} portal-container />;
    __root.__jsx = <App />;
    renderPage();
    globalEnvManager.switchToBackground();
    render(<App />, __root);

    const vnode = createPortal(<text>x</text>, ref.current);
    expect(vnode).not.toBeNull();
    expect(vnode.type).toBeTypeOf('function');
  });
});
