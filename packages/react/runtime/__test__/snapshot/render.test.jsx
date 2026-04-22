// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render, Component, process } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import '../../src/snapshot/lynx/component';
import { __root } from '../../src/root';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot';
import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { backgroundSnapshotInstanceManager } from '../../src/snapshot/snapshot/backgroundSnapshot';
import { prettyFormatSnapshotPatch } from '../../src/snapshot/debug/formatPatch';
import { root } from '../../src/lynx-api';
import { waitSchedule } from './utils/nativeMethod';

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

describe('dual-thread render', () => {
  it('render different code in main thread and background thread', async () => {
    const App = () => {
      return (
        <view>
          <text>Hello</text>
        </view>
      );
    };
    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
          </view>
        </page>
      `);
      expect(__root.__values).toEqual(undefined);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(
        <page className='background-page'>
          <App />
        </page>,
      );
      expect(__root.__values).toMatchInlineSnapshot(`
        [
          {
            "__spread": true,
            "className": "background-page",
          },
        ]
      `);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          class="background-page"
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Hello"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});
