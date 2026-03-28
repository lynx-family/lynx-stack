/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { setupPage, BackgroundSnapshotInstance } from '../src/snapshot';
import { cloneElement, createRef } from '../src/index';
import { __root } from '../src/root';
import { globalEnvManager } from './utils/envManager';
import { injectUpdateMainThread } from '../src/lifecycle/patch/updateMainThread';
import { render } from 'preact';
import { clearCommitTaskId, replaceCommitHook } from '../src/lifecycle/patch/commit';

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
    const original = <view className='a'></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone.props.className).toBe('b');
    expect(clone).toMatchInlineSnapshot(`
      <__snapshot_a94a8_test_1
        className="b"
      />
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        />
      </page>
    `);
  });

  it('view with dynamic className', function() {
    const className = 'a';
    const original = <view className={className}></view>;
    const clone = cloneElement(original, {
      className: 'b',
    });
    expect(clone).toMatchInlineSnapshot(`
      <__snapshot_a94a8_test_2
        className="b"
        values={
          [
            "a",
          ]
        }
      />
    `);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="a"
        />
      </page>
    `);
  });

  it('view with key', function() {
    const original = <view key='a'></view>;
    const clone = cloneElement(original, {
      key: 'b',
    });
    expect(clone.key).toBe('b');
    expect(clone).toMatchInlineSnapshot(`<__snapshot_a94a8_test_3 />`);
    __root.__jsx = clone;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
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
        <__snapshot_a94a8_test_4
          values={
            [
              "react-ref--2-0",
            ]
          }
        />
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

  it('cannot clone with new ref', function() {
    let clone, original, ref = createRef();
    const App = () => {
      original = <view />;
      clone = cloneElement(original, {
        ref,
      });
      return clone;
    };
    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(clone).toMatchInlineSnapshot(`<__snapshot_a94a8_test_5 />`);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view />
        </page>
      `);
    }
    // background render
    {
      globalEnvManager.switchToBackground();
      render(<App />, __root);
      // FIXME: cannot get correct ref
      expect(ref.current).toBeInstanceOf(BackgroundSnapshotInstance);
    }
  });

  it('cannot clone view with children', () => {
    const original = <view className='a'></view>;
    const clone = cloneElement(original, {
      className: 'b',
      children: <text>Hello</text>,
    }, <text>Lynx</text>);
    expect(clone).toMatchInlineSnapshot(`
      <__snapshot_a94a8_test_6
        className="b"
      >
        <__snapshot_a94a8_test_8 />
      </__snapshot_a94a8_test_6>
    `);
    try {
      __root.__jsx = clone;
      renderPage();
    } catch (error) {
      expect(error).toMatchInlineSnapshot(`[TypeError: Cannot read properties of null (reading 'length')]`);
    }
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
        <__snapshot_a94a8_test_10 />
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
        <__snapshot_a94a8_test_13 />
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
});
