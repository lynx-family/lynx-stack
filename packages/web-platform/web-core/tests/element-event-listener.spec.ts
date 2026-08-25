// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { createTestLynxViewInstance } from './createTestLynxViewInstance.js';
import type { MainThreadScriptEvent } from '../ts/types/index.js';

function queuedCallbacksDone(): Promise<void> {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => queueMicrotask(() => resolve()));
  });
}

/**
 * Fire a real DOM `click` on `node`. `click` is the W3C event that
 * `W3cEventNameToLynx` maps to the Lynx `tap` event, so this is what a `tap`
 * listener must observe. The returned promise settles after callbacks queued
 * by the dispatch, including nested cleanup microtasks, have run.
 */
function clickOn(node: HTMLElement): Promise<void> {
  node.dispatchEvent(
    new (globalThis as any).MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
  return queuedCallbacksDone();
}

describe('__AddEventListener / __RemoveEventListener', () => {
  let rootDom: ShadowRoot;
  let mts: ReturnType<typeof createElementAPI>;
  let mtsBinding: WASMJSBinding;

  beforeEach(() => {
    rstest.resetAllMocks();
    const lynxViewDom = document.createElement('div') as unknown as HTMLElement;
    rootDom = lynxViewDom.attachShadow({ mode: 'open' });
    mtsBinding = new WASMJSBinding(createTestLynxViewInstance(rootDom));
    // All eight parameters are declared required; the three `transform_*` flags
    // only affect `__SetInlineStyles`, which these tests never call.
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

  test('the PAPIs are exposed on the element API surface', () => {
    expect(typeof mts.__AddEventListener).toBe('function');
    expect(typeof mts.__RemoveEventListener).toBe('function');
    // must not collide with the existing string-handler PAPI
    expect(mts.__AddEventListener).not.toBe(mts.__AddEvent);
  });

  test('a tap callback fires on a real DOM click', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    await clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('callbacks are delayed by one microtask', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const order: string[] = [];

    mts.__AddEventListener(node, 'tap', () => order.push('callback'), {});
    const callbacksDone = clickOn(node);
    order.push('synchronous');

    expect(order).toStrictEqual(['synchronous']);
    await Promise.resolve();
    expect(order).toStrictEqual(['synchronous', 'callback']);
    await callbacksDone;
  });

  test('the callback receives a Lynx event object', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    let received: MainThreadScriptEvent | undefined;

    mts.__AddEventListener(node, 'tap', (e) => {
      received = e;
    }, {});
    await clickOn(node);

    // `click` is surfaced under its Lynx name
    expect(received?.type).toBe('tap');
    expect(received?.target).toBeDefined();
    expect(received?.currentTarget).toBeDefined();
    // main-thread scripts get direct element access, as with worklet events
    expect((received?.target as any).elementRefptr).toBe(node);
    expect((received?.currentTarget as any).elementRefptr).toBe(node);
    expect((received?.target as any).uid).toBe(
      mts.__GetElementUniqueID(node),
    );
  });

  test('queued callbacks keep their own current target', async () => {
    const parent = mts.__CreateView(0);
    const child = mts.__CreateView(0);
    mts.__AppendElement(parent, child);
    rootDom.appendChild(parent);
    const currentTargets: unknown[] = [];
    const recordCurrentTarget = (event: MainThreadScriptEvent) => {
      currentTargets.push(event.currentTarget?.elementRefptr);
    };

    mts.__AddEventListener(child, 'tap', recordCurrentTarget, {});
    mts.__AddEventListener(parent, 'tap', recordCurrentTarget, {});
    await clickOn(child);

    expect(currentTargets).toStrictEqual([child, parent]);
  });

  test('__RemoveEventListener stops the callback', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();
    const options = {};

    mts.__AddEventListener(node, 'tap', handler, options);
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    mts.__RemoveEventListener(node, 'tap', handler, options);
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('removing an unrelated callback leaves the registered one intact', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    mts.__RemoveEventListener(node, 'tap', rstest.fn(), {});
    await clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('removing a never-registered callback is a no-op', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    expect(() => mts.__RemoveEventListener(node, 'tap', rstest.fn(), {}))
      .not.toThrow();
  });

  test('multiple callbacks on one element and event all fire', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const a = rstest.fn();
    const b = rstest.fn();

    mts.__AddEventListener(node, 'tap', a, {});
    mts.__AddEventListener(node, 'tap', b, {});
    await clickOn(node);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    // each is removable independently
    mts.__RemoveEventListener(node, 'tap', a, {});
    await clickOn(node);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  test('re-adding the same callback does not double-invoke it', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    mts.__AddEventListener(node, 'tap', handler, {});
    await clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
    // and a single remove clears it
    mts.__RemoveEventListener(node, 'tap', handler, {});
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('listeners are scoped to their own element', async () => {
    const a = mts.__CreateView(0);
    const b = mts.__CreateView(0);
    rootDom.appendChild(a);
    rootDom.appendChild(b);
    const handlerA = rstest.fn();

    mts.__AddEventListener(a, 'tap', handlerA, {});
    await clickOn(b);
    expect(handlerA).not.toHaveBeenCalled();
    await clickOn(a);
    expect(handlerA).toHaveBeenCalledTimes(1);
  });

  test('the event name is case-insensitive', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'TAP', handler, {});
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    // and matches on removal regardless of the casing used
    mts.__RemoveEventListener(node, 'tap', handler, {});
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('omitting options is allowed', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler);
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    mts.__RemoveEventListener(node, 'tap', handler);
    await clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a non-function callback with the default closure type is ignored', async () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    // closure_type defaults to kNone, which requires a callable
    expect(() => mts.__AddEventListener(node, 'tap', 'handlerName', {}))
      .not.toThrow();
    await clickOn(node);
  });

  describe('options', () => {
    test('once fires the callback a single time', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      await clickOn(node);
      await clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('re-adding the same once listener is a no-op', async () => {
      // Registration identity is (element, name, callback, capture), so a second
      // add of the same triple must not file a second wrapper: the callback
      // would run twice, and the first wrapper would be orphaned where
      // `__RemoveEventListener` could no longer reach it.
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      mts.__AddEventListener(node, 'tap', handler, { once: true });
      await clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('adding once over a plain registration keeps one listener', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, {});
      mts.__AddEventListener(node, 'tap', handler, { once: true });
      await clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('adding plain over a once registration keeps one listener', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      mts.__AddEventListener(node, 'tap', handler, {});
      await clickOn(node);
      await clickOn(node);

      // The plain registration wins, so it keeps firing.
      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('once listeners for different events do not collide', async () => {
      // The wrapper bookkeeping is keyed by (event name, event type, callback).
      // Keyed by callback alone, the second registration would be mistaken for a
      // duplicate of the first and dropped, so `tap` would be the only one left.
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      mts.__AddEventListener(node, 'longpress', handler, { once: true });

      // Each event fires its own registration exactly once.
      await clickOn(node);
      expect(handler).toHaveBeenCalledTimes(1);
      // `longpress` has no W3C alias, so it is dispatched under its own name.
      node.dispatchEvent(
        new (globalThis as any).Event('longpress', {
          bubbles: true,
          cancelable: true,
        }),
      );
      await queuedCallbacksDone();
      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('removing a once listener before it fires prevents it', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      mts.__RemoveEventListener(node, 'tap', handler, { once: true });
      await clickOn(node);

      expect(handler).not.toHaveBeenCalled();
    });

    test('capture listeners run before bubble listeners on an ancestor', async () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const order: string[] = [];

      mts.__AddEventListener(parent, 'tap', () => order.push('capture'), {
        capture: true,
      });
      mts.__AddEventListener(parent, 'tap', () => order.push('bubble'), {});
      await clickOn(child);

      expect(order).toStrictEqual(['capture', 'bubble']);
    });

    test('capture is part of listener identity on removal', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { capture: true });
      // a bubble-phase removal must not detach the capture registration
      mts.__RemoveEventListener(node, 'tap', handler, {});
      await clickOn(node);
      expect(handler).toHaveBeenCalledTimes(1);

      mts.__RemoveEventListener(node, 'tap', handler, { capture: true });
      await clickOn(node);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('the same callback can be registered in both phases', async () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const handler = rstest.fn();

      mts.__AddEventListener(parent, 'tap', handler, { capture: true });
      mts.__AddEventListener(parent, 'tap', handler, {});
      await clickOn(child);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('passive is accepted', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { passive: true });
      await clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('bind_type kBubbleCatch stops propagation to an ancestor', async () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const childHandler = rstest.fn();
      const parentHandler = rstest.fn();

      // BindType::kBubbleCatch === 4
      mts.__AddEventListener(child, 'tap', childHandler, {
        closure_type: 2,
        bind_type: 4,
      });
      mts.__AddEventListener(parent, 'tap', parentHandler, {});
      await clickOn(child);

      expect(childHandler).toHaveBeenCalledTimes(1);
      expect(parentHandler).not.toHaveBeenCalled();
    });

    test('closure_type kClient with a string handler delegates to __AddEvent', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const addCrossThreadEvent = rstest.fn();
      mtsBinding.wasmContext = Object.assign(mtsBinding.wasmContext!, {
        add_cross_thread_event: addCrossThreadEvent,
      }) as any;

      // ClosureType::kClient === 3
      mts.__AddEventListener(node, 'tap', 'onTapHandler', {
        closure_type: 3,
      });

      expect(addCrossThreadEvent).toHaveBeenCalledTimes(1);
      const [, eventType, eventName, handlerName] = addCrossThreadEvent.mock
        .calls[0]!;
      // The dispatcher looks handlers up under the lowercase event type.
      expect(eventType).toBe('bindevent');
      expect(eventName).toBe('tap');
      expect(handlerName).toBe('onTapHandler');
    });

    test('removing a kClient handler leaves the worklet handler alone', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const addCrossThreadEvent = rstest.fn();
      const addRunWorkletEvent = rstest.fn();
      mtsBinding.wasmContext = Object.assign(mtsBinding.wasmContext!, {
        add_cross_thread_event: addCrossThreadEvent,
        add_run_worklet_event: addRunWorkletEvent,
      }) as any;

      mts.__RemoveEventListener(node, 'tap', 'onTapHandler', {
        closure_type: 3,
      });

      // Only the cross-thread slot may be cleared: a `main-thread:bind` handler
      // on the same (element, type, name) triple is a separate registration.
      expect(addCrossThreadEvent).toHaveBeenCalledTimes(1);
      expect(addCrossThreadEvent.mock.calls[0]![3]).toBeUndefined();
      expect(addRunWorkletEvent).not.toHaveBeenCalled();
    });
  });

  describe('disposal', () => {
    test('disposeEventListeners detaches callbacks added via the PAPI', async () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, {});
      mtsBinding.disposeEventListeners();
      await clickOn(node);

      expect(handler).not.toHaveBeenCalled();
    });

    test('disposeEventListeners is idempotent', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      mts.__AddEventListener(node, 'tap', rstest.fn(), {});

      expect(() => {
        mtsBinding.disposeEventListeners();
        mtsBinding.disposeEventListeners();
      }).not.toThrow();
    });
  });

  describe('interop with __AddEvent', () => {
    test('a catch bound via __AddEvent stops a callback on an ancestor', async () => {
      // Both binding forms are filed in the same handler table, so the
      // dispatcher can stop one with the other. Binding callbacks directly with
      // `element.addEventListener` would put them in a parallel dispatch that
      // neither could reach.
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const onParent = rstest.fn();

      mts.__AddEventListener(parent, 'tap', onParent, {});
      mts.__AddEvent(child, 'catchEvent', 'tap', 'childCatch');
      await clickOn(child);

      expect(onParent).not.toHaveBeenCalled();
    });

    test('a callback bound with catch stops an __AddEvent handler above it', async () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const publishEvent = rstest.spyOn(mtsBinding, 'publishEvent')
        .mockImplementation(() => {});

      mts.__AddEvent(parent, 'bindEvent', 'tap', 'parentHandler');
      // BindType::kBubbleCatch === 4
      mts.__AddEventListener(child, 'tap', rstest.fn(), { bind_type: 4 });
      await clickOn(child);

      expect(publishEvent).not.toHaveBeenCalled();
      publishEvent.mockRestore();
    });
  });

  describe('elements without a Lynx unique id', () => {
    test('are ignored instead of sharing a registry key', async () => {
      // Elements not built through the Element PAPIs carry no unique id. Keying
      // them anyway would put every such element under the same key, so a
      // listener added on one would be reachable - and removable - through
      // another.
      const foreign = document.createElement('div');
      const otherForeign = document.createElement('div');
      rootDom.appendChild(foreign);
      rootDom.appendChild(otherForeign);
      const handler = rstest.fn();

      expect(() => {
        mts.__AddEventListener(foreign, 'tap', handler, {});
      }).not.toThrow();
      await clickOn(foreign);
      expect(handler).not.toHaveBeenCalled();

      // Removing through a different id-less element must not throw either.
      expect(() => {
        mts.__RemoveEventListener(otherForeign, 'tap', handler, {});
      }).not.toThrow();
    });
  });
});
