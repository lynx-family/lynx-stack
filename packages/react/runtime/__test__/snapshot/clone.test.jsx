/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree, waitSchedule } from './utils/nativeMethod';
import { setupPage } from '../../src/snapshot';
import { cloneElement, createElement, createRef } from '../../src/index';
import { __root } from '../../src/root';
import { globalEnvManager } from './utils/envManager';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { render } from 'preact';
import { clearCommitTaskId, replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  clearCommitTaskId();
});

afterEach(() => {
  vi.restoreAllMocks();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

// FIXME: cannot change attribute value of builtin element cause snapshot is compiled structure
describe('clone element', () => {
  it('view with className', function() {
    const original = <view className='a' id='id-a'></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone.props).toMatchInlineSnapshot(`
      {
        "values": [
          {
            "__spread": true,
            "className": "b",
          },
        ],
      }
    `);
    expect(clone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_1"`);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
      </page>
    `);
  });

  it('view with dynamic className', function() {
    const className = 'a';
    const id = 'id-a';
    const original = <view className={className} id={id}></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone.props).toMatchInlineSnapshot(`
      {
        "values": [
          "a",
          "id-a",
          {
            "__spread": true,
            "className": "b",
          },
        ],
      }
    `);
    expect(clone.type).toMatchInlineSnapshot(`"__clone_2___snapshot_a94a8_test_2"`);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
      </page>
    `);
  });

  it('view without props', function() {
    const original = <view className='a' id='id-a'></view>;
    const clone = cloneElement(original);
    expect(clone.props).toMatchInlineSnapshot(`{}`);
    expect(clone.type).toMatchInlineSnapshot(`"__snapshot_a94a8_test_3"`);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
          id="id-a"
        />
      </page>
    `);
  });

  it('view with key', function() {
    let clone;
    const App = () => {
      const original = <view key='a'></view>;
      clone = cloneElement(original, {
        key: 'b',
      });
      return clone;
    };
    __root.__jsx = <App />;
    renderPage();
    // createVNode in lepus ignore key
    expect(clone.key).toBe(undefined);
    expect(clone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_4"`);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);

    // background render
    globalEnvManager.switchToBackground();
    render(<App />, __root);
    expect(clone.key).toBe('b');
    expect(clone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_4"`);
    render(clone, __root);
  });

  it('view with ref', function() {
    let clone, original, ref = createRef();
    const App = () => {
      original = <view ref={ref} />;
      clone = cloneElement(original);
      return clone;
    };
    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(clone).toMatchInlineSnapshot(`
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -2,
          "type": "__snapshot_a94a8_test_5",
          "values": [
            "react-ref--2-0",
          ],
        }
      `);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            react-ref--2-0={1}
          />
        </page>
      `);
    }
    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(ref.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            2,
            0,
          ],
          "task": undefined,
        }
      `);
    }
  });

  it('clone with new ref', function() {
    let clone, original, preRef = createRef(), ref = createRef();
    const App = () => {
      original = <view ref={preRef} />;
      clone = cloneElement(original, {
        ref,
      });
      return clone;
    };
    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(clone).toMatchInlineSnapshot(`
        {
          "children": undefined,
          "extraProps": undefined,
          "id": -2,
          "type": "__clone_1___snapshot_a94a8_test_6",
          "values": [
            "react-ref--2-0",
            {
              "ref": "react-ref--2-1",
            },
          ],
        }
      `);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view
            react-ref--2-0={1}
            react-ref--2-1={1}
          />
        </page>
      `);
    }
    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      expect(ref.current).toMatchInlineSnapshot(`
        RefProxy {
          "refAttr": [
            2,
            1,
          ],
          "task": undefined,
        }
      `);
    }
  });

  it('cannot clone view with children', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = <view className='a'></view>;
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Hello</text>,
    }, <text>Lynx</text>);
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith('cloneElement from compiled snapshot with children is not supported');
    expect(clone).toMatchInlineSnapshot(`
      {
        "children": undefined,
        "extraProps": undefined,
        "id": -2,
        "type": "__clone_0___snapshot_a94a8_test_7",
        "values": undefined,
      }
    `);
    __root.__jsx = clone;
    renderPage();
  });

  it('component with props', function() {
    function Comp(props) {
      return (
        <view className={props.className}>
          {props.children}
        </view>
      );
    }
    const original = <Comp className='a' />;
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Hello</text>,
    });
    expect(clone).toMatchInlineSnapshot(`
      <Comp
        className="b"
      >
        <__snapshot_a94a8_test_11 />
      </Comp>
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clone component with children', function() {
    function Comp(props) {
      return (
        <view className={props.className}>
          {props.children}
        </view>
      );
    }
    const original = <Comp className='a' />;
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Hello</text>,
    }, <text>Lynx</text>);
    expect(clone).toMatchInlineSnapshot(`
      <Comp
        className="b"
      >
        <__snapshot_a94a8_test_14 />
      </Comp>
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Lynx"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clone view with no props by createElement', function() {
    const original = createElement('view');
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone.props).toStrictEqual({ values: [{ className: 'b', __spread: true }] });
    expect(clone).toMatchInlineSnapshot(`
      {
        "children": undefined,
        "extraProps": undefined,
        "id": -3,
        "type": "view",
        "values": undefined,
      }
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        />
      </page>
    `);
  });

  it('clone view with props by createElement', function() {
    const original = createElement('view', { className: 'a', id: 'id-a' });
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone.props).toStrictEqual({ values: [{ className: 'b', id: 'id-a', __spread: true }] });
    expect(clone).toMatchInlineSnapshot(`
      {
        "children": undefined,
        "extraProps": undefined,
        "id": -3,
        "type": "view",
        "values": undefined,
      }
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
      </page>
    `);
  });

  it('clone view without precomputed value slots by createElement', function() {
    const original = createElement('view');
    const clone = cloneElement({
      ...original,
      props: {},
    }, {
      className: 'b',
    });

    expect(clone.props.values).toStrictEqual([
      {
        className: 'b',
        __spread: true,
      },
    ]);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        />
      </page>
    `);
  });

  it('clone view with children by createElement', function() {
    const original = createElement('view', undefined, <text>Hello</text>);
    const clone = cloneElement(original, {
      className: 'b',
    }, <text>Lynx</text>);
    expect(clone.props).toMatchInlineSnapshot(`
      {
        "$0": <__snapshot_a94a8_test_16 />,
        "values": [
          {
            "__spread": true,
            "className": "b",
          },
        ],
      }
    `);
    expect(clone).toMatchInlineSnapshot(`
      {
        "children": undefined,
        "extraProps": undefined,
        "id": -3,
        "type": "view",
        "values": undefined,
      }
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Lynx"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clone compiled snapshot multiple times', function() {
    const original = <view className='a' id='id-a'></view>;
    const firstClone = cloneElement(original, {
      className: 'b',
    });
    const secondClone = cloneElement(firstClone, {
      id: 'id-b',
    });

    expect(firstClone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_17"`);
    expect(secondClone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_17"`);
    expect(firstClone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'b',
      },
    ]);
    expect(secondClone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'b',
        id: 'id-b',
      },
    ]);

    __root.__jsx = (
      <>
        {firstClone}
        {secondClone}
      </>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
        <view
          class="b"
          id="id-b"
        />
      </page>
    `);
  });

  it('clone compiled snapshot multiple times with original spread', function() {
    const props = {
      id: 'id-a',
    };
    const original = <view className='a' {...props}></view>;
    const firstClone = cloneElement(original, {
      className: 'b',
    });
    const secondClone = cloneElement(firstClone, {
      id: 'id-b',
    });

    expect(firstClone.type).toMatchInlineSnapshot(`"__clone_1___snapshot_a94a8_test_18"`);
    expect(secondClone.type).toMatchInlineSnapshot(`"__clone_1___snapshot_a94a8_test_18"`);
    expect(firstClone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'a',
        id: 'id-a',
      },
      {
        __spread: true,
        className: 'b',
      },
    ]);
    expect(secondClone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'a',
        id: 'id-a',
      },
      {
        __spread: true,
        className: 'b',
        id: 'id-b',
      },
    ]);

    __root.__jsx = (
      <>
        {firstClone}
        {secondClone}
      </>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
        <view
          class="b"
          id="id-b"
        />
      </page>
    `);
  });

  it('clone same compiled snapshot node multiple times', function() {
    const original = <view className='a' id='id-a'></view>;
    const firstClone = cloneElement(original, {
      className: 'b',
    });
    const secondClone = cloneElement(original, {
      id: 'id-b',
    });

    expect(firstClone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_19"`);
    expect(secondClone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_19"`);
    expect(firstClone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'b',
      },
    ]);
    expect(secondClone.props.values).toStrictEqual([
      {
        __spread: true,
        id: 'id-b',
      },
    ]);

    __root.__jsx = (
      <>
        {firstClone}
        {secondClone}
      </>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
        <view
          class="a"
          id="id-b"
        />
      </page>
    `);
  });

  it('clone view keeps children by createElement', function() {
    const original = createElement('view', { className: 'a' }, <text>Hello</text>);
    const clone = cloneElement(original, {
      className: 'b',
    });

    expect(clone.props.values).toStrictEqual([
      {
        className: 'b',
        __spread: true,
      },
    ]);
    expect(clone.props.$0).toBeDefined();

    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clone view with props children by createElement', function() {
    const original = createElement('view', { className: 'a' });
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Props</text>,
    });

    expect(clone.props.values).toStrictEqual([
      {
        className: 'b',
        __spread: true,
      },
    ]);
    expect(clone.props.$0).toBeDefined();

    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Props"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clone view with props children and rest by createElement', function() {
    const original = createElement('view', { className: 'a' }, <text>Original</text>);
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Props</text>,
    }, <text>Rest</text>);

    expect(clone.props.values).toStrictEqual([
      {
        className: 'b',
        __spread: true,
      },
    ]);
    expect(clone.props.$0).toBeDefined();

    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Rest"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('clones a repeated compiled snapshot with a missing clone spread value', function() {
    const original = <view className='a' id='id-a'></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });
    const repeatedClone = cloneElement({
      ...clone,
      props: {
        values: [],
      },
    }, {
      id: 'id-b',
    });

    expect(repeatedClone.props.values).toStrictEqual([
      {
        __spread: true,
        id: 'id-b',
      },
    ]);
    __root.__jsx = repeatedClone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
          id="id-b"
        />
      </page>
    `);
  });

  it('rejects malformed repeated clone snapshot types', function() {
    const malformedClone = {
      type: '__clone_bad___snapshot_missing',
      props: {
        values: [],
      },
    };

    expect(() => cloneElement(malformedClone, { id: 'id-b' })).toThrow(
      'Invalid clone snapshot type: __clone_bad___snapshot_missing',
    );
  });

  it('rejects clone snapshot types with raw original types', function() {
    expect(() => createElement('__clone_0_view')).toThrow('Invalid clone snapshot type: __clone_0_view');
  });

  it('rejects clone snapshot types when the original snapshot is missing', function() {
    expect(() => createElement('__clone_0___snapshot_missing')).toThrow('Snapshot not found: __snapshot_missing');
  });

  it('clone compiled snapshot with original spread', function() {
    const props = {
      id: 'id-a',
    };
    const original = <view className='a' {...props}></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });

    expect(clone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'a',
        id: 'id-a',
      },
      {
        __spread: true,
        className: 'b',
      },
    ]);

    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
      </page>
    `);
  });

  it('clone compiled snapshot keeps original dynamic children', function() {
    const child = <text>Hello</text>;
    const original = (
      <view className='a'>
        {child}
      </view>
    );
    const clone = cloneElement(original, {
      className: 'b',
    });

    expect(clone.props.values).toStrictEqual([
      {
        __spread: true,
        className: 'b',
      },
    ]);
    expect(clone.props.$0).toBeDefined();

    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
        >
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('applies background cloneElement patch when main thread misses clone snapshot definition', async function() {
    let clone;
    const App = () => {
      const original = <view key='a'></view>;
      clone = __BACKGROUND__
        ? cloneElement(original, {
          key: 'b',
        })
        : null;
      return clone;
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);

    // background render
    globalEnvManager.switchToBackground();
    render(<App />, __root);
    expect(clone.key).toBe('b');
    expect(clone.type).toMatchInlineSnapshot(`"__clone_0___snapshot_a94a8_test_29"`);
    render(clone, __root);

    // hydrate
    lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

    // rLynxChange
    globalEnvManager.switchToMainThread();
    globalThis.__OnLifecycleEvent.mockClear();
    const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
    expect(() => globalThis[rLynxChange[0]](rLynxChange[1])).not.toThrow();
    expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    await waitSchedule();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('applies background cloneElement patch with original spread clone snapshot', async function() {
    let clone;
    const App = () => {
      const props = {
        id: 'id-a',
      };
      const original = <view className='a' {...props}></view>;
      clone = __BACKGROUND__
        ? cloneElement(original, {
          className: 'b',
        })
        : null;
      return clone;
    };
    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);

    // background render
    globalEnvManager.switchToBackground();
    render(<App />, __root);
    expect(clone.type).toMatchInlineSnapshot(`"__clone_1___snapshot_a94a8_test_30"`);
    render(clone, __root);

    // hydrate
    lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

    // rLynxChange
    globalEnvManager.switchToMainThread();
    globalThis.__OnLifecycleEvent.mockClear();
    const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
    expect(() => globalThis[rLynxChange[0]](rLynxChange[1])).not.toThrow();
    expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    await waitSchedule();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="b"
          id="id-a"
        />
      </page>
    `);
  });
});
