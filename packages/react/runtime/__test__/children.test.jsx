/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { setupPage } from '../src/snapshot';
import { cloneElement, Children } from '../src/index';
import { __root } from '../src/root';
import { globalEnvManager } from './utils/envManager';
import { toChildArray } from 'preact';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('children api', () => {
  it('jsx children', async function() {
    function Comp(props) {
      return props.children;
    }
    __root.__jsx = (
      <Comp>
        <view />
      </Comp>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);
  });

  it('function children', async function() {
    function Comp(props) {
      return props.children('Hello Lynx');
    }
    __root.__jsx = <Comp>{(val) => <text>{val}</text>}</Comp>;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <text>
          <raw-text
            text="Hello Lynx"
          />
        </text>
      </page>
    `);
  });

  it('toChildArray', async function() {
    function Comp(props) {
      const renderJSX = toChildArray(props.children);
      expect(renderJSX).toMatchInlineSnapshot(`
        [
          <__snapshot_a94a8_test_5
            values={
              [
                "init",
              ]
            }
          />,
          <SubComp
            className="a"
            id="init"
          >
            <__snapshot_a94a8_test_6 />
            <__snapshot_a94a8_test_7 />
          </SubComp>,
          <__snapshot_a94a8_test_8 />,
          <__snapshot_a94a8_test_9 />,
        ]
      `);
      return (
        <view className={props.className}>
          {renderJSX.map((child) => {
            console.log(child);
            if (child.props.values) {
              // for builtin element, keep dynamic values array
              expect(child.props).toMatchInlineSnapshot(`
              {
                "values": [
                  "init",
                ],
              }
            `);
            } else if (child.props.id) {
              // for component, keep all props
              expect(child.props).toMatchInlineSnapshot(`
                {
                  "children": [
                    <__snapshot_a94a8_test_6 />,
                    <__snapshot_a94a8_test_7 />,
                  ],
                  "className": "a",
                  "id": "init",
                }
              `);
            }
            return cloneElement(child, { id: 'test' });
          })}
        </view>
      );
    }
    function SubComp(props) {
      return <view id={props.id} className={props.className}></view>;
    }
    const initId = 'init';
    __root.__jsx = (
      <Comp>
        <view id={initId} className='a' />
        <SubComp id={initId} className='a'>
          <text>Hello</text>
          <text>Lynx</text>
        </SubComp>
        {[0].map(() => [
          [<view />],
          <view />,
        ])}
      </Comp>
    );
    renderPage();

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <view
            class="a"
            id="init"
          />
          <view
            class="a"
            id="test"
          />
          <view />
          <view />
        </view>
      </page>
    `);
  });

  it('Children.map', function() {
    let count = 0;
    const Comp = (props) => {
      expect(Children.count(props.children)).toBe(2);
      return Children.map(props.children, (child) => {
        count++;
        return child;
      });
    };
    __root.__jsx = (
      <Comp>
        <view />
        {null}
        <view />
      </Comp>
    );
    renderPage();
    expect(count).toBe(2);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
        <view />
      </page>
    `);
  });

  it('Children.forEach', function() {
    // same with Children.map
    let count = 0;
    const Comp = (props) => {
      expect(Children.count(props.children)).toBe(2);
      return Children.forEach(props.children, (child) => {
        count++;
        return child;
      });
    };
    __root.__jsx = (
      <Comp>
        <view />
        {null}
        <view />
      </Comp>
    );
    renderPage();
    expect(count).toBe(2);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
        <view />
      </page>
    `);
  });

  it('Children.only', function() {
    const OneChildComp = (props) => {
      expect(Children.count(props.children)).toBe(2);
      try {
        return Children.only(props.children);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toMatchInlineSnapshot(`"Children.only"`);
      }
    };
    __root.__jsx = (
      <OneChildComp>
        <view key='a' />
        {null}
        <view key='b' />
      </OneChildComp>
    );
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('Children.count', function() {
    let count = 0;
    const Comp = (props) => {
      count = Children.count(props.children);
      expect(props.children).toMatchInlineSnapshot(`
        [
          <__snapshot_a94a8_test_18 />,
          <__snapshot_a94a8_test_19 />,
          null,
          [
            <__snapshot_a94a8_test_21 />,
            <__snapshot_a94a8_test_21 />,
            <__snapshot_a94a8_test_21 />,
          ],
          <Fragment>
            <__snapshot_a94a8_test_16 />
            <__snapshot_a94a8_test_17 />
          </Fragment>,
          "foo",
          <SubComp>
            <__snapshot_a94a8_test_22 />
            <__snapshot_a94a8_test_23 />
          </SubComp>,
        ]
      `);
      return props.children;
    };
    const SubComp = (props) => {
      expect(props.children).toMatchInlineSnapshot(`
        [
          <__snapshot_a94a8_test_22 />,
          <__snapshot_a94a8_test_23 />,
        ]
      `);
      return props.children;
    };
    let a = false;
    let b = [0, 1, 2];
    let jsx = (
      <>
        <view />
        <view />
      </>
    );
    __root.__jsx = (
      <Comp>
        <view />
        <view />
        {a ? <view /> : null}
        {b.map((item) => <view key={item} />)}
        {jsx}
        foo
        <SubComp>
          <view />
          <view />
        </SubComp>
      </Comp>
    );
    renderPage();
    expect(count).toBe(8);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
        <view />
        <view />
        <view />
        <view />
        <view />
        <view />
        <raw-text
          text="foo"
        />
        <view />
        <view />
      </page>
    `);
  });
});
