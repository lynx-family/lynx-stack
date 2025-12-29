import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __page } from '../src/snapshot';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';
import { useRef, useState } from '../src/index';
import { __root } from '../src/root';
import { render } from 'preact';
import { replaceCommitHook } from '../src/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch } from '../src/lifecycle/patch/snapshotPatch';

beforeEach(() => {
  replaceCommitHook();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

afterEach(async () => {
  // Ensure preach/hooks global variable `afterPaintEffects` is safely cleared, avoid preact internal state error
  // otherwise, previous case will pollute the next case
  vi.clearAllMocks();
  await Promise.resolve().then(() => {
    //
  });
  deinitGlobalSnapshotPatch();
});

describe('support <page /> element attributes', () => {
  it('should compile on single page', () => {
    function Comp() {
      return <page />;
    }
    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('should support <page /> element attributes', () => {
    function Comp() {
      const customVariable = 'custom-value';
      const dataAttr = 'data-attr';
      const ref = useRef(null);

      return (
        <page
          custom-key-str='custom-value'
          custom-key-var={customVariable}
          class='classValue'
          data-attr={dataAttr}
          bindtap={() => {
            console.log('tap page');
          }}
          ref={ref}
        >
          <view>
          </view>
        </page>
      );
    }

    globalEnvManager.switchToMainThread();
    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        class="classValue"
        cssId="default-entry-from-native:0"
        custom-key-str="custom-value"
        custom-key-var="custom-value"
        dataset={
          {
            "attr": "data-attr",
          }
        }
        event={
          {
            "bindEvent:tap": "-1:0:bindtap",
          }
        }
        react-ref--1-0={1}
      >
        <view />
      </page>
    `);
  });

  it('should report error when having multiple <page /> elements', async () => {
    let errors = [];
    // mock lynx.reportError
    vi.spyOn(lynx, 'reportError').mockImplementation((...args) => {
      errors.push(args[0]);
    });
    function Comp() {
      return (
        <page>
          <view>
            <text>Hello page</text>
          </view>
          <page>
            <view>
              <text>Hello page2</text>
            </view>
          </page>
        </page>
      );
    }

    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello page"
            />
          </text>
        </view>
        <view>
          <text>
            <raw-text
              text="Hello page2"
            />
          </text>
        </view>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }
    expect(errors).toMatchInlineSnapshot(`[]`);
    vi.clearAllMocks();
  });

  it('should support switch <page /> element', async () => {
    let _setFlag;
    function Comp() {
      const [flag, setFlag] = useState(true);
      _setFlag = setFlag;

      return (
        flag
          ? (
            <page id='page'>
              <view>
                <text>Hello page</text>
              </view>
              <text>flag: {flag.toString()}</text>
            </page>
          )
          : (
            <page id='page2'>
              <view>
                <text>Hello page2</text>
              </view>
              <text>flag: {flag.toString()}</text>
            </page>
          )
      );
    }
    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
        id="page"
      >
        <view>
          <text>
            <raw-text
              text="Hello page"
            />
          </text>
        </view>
        <text>
          <raw-text
            text="flag: "
          />
          <wrapper>
            <raw-text
              text="true"
            />
          </wrapper>
        </text>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
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
    }

    // update
    {
      globalEnvManager.switchToBackground();
      _setFlag(false);
      await waitSchedule();
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[1];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
        id="page2"
      >
        <view>
          <text>
            <raw-text
              text="Hello page2"
            />
          </text>
        </view>
        <text>
          <raw-text
            text="flag: "
          />
          <wrapper>
            <raw-text
              text="false"
            />
          </wrapper>
        </text>
      </page>
    `);
  });

  it('should support adjacent <page /> elements', () => {
    function Comp() {
      return (
        <page>
          <page>
            <page />
            <page>
              <page />
            </page>
          </page>
          <page />
          <view></view>
        </page>
      );
    }
    __root.__jsx = <Comp />;
    renderPage();
    if (__root.__firstChild) {
      __root.__firstChild.__element_root = __page;
      __root.__firstChild.__firstChild = __root.__firstChild.__nextSibling;
      __root.removeChild(__root.__firstChild);
    }
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('should support switch <page /> to other element', async () => {
    let _setFlag;
    function Comp() {
      const [flag, setFlag] = useState(true);
      _setFlag = setFlag;

      return (
        flag
          ? (
            <page id='page'>
              <view>
                <text>Hello page</text>
              </view>
              <text>flag: {flag.toString()}</text>
            </page>
          )
          : <text>flag: {flag.toString()}</text>
      );
    }
    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
        id="page"
      >
        <view>
          <text>
            <raw-text
              text="Hello page"
            />
          </text>
        </view>
        <text>
          <raw-text
            text="flag: "
          />
          <wrapper>
            <raw-text
              text="true"
            />
          </wrapper>
        </text>
      </page>
    `);

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
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
    }

    // update
    {
      globalEnvManager.switchToBackground();
      _setFlag(false);
      await waitSchedule();
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[1];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
        id={null}
      >
        <text>
          <raw-text
            text="flag: "
          />
          <wrapper>
            <raw-text
              text="false"
            />
          </wrapper>
        </text>
      </page>
    `);
  });
});
