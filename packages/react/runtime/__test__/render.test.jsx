// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render, Component, process } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../src/lifecycle/patch/updateMainThread';
import '../src/lynx/component';
import { __root } from '../src/root';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../src/snapshot';
import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { backgroundSnapshotInstanceManager } from '../src/snapshot';
import { prettyFormatSnapshotPatch } from '../src/debug/formatPatch';
import { root } from '../src/lynx-api';

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

describe('background render', () => {
  it('should render component during background initial render', async () => {
    class Comp extends Component {
      render() {
        return <text>{`Hello World`}</text>;
      }
    }

    globalEnvManager.switchToBackground();
    root.render(<Comp />);
    expect(__root.__firstChild.__firstChild.__values).toEqual(['Hello World']);
  });

  it('should render component synchronously during background initial render', async () => {
    class Comp extends Component {
      state = {
        a: 1,
      };
      render() {
        if (this.state.a < 88) {
          this.setState({
            a: this.state.a + 1,
          });
        }
        return <text>{this.state.a}</text>;
      }
    }

    globalEnvManager.switchToBackground();
    root.render(<Comp />);
    process();
    expect(__root.__firstChild.__firstChild.__values).toEqual([88]);
  });
});
