/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { createElementAPI } from '../ts/server/index.js';
import { MainThreadServerContext } from '../ts/server/wasm.js';

describe('Server Compat Tests', () => {
  it('basic-performance-div-10', () => {
    const binding: any = {};
    const api = createElementAPI(binding);
    const wasmCtx = binding.wasmContext as MainThreadServerContext;

    const page = api.__CreatePage(0, 0);

    for (let i = 0; i < 10; i++) {
      const div = api.__CreateElement('div', 0);
      api.__SetAttribute(div, 'id', `target-${i}`);
      api.__SetInlineStyles(div, 'height:100px;width:100px;background:pink;');
      api.__AppendElement(page, div);
    }

    api.__FlushElementTree(page, {});
    const html = binding.ssrResult;
    expect(html).toMatchSnapshot();
  });

  it('basic-performance-nest-level-100', () => {
    const binding: any = {};
    const api = createElementAPI(binding);
    const wasmCtx = binding.wasmContext as MainThreadServerContext;

    const page = api.__CreatePage(0, 0);

    let parent = page;
    // index.jsx: App count={100}.
    // <div id="target-100"> <App count={99} /> </div>
    // So nesting goes: page -> target-100 -> target-99 ... -> target-1
    // Loop from 100 down to 1.
    for (let i = 100; i >= 1; i--) {
      const div = api.__CreateElement('div', 0);
      api.__SetAttribute(div, 'id', `target-${i}`);
      api.__AppendElement(parent, div);
      parent = div;
    }

    api.__FlushElementTree(page, {});
    const html = binding.ssrResult;
    expect(html).toMatchSnapshot();
  });

  it('basic-performance-event-div-100', () => {
    const binding: any = {};
    const api = createElementAPI(binding);
    const wasmCtx = binding.wasmContext as MainThreadServerContext;

    const page = api.__CreatePage(0, 0);

    for (let i = 0; i < 100; i++) {
      const div = api.__CreateElement('div', 0);
      api.__SetAttribute(div, 'id', `target-${i}`);
      api.__SetInlineStyles(div, 'height:100px;width:100px;background:pink;');
      // bindtap={handleTap}
      // In web-core snapshot: events: [[2, "bindEvent", "tap", "-2:1:"]]
      // We simulate adding event listener
      // function name for bindtap is usually inferred or provided.
      // createElementAPI.__AddEventListener(element, eventName, eventType, listenerId)
      // eventType: 'bind' | 'catch' | 'capture-bind' | 'capture-catch' ?
      // Actually ElementData has keys like 'bind', 'catch'.
      // Snapshot says "bindEvent" as a separate string? "events":[[id, type, name, funcName]]
      // type="bindEvent".
      // In `element_data.rs`: `framework_cross_thread_identifier` keys are "bind", "capture-bind" etc.
      // Wait, `createElementAPI` maps `__AddEventListener` to `wasmCtx.add_event_listener`.
      // Let's check `createElementAPI.ts` implementation details.
      // __AddEvent(element, eventType, eventName, listenerId)
      api.__AddEvent(div, 'bind', 'tap', `handleTap-${i}`);
      api.__AppendElement(page, div);
    }

    api.__FlushElementTree(page, {});
    const html = binding.ssrResult;
    expect(html).toMatchSnapshot();
  });
});
