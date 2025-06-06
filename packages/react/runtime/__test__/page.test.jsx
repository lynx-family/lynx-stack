import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __page } from '../src/snapshot';
import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { useRef, useState } from '../src/index';
import { __root } from '../src/root';

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  vi.useFakeTimers();
});

afterEach(async () => {
  // Ensure preach/hooks global variable `afterPaintEffects` is safely cleared, avoid preact internal state error
  // otherwise, previous case will pollute the next case
  vi.clearAllMocks();
  await Promise.resolve().then(() => {
    //
  });
  vi.runAllTimers();
  vi.useRealTimers();
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
    await Promise.resolve().then(() => {
      //
    });
    vi.runAllTimers();
    expect(errors).toMatchInlineSnapshot(`
      [
        [Error: Attempt to render more than one \`<page />\`, which is not supported.],
        [Error: Attempt to render more than one \`<page />\`, which is not supported.],
      ]
    `);
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
    await Promise.resolve().then(() => {
      //
    });
    vi.runAllTimers();
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
    _setFlag(false);
    await Promise.resolve().then(() => {
      //
    });
    vi.runAllTimers();
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
    await Promise.resolve().then(() => {
      //
    });
    vi.runAllTimers();
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
    _setFlag(false);
    await Promise.resolve().then(() => {
      //
    });
    vi.runAllTimers();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
        react-ref--1-0={1}
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
