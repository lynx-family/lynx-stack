/** @jsxImportSource ../lepus */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree, options } from './utils/nativeMethod';
import { __page as __internalPage } from '../src/internal';
import { jsReadyEventIdSwap } from '../src/lifecycle/event/jsReady';
import { __root } from '../src/root';
import { clearPage } from '../src/snapshot';

const ssrIDMap = new Map();

beforeAll(() => {
  globalEnvManager.switchToMainThread();
  globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = true;

  let ssrID = 666;
  options.onCreateElement = element => {
    element.ssrID = ssrID++;
    element.toJSON = function() {
      return {
        ssrID: this.ssrID,
      };
    };

    ssrIDMap.set(element.ssrID, element);
  };
});

afterAll(() => {
  delete options.onCreateElement;
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  globalEnvManager.switchToMainThread();
});

afterEach(() => {});

describe('ssr', () => {
  it('basic - ssrEncode', () => {
    function Comp() {
      return <view />;
    }
    __root.__jsx = <Comp />;

    renderPage();
    expect(JSON.parse(ssrEncode())).toMatchInlineSnapshot(`
      {
        "__opcodes": [
          0,
          [
            "__Card__:__snapshot_a94a8_test_1",
            -2,
            [
              {
                "ssrID": 667,
              },
            ],
          ],
          1,
        ],
      }
    `);
  });

  it('basic - ssrEncode - nested', () => {
    function Hello() {
      return (
        <view>
          <World />
        </view>
      );
    }
    function World() {
      return (
        <view>
          <text>Hello World</text>
          <HelloLynx />
        </view>
      );
    }
    function HelloLynx() {
      return (
        <view>
          <Lynx />
        </view>
      );
    }
    function Lynx() {
      return (
        <view>
          <text>Hello Lynx</text>
          <text>Hello Lynx</text>
        </view>
      );
    }
    __root.__jsx = <Hello />;
    renderPage();
    expect(JSON.parse(ssrEncode())).toMatchInlineSnapshot(`
      {
        "__opcodes": [
          0,
          [
            "__Card__:__snapshot_a94a8_test_2",
            -2,
            [
              {
                "ssrID": 669,
              },
            ],
          ],
          0,
          [
            "__Card__:__snapshot_a94a8_test_3",
            -3,
            [
              {
                "ssrID": 670,
              },
              {
                "ssrID": 671,
              },
              {
                "ssrID": 672,
              },
              {
                "ssrID": 673,
              },
            ],
          ],
          0,
          [
            "__Card__:__snapshot_a94a8_test_4",
            -4,
            [
              {
                "ssrID": 674,
              },
            ],
          ],
          0,
          [
            "__Card__:__snapshot_a94a8_test_5",
            -5,
            [
              {
                "ssrID": 675,
              },
              {
                "ssrID": 676,
              },
              {
                "ssrID": 677,
              },
              {
                "ssrID": 678,
              },
              {
                "ssrID": 679,
              },
            ],
          ],
          1,
          1,
          1,
          1,
        ],
      }
    `);
  });

  it('basic - ssrEncode - attribute', () => {
    const c = 'red';
    const s = { color: 'red' };
    function Comp() {
      return (
        <view
          className={c}
          style={s}
          bindtap={() => {}}
          ref={() => {}}
          main-thread:bindtap={{ _wkltId: '1' }}
          main-thread:ref={{ _wkltId: '2' }}
          data-xxx={c}
        />
      );
    }
    __root.__jsx = <Comp />;
    renderPage();
    expect(JSON.parse(ssrEncode())).toMatchInlineSnapshot(`
      {
        "__opcodes": [
          0,
          [
            "__Card__:__snapshot_a94a8_test_6",
            -2,
            [
              {
                "ssrID": 681,
              },
            ],
          ],
          2,
          "values",
          [
            "red",
            {
              "color": "red",
            },
            "-2:2:",
            "-2:3:",
            {
              "_wkltId": "1",
              "_workletType": "main-thread",
            },
            {
              "_wkltId": "2",
            },
            "red",
          ],
          1,
        ],
      }
    `);
  });

  it('basic - ssrEncode - JSXSpread', () => {
    const c = 'red';
    const s = { color: 'red' };

    function Comp() {
      const props = {
        className: c,
        style: s,
        bindtap: () => {},
        ref: () => {},
        'main-thread:bindtap': { _wkltId: '1' },
        'main-thread:ref': { _wkltId: '2' },
        'data-xxx': c,
      };
      return <view {...props} />;
    }

    __root.__jsx = <Comp />;
    renderPage();
    expect(JSON.parse(ssrEncode())).toMatchInlineSnapshot(`
      {
        "__opcodes": [
          0,
          [
            "__Card__:__snapshot_a94a8_test_7",
            -2,
            [
              {
                "ssrID": 683,
              },
            ],
          ],
          2,
          "values",
          [
            {
              "bindtap": "-2:0:bindtap",
              "className": "red",
              "data-xxx": "red",
              "main-thread:bindtap": {
                "_wkltId": "1",
                "_workletType": "main-thread",
              },
              "main-thread:ref": {
                "_wkltId": "2",
              },
              "ref": "-2:0:ref",
              "style": {
                "color": "red",
              },
            },
          ],
          1,
        ],
      }
    `);
  });

  it('basic - ssrEncode - page', () => {
    function Hello() {
      return (
        <view>
          <World />
        </view>
      );
    }
    function World() {
      return (
        <view>
          <text>Hello World</text>
          <HelloLynx />
        </view>
      );
    }
    function HelloLynx() {
      return (
        <view>
          <page className={`xxxx`} />
        </view>
      );
    }
    __root.__jsx = <Hello />;
    renderPage();
    expect(JSON.parse(ssrEncode())).toMatchInlineSnapshot(`
      {
        "__opcodes": [
          0,
          [
            "__Card__:__snapshot_a94a8_test_8",
            -2,
            [
              {
                "ssrID": 685,
              },
            ],
          ],
          0,
          [
            "__Card__:__snapshot_a94a8_test_9",
            -3,
            [
              {
                "ssrID": 686,
              },
              {
                "ssrID": 687,
              },
              {
                "ssrID": 688,
              },
              {
                "ssrID": 689,
              },
            ],
          ],
          0,
          [
            "__Card__:__snapshot_a94a8_test_10",
            -4,
            [
              {
                "ssrID": 690,
              },
            ],
          ],
          1,
          1,
          1,
        ],
        "__root_values": [
          {
            "className": "xxxx",
          },
        ],
      }
    `);
  });

  it('basic - ssrHydrate', () => {
    function Hello() {
      return (
        <view>
          <World />
        </view>
      );
    }
    function World() {
      return (
        <view>
          <text>Hello World</text>
          <HelloLynx />
        </view>
      );
    }
    function HelloLynx() {
      return (
        <view>
          <page className={`xxxx`} />
        </view>
      );
    }
    __root.__jsx = <Hello />;
    renderPage();

    const __page = __root.__element_root;

    const info = ssrEncode();

    globalEnvManager.resetEnv();
    globalEnvManager.switchToMainThread();
    elementTree.clear();

    const __GetPageElement = () => __page;
    const __GetTemplateParts = () => Object.fromEntries(ssrIDMap.entries());
    vi.stubGlobal('__GetPageElement', __GetPageElement);
    vi.stubGlobal('__GetTemplateParts', __GetTemplateParts);

    ssrHydrate(info);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        class="xxxx"
        cssId="default-entry-from-native:0"
      >
        <view>
          <view>
            <text>
              <raw-text
                text="Hello World"
              />
            </text>
            <wrapper>
              <view />
            </wrapper>
          </view>
        </view>
      </page>
    `);

    vi.unstubAllGlobals();
  });

  it('basic - ssrEncode - list', () => {
    function Hello() {
      return (
        <list id='ssr-list'>
          {[1, 2, 3].map((item, index) => {
            return (
              <list-item item-key={`${index}`} key={`${index}`}>
                <text>{item}</text>
              </list-item>
            );
          })}
        </list>
      );
    }
    __root.__jsx = <Hello />;
    renderPage();

    const listRef = elementTree.getElementById('ssr-list');
    const uiSign1 = elementTree.triggerComponentAtIndex(listRef, 0);
    const uiSign2 = elementTree.triggerComponentAtIndex(listRef, 1);
    const uiSign3 = elementTree.triggerComponentAtIndex(listRef, 2);

    const info = ssrEncode();
    clearPage();

    const __page = __root.__element_root;

    globalEnvManager.resetEnv();
    globalEnvManager.switchToMainThread();
    delete listRef.componentAtIndex;
    delete listRef.enqueueComponent;

    const __GetPageElement = () => __page;
    const __GetTemplateParts = () => Object.fromEntries(ssrIDMap.entries());
    vi.stubGlobal('__GetPageElement', __GetPageElement);
    vi.stubGlobal('__GetTemplateParts', __GetTemplateParts);

    ssrHydrate(info);
    expect(__internalPage).toBe(__page);
    expect(jsReadyEventIdSwap).toEqual({});
    {
      const listRef = elementTree.getElementById('ssr-list');
      expect(elementTree.triggerComponentAtIndex(listRef, 0)).toEqual(uiSign1);
      expect(elementTree.triggerComponentAtIndex(listRef, 1)).toEqual(uiSign2);
      expect(elementTree.triggerComponentAtIndex(listRef, 2)).toEqual(uiSign3);
    }

    vi.unstubAllGlobals();
  });
});
