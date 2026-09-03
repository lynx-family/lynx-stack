// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { removeCommitHookForTesting, replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  removeCommitHookForTesting();
  rs.restoreAllMocks();
  elementTree.clear();
});

function mountAndHydrate(jsx) {
  __root.__jsx = jsx;
  renderPage();

  globalEnvManager.switchToBackground();
  render(jsx, __root);

  lynx.getApp().OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

  globalEnvManager.switchToMainThread();
  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalThis[rLynxChange[0]](rLynxChange[1]);

  globalEnvManager.switchToBackground();
  rLynxChange[2]?.();
}

describe('replaceCommitHook', () => {
  it('is idempotent', () => {
    replaceCommitHook();
    const wrapped = options.__c;
    replaceCommitHook();
    expect(options.__c).toBe(wrapped);
  });

  it('sends a single patch per commit when installed repeatedly', async () => {
    replaceCommitHook();
    replaceCommitHook();
    replaceCommitHook();

    let setText;
    function App() {
      const [text, setState] = useState('a');
      setText = setState;
      return <text>{text}</text>;
    }

    mountAndHydrate(<App />);

    const callsBeforeUpdate = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    setText('b');
    await waitSchedule();

    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(callsBeforeUpdate + 1);
  });

  it('can be removed and reinstalled', () => {
    replaceCommitHook();
    const wrapped = options.__c;
    removeCommitHookForTesting();
    const original = options.__c;
    expect(original).not.toBe(wrapped);

    removeCommitHookForTesting();
    expect(options.__c).toBe(original);

    replaceCommitHook();
    expect(options.__c).not.toBe(original);
    removeCommitHookForTesting();
    expect(options.__c).toBe(original);
  });

  it('deletes the commit option when none existed before install', () => {
    const hadCommit = '__c' in options;
    const original = options.__c;
    try {
      delete options.__c;

      replaceCommitHook();
      expect(typeof options.__c).toBe('function');
      removeCommitHookForTesting();
      expect('__c' in options).toBe(false);
    } finally {
      removeCommitHookForTesting();
      if (hadCommit) {
        options.__c = original;
      } else {
        delete options.__c;
      }
    }
  });
});
