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

describe('Element PAPIs called from inside a main-thread event handler', () => {
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

  /**
   * Runs `body` inside a `tap` handler on `node` and reports what it threw.
   * The throw has to be captured here: it unwinds through the wasm frames and
   * out of `dispatchEvent`, where jsdom reports it as an uncaught error instead
   * of surfacing it to the caller.
   */
  const duringDispatch = (
    node: HTMLElement,
    body: () => void,
  ): { called: boolean; error: unknown } => {
    const result: { called: boolean; error: unknown } = {
      called: false,
      error: undefined,
    };
    mts.__AddEventListener(node, 'tap', () => {
      result.called = true;
      try {
        body();
      } catch (error) {
        result.error = error;
      }
    }, {});
    clickOn(node);
    return result;
  };

  test('__FlushElementTree does not throw', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);

    const result = duringDispatch(node, () => {
      mts.__FlushElementTree(node, undefined);
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
  });

  test('a flush does not abort the rest of the dispatch', () => {
    // The real damage of the throw: it unwinds the dispatcher, so every handler
    // ordered after the flushing one is skipped.
    const parent = mts.__CreateView(0);
    const child = mts.__CreateView(0);
    mts.__AppendElement(parent, child);
    rootDom.appendChild(parent);

    const order: string[] = [];
    mts.__AddEventListener(child, 'tap', () => {
      order.push('child');
      mts.__FlushElementTree(child, undefined);
    }, {});
    mts.__AddEventListener(parent, 'tap', () => {
      order.push('parent');
    }, {});

    clickOn(child);

    expect(order).toStrictEqual(['child', 'parent']);
  });

  test('__AddEvent does not throw', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);

    const result = duringDispatch(node, () => {
      mts.__AddEvent(node, 'bindEvent', 'longpress', 'onLongPress');
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
  });

  test('__AddEventListener does not throw and the listener takes effect', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const added = rstest.fn();

    const result = duringDispatch(node, () => {
      mts.__AddEventListener(node, 'longpress', added, {});
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);

    node.dispatchEvent(
      new (globalThis as any).Event('longpress', { bubbles: true }),
    );
    expect(added).toHaveBeenCalledTimes(1);
  });

  test('__SetDataset and __AddDataset do not throw', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);

    const result = duringDispatch(node, () => {
      mts.__SetDataset(node, { a: '1' });
      mts.__AddDataset(node, 'b', '2');
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
    expect(mts.__GetDataByKey(node, 'a')).toBe('1');
    expect(mts.__GetDataByKey(node, 'b')).toBe('2');
  });

  test('__CreateView does not throw and yields a usable element', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    let created: HTMLElement | undefined;

    const result = duringDispatch(node, () => {
      created = mts.__CreateView(0);
      mts.__AppendElement(node, created);
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
    expect(created?.parentElement).toBe(node);
    // a freshly created element is fully registered, not a half-written slot
    expect(mts.__GetElementUniqueID(created!)).toBeGreaterThan(0);
  });

  test('__SetCSSId does not throw', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);

    const result = duringDispatch(node, () => {
      mts.__SetCSSId([node], 1);
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
  });

  test('the handler can mutate the element it is dispatching on', () => {
    // `dispatch_event_by_path` holds the current target's `LynxElementData`
    // while it calls into JS, so a handler writing to its own currentTarget
    // hits the inner `RefCell` rather than the wasm-bindgen guard.
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);

    const result = duringDispatch(node, () => {
      mts.__AddDataset(node, 'touched', 'yes');
      mts.__AddEvent(node, 'bindEvent', 'longpress', 'onLongPress');
    });

    expect(result.called).toBe(true);
    expect(result.error).toBe(undefined);
    expect(mts.__GetDataByKey(node, 'touched')).toBe('yes');
  });

  test('a worklet handler can flush', () => {
    // `main-thread:bind*` goes through `runWorklet`, a different binding from
    // the `__AddEventListener` closure path but the same dispatcher.
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
  test('a flush from a worklet handler does not abort the rest of the dispatch', () => {
    // Same guarantee as the `__AddEventListener` case above, but with the
    // flushing handler on the `runWorklet` path. Kept from #3438 so the worklet
    // dispatcher keeps its own bubbling-order regression.
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
});
