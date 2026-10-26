// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree } from './utils/nativeMethod';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType';

const cardLifetimeKey = Symbol.for('__REACT_LYNX_CARD_LIFETIME__');
const LIST = 'nested-re-eval-list';
const ROW = 'nested-re-eval-row';

// Evaluates the runtime modules again on the same `lynx`, as a reload with
// `experimental_reEvalJSOnReload` does.
async function evaluateEntry() {
  vi.resetModules();
  const definition = await import('../../src/snapshot/snapshot/definition.js');
  definition.snapshotManager.values.set(LIST, {
    create: () => [__CreateElement('list', 0)],
    update: [],
    slot: [[DynamicPartType.ListChildren, 0]],
    isListHolder: true,
  });
  definition.snapshotManager.values.set(ROW, {
    create: () => [__CreateView(0)],
    update: [],
    slot: [[DynamicPartType.Children, 0]],
  });
  return {
    SnapshotInstance: (await import('../../src/snapshot/snapshot/snapshot.js')).SnapshotInstance,
    state: await import('../../src/snapshot/list/nativeState.js'),
    transition: await import('../../src/snapshot/list/reuseTransition.js'),
  };
}

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
  vi.stubGlobal('__AddEvent', vi.fn());
  vi.stubGlobal('__InvokeUIMethod', vi.fn());
});

afterEach(() => {
  delete (lynx as unknown as Record<symbol, unknown>)[cardLifetimeKey];
  delete globalThis.__ReactLynxNestedList;
  vi.unstubAllGlobals();
  vi.resetModules();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('nested list reuse state across a re-evaluated entry', () => {
  it('keeps tracking a nested list for the snapshot that the new entry hydrates', async () => {
    const previous = await evaluateEntry();
    const outer = new previous.SnapshotInstance(LIST);
    const row = new previous.SnapshotInstance(ROW);
    const before = new previous.SnapshotInstance(LIST);
    outer.insertBefore(row);
    row.insertBefore(before);
    const element = __CreateElement('list', 0);
    __SetAttribute(element, 'scroll-orientation', 'horizontal');
    before.__elements = [element];
    before.__element_root = element;
    previous.state.createNestedListState(before, element, before.childNodes);

    const next = await evaluateEntry();
    const after = new next.SnapshotInstance(LIST);
    // Hydration of the retained tree hands the native list to the new snapshot.
    next.state.transferNestedListState(after, element, true);
    globalThis.__ReactLynxNestedList!.dispatch!(
      { listID: __GetElementUniqueID(element), eventType: 'bindEvent', eventName: 'scroll', _wkltId: '' },
      [{ detail: { eventSource: 2, scrollLeft: 50 } }],
      undefined,
      () => undefined,
    );

    expect(after.__listScrollOffset).toEqual({ x: 50, y: 0 });
    expect(before.__listScrollOffset).toBeUndefined();
  });

  it('lets an update of the new entry end a transition suppression started by the previous one', async () => {
    const raw = new Map<FiberElement, string>();
    vi.stubGlobal('__GetInlineStyles', (element: FiberElement) => raw.get(element) ?? '');
    vi.stubGlobal('__GetInlineStyle', () => undefined);
    vi.stubGlobal('__SetInlineStyles', (element: FiberElement, value: string) => raw.set(element, value));
    vi.stubGlobal('__AddInlineStyle', vi.fn());
    const previous = await evaluateEntry();
    const snapshot = new previous.SnapshotInstance(ROW);
    snapshot.ensureElements();
    const root = snapshot.__element_root!;
    const style = 'height:120px;transition:height 300ms;';
    raw.set(root, style);
    const binding = previous.transition.prepareReuseTransition(snapshot)!;
    binding.finish();
    expect(raw.get(root)).toBe(`${style};transition-property:none !important;`);

    const next = await evaluateEntry();
    next.transition.restoreReuseTransition(snapshot);

    expect(raw.get(root)).toBe(style);
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
  });
});
