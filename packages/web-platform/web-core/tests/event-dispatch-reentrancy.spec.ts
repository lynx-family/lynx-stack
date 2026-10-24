// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { createTestLynxViewInstance } from './createTestLynxViewInstance.js';

/**
 * A main-thread event handler runs while the Rust dispatcher is on the stack,
 * so every Element PAPI it calls re-enters the same `MainThreadWasmContext`.
 * `wasm-bindgen` holds a borrow of that context for the whole exported call, so
 * a nested call that needs an exclusive borrow throws "recursive use of an
 * object detected which would lead to unsafe aliasing in rust" - and the throw
 * unwinds out through the dispatcher rather than the handler, aborting the rest
 * of the dispatch.
 *
 * The documented mutate-then-flush pattern hits this through
 * `__FlushElementTree`, which drains the timing flags off the context.
 *
 * @see https://github.com/lynx-family/lynx-stack/issues/3395
 */
function clickOn(node: HTMLElement): void {
  node.dispatchEvent(
    new (globalThis as any).MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('__FlushElementTree called from inside a main-thread event handler', () => {
  let rootDom: ShadowRoot;
  let mts: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;

  beforeEach(() => {
    rstest.resetAllMocks();
    const lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });
    mtsBinding = new WASMJSBinding(createTestLynxViewInstance(rootDom));
    mts = createElementAPI(
      rootDom,
      mtsBinding,
      true,
      true,
      true,
      false,
      false,
      false,
    );
  });

  test('a flush does not abort the rest of the dispatch', () => {
    // The real damage of the throw: it unwinds the dispatcher, so every handler
    // ordered after the flushing one is skipped.
    const parent = mts.__CreateView(0);
    const child = mts.__CreateView(0);
    mts.__AppendElement(parent, child);
    rootDom.appendChild(parent);

    const order: string[] = [];
    mtsBinding.lynxViewInstance.mainThreadGlobalThis.runWorklet = (handler) => {
      const id = (handler as { _wkltId: string })._wkltId;
      order.push(id);
      if (id === 'child') {
        mts.__FlushElementTree(child, undefined);
      }
    };
    mts.__AddEvent(child, 'bindEvent', 'tap', {
      type: 'worklet',
      value: { _wkltId: 'child' },
    });
    mts.__AddEvent(parent, 'bindEvent', 'tap', {
      type: 'worklet',
      value: { _wkltId: 'parent' },
    });

    clickOn(child);

    expect(order).toStrictEqual(['child', 'parent']);
  });

  test('a worklet handler can flush', () => {
    // `main-thread:bind*` goes through `runWorklet` while the Rust dispatcher
    // still holds a shared borrow of the wasm context.
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    let error: unknown = undefined;
    let called = false;

    mtsBinding.lynxViewInstance.mainThreadGlobalThis.runWorklet = () => {
      called = true;
      try {
        mts.__FlushElementTree(node, undefined);
      } catch (e) {
        error = e;
      }
    };
    mts.__AddEvent(node, 'bindEvent', 'tap', {
      type: 'worklet',
      value: { _wkltId: 'x' },
    });

    clickOn(node);

    expect(called).toBe(true);
    expect(error).toBe(undefined);
  });
});
