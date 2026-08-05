// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './jsdom.js';
import { beforeEach, describe, expect, rstest, test } from '@rstest/core';
import { createElementAPI } from '../ts/client/mainthread/elementAPIs/createElementAPI.js';
import { WASMJSBinding } from '../ts/client/mainthread/elementAPIs/WASMJSBinding.js';
import { createTestLynxViewInstance } from './createTestLynxViewInstance.js';
import type { MainThreadScriptEvent } from '../ts/types/index.js';

/**
 * Fire a real DOM `click` on `node`. `click` is the W3C event that
 * `W3cEventNameToLynx` maps to the Lynx `tap` event, so this is what a `tap`
 * listener must observe.
 */
function clickOn(node: HTMLElement): void {
  node.dispatchEvent(
    new (globalThis as any).MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
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

  test('a tap callback fires on a real DOM click', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('the callback receives a Lynx event object', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    let received: MainThreadScriptEvent | undefined;

    mts.__AddEventListener(node, 'tap', (e) => {
      received = e;
    }, {});
    clickOn(node);

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

  test('__RemoveEventListener stops the callback', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();
    const options = {};

    mts.__AddEventListener(node, 'tap', handler, options);
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    mts.__RemoveEventListener(node, 'tap', handler, options);
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('removing an unrelated callback leaves the registered one intact', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    mts.__RemoveEventListener(node, 'tap', rstest.fn(), {});
    clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('removing a never-registered callback is a no-op', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    expect(() => mts.__RemoveEventListener(node, 'tap', rstest.fn(), {}))
      .not.toThrow();
  });

  test('multiple callbacks on one element and event all fire', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const a = rstest.fn();
    const b = rstest.fn();

    mts.__AddEventListener(node, 'tap', a, {});
    mts.__AddEventListener(node, 'tap', b, {});
    clickOn(node);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    // each is removable independently
    mts.__RemoveEventListener(node, 'tap', a, {});
    clickOn(node);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  test('re-adding the same callback does not double-invoke it', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler, {});
    mts.__AddEventListener(node, 'tap', handler, {});
    clickOn(node);

    expect(handler).toHaveBeenCalledTimes(1);
    // and a single remove clears it
    mts.__RemoveEventListener(node, 'tap', handler, {});
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('listeners are scoped to their own element', () => {
    const a = mts.__CreateView(0);
    const b = mts.__CreateView(0);
    rootDom.appendChild(a);
    rootDom.appendChild(b);
    const handlerA = rstest.fn();

    mts.__AddEventListener(a, 'tap', handlerA, {});
    clickOn(b);
    expect(handlerA).not.toHaveBeenCalled();
    clickOn(a);
    expect(handlerA).toHaveBeenCalledTimes(1);
  });

  test('the event name is case-insensitive', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'TAP', handler, {});
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    // and matches on removal regardless of the casing used
    mts.__RemoveEventListener(node, 'tap', handler, {});
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('omitting options is allowed', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    const handler = rstest.fn();

    mts.__AddEventListener(node, 'tap', handler);
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);

    mts.__RemoveEventListener(node, 'tap', handler);
    clickOn(node);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a non-function callback with the default closure type is ignored', () => {
    const node = mts.__CreateView(0);
    rootDom.appendChild(node);
    // closure_type defaults to kNone, which requires a callable
    expect(() => mts.__AddEventListener(node, 'tap', 'handlerName', {}))
      .not.toThrow();
    expect(() => clickOn(node)).not.toThrow();
  });

  describe('options', () => {
    test('once fires the callback a single time', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      clickOn(node);
      clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('removing a once listener before it fires prevents it', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { once: true });
      mts.__RemoveEventListener(node, 'tap', handler, { once: true });
      clickOn(node);

      expect(handler).not.toHaveBeenCalled();
    });

    test('capture listeners run before bubble listeners on an ancestor', () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const order: string[] = [];

      mts.__AddEventListener(parent, 'tap', () => order.push('capture'), {
        capture: true,
      });
      mts.__AddEventListener(parent, 'tap', () => order.push('bubble'), {});
      clickOn(child);

      expect(order).toStrictEqual(['capture', 'bubble']);
    });

    test('capture is part of listener identity on removal', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { capture: true });
      // a bubble-phase removal must not detach the capture registration
      mts.__RemoveEventListener(node, 'tap', handler, {});
      clickOn(node);
      expect(handler).toHaveBeenCalledTimes(1);

      mts.__RemoveEventListener(node, 'tap', handler, { capture: true });
      clickOn(node);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('the same callback can be registered in both phases', () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const handler = rstest.fn();

      mts.__AddEventListener(parent, 'tap', handler, { capture: true });
      mts.__AddEventListener(parent, 'tap', handler, {});
      clickOn(child);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('passive is accepted', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, { passive: true });
      clickOn(node);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('bind_type kBubbleCatch stops propagation to an ancestor', () => {
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
      clickOn(child);

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
    test('disposeEventListeners detaches callbacks added via the PAPI', () => {
      const node = mts.__CreateView(0);
      rootDom.appendChild(node);
      const handler = rstest.fn();

      mts.__AddEventListener(node, 'tap', handler, {});
      mtsBinding.disposeEventListeners();
      clickOn(node);

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
    test('a catch bound via __AddEvent stops a callback on an ancestor', () => {
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
      clickOn(child);

      expect(onParent).not.toHaveBeenCalled();
    });

    test('a callback bound with catch stops an __AddEvent handler above it', () => {
      const parent = mts.__CreateView(0);
      const child = mts.__CreateView(0);
      mts.__AppendElement(parent, child);
      rootDom.appendChild(parent);
      const publishEvent = rstest.spyOn(mtsBinding, 'publishEvent')
        .mockImplementation(() => {});

      mts.__AddEvent(parent, 'bindEvent', 'tap', 'parentHandler');
      // BindType::kBubbleCatch === 4
      mts.__AddEventListener(child, 'tap', rstest.fn(), { bind_type: 4 });
      clickOn(child);

      expect(publishEvent).not.toHaveBeenCalled();
      publishEvent.mockRestore();
    });
  });

  describe('elements without a Lynx unique id', () => {
    test('are ignored instead of sharing a registry key', () => {
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
      clickOn(foreign);
      expect(handler).not.toHaveBeenCalled();

      // Removing through a different id-less element must not throw either.
      expect(() => {
        mts.__RemoveEventListener(otherForeign, 'tap', handler, {});
      }).not.toThrow();
    });
  });
});
