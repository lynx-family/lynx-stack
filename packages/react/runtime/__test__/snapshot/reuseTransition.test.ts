// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './utils/envManager';
import { elementTree, parentMap } from './utils/nativeMethod';
import {
  clearReuseTransitions,
  prepareReuseTransition,
  restoreReuseTransition,
} from '../../src/snapshot/list/reuseTransition';
import { SnapshotInstance } from '../../src/snapshot/snapshot/snapshot';
import { hydrate } from '../../src/snapshot/renderToOpcodes/hydrate';
import { Element, setShouldFlush } from '../../src/worklet-runtime/api/element';

const raw = new Map<FiberElement, string>();
const properties = new Map<FiberElement, Map<string | number, unknown>>();

function row(): SnapshotInstance {
  const snapshot = new SnapshotInstance('view');
  snapshot.__values = [{ style: 'width:100px;transition:all 300ms;' }];
  snapshot.ensureElements();
  return snapshot;
}

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  raw.clear();
  properties.clear();
  setShouldFlush(false);
  vi.stubGlobal('__GetInlineStyles', (element: FiberElement) => raw.get(element) ?? '');
  vi.stubGlobal('__GetInlineStyle', (element: FiberElement, key: number) => properties.get(element)?.get(key));
  vi.stubGlobal('__SetInlineStyles', vi.fn((element: FiberElement, value: string) => raw.set(element, value)));
  vi.stubGlobal(
    '__AddInlineStyle',
    vi.fn((element: FiberElement, key: string | number, value: unknown) => {
      let styles = properties.get(element);
      if (!styles) properties.set(element, styles = new Map());
      if (value == null) styles.delete(key);
      else styles.set(key, value);
    }),
  );
  vi.stubGlobal('__ElementAnimate', vi.fn());
  vi.stubGlobal('__NextElement', (element: Parameters<typeof parentMap.get>[0]) => {
    const parent = parentMap.get(element);
    return parent?.children[parent.children.indexOf(element) + 1];
  });
});

afterEach(() => {
  clearReuseTransitions();
  setShouldFlush(true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('reused row transition boundaries', () => {
  it.each(['__GetInlineStyle', '__GetInlineStyles'])('does not suppress styles without %s', capability => {
    const snapshot = row();
    vi.stubGlobal(capability, undefined);
    expect(prepareReuseTransition(snapshot)).toBeUndefined();
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
  });

  it('keeps an unparsed inline shorthand and important declaration intact after rebinding', () => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    const original = 'width:100px;transition:all 300ms !important;';
    raw.set(element, original);

    const binding = prepareReuseTransition(snapshot)!;
    expect(raw.get(element)).toBe(original + ';transition-property:none !important;');
    binding.finish();
    binding.restore();
    expect(raw.get(element)).toBe(original);
    binding.restore();
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
  });

  it('removes a temporary ordinary declaration so class styles can resolve again', () => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    raw.set(element, '');
    const binding = prepareReuseTransition(snapshot)!;
    expect(properties.get(element)?.get(110)).toBe('none');
    binding.finish();
    binding.restore();
    expect(properties.get(element)?.has(110)).toBe(false);
  });

  it.each(['setStyleProperty', 'setStyleProperties'])('does not overwrite a later public MTS %s call', method => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    const binding = prepareReuseTransition(snapshot)!;
    binding.finish();
    const api = new Element(element);
    if (method === 'setStyleProperty') api.setStyleProperty('width', '220px');
    else api.setStyleProperties({ width: '220px', color: 'red' });
    const writes = vi.mocked(__SetInlineStyles).mock.calls.length;

    binding.restore();
    expect(properties.get(element)?.get('width')).toBe('220px');
    expect(__SetInlineStyles).toHaveBeenCalledTimes(writes);
    expect(raw.get(element)).not.toContain('transition-property:none');
  });

  it('restores before an ordinary snapshot style update, not after it', () => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    const binding = prepareReuseTransition(snapshot)!;
    binding.finish();

    snapshot.setAttribute(0, { style: 'width:240px;transition:all 500ms;' });
    binding.restore();
    expect(raw.get(element)).toBe('width:240px;transition:all 500ms;');
  });

  it('ends ancestor suppression on a subsequent descendant update', () => {
    const snapshot = row();
    const child = new SnapshotInstance('view');
    snapshot.insertBefore(child);
    const binding = prepareReuseTransition(snapshot)!;
    binding.finish();
    restoreReuseTransition(child);
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
    expect(raw.get(snapshot.__element_root!)).not.toContain('transition-property:none');
  });

  it('does not end the active bind when native callbacks synchronously update descendants', () => {
    const snapshot = row();
    const child = new SnapshotInstance('view');
    snapshot.insertBefore(child);
    const binding = prepareReuseTransition(snapshot)!;
    restoreReuseTransition(child);
    expect(raw.get(snapshot.__element_root!)).toContain('transition-property:none');
    binding.finish();
    binding.restore();
  });

  it.each([false, true])('keeps stable snapshot IDs distinct from logical item-key changes (%s)', changeKey => {
    const before = row();
    before.__listItemPlatformInfo = { 'item-key': 'original' };
    const element = before.__element_root!;
    const original = raw.get(element);
    const binding = prepareReuseTransition(before)!;
    // Snapshot IDs also arrive explicitly through SSR adoption; the item key remains the cell identity.
    const after = new SnapshotInstance('view', before.__id);
    after.__values = before.__values;
    after.__listItemPlatformInfo = { 'item-key': changeKey ? 'replacement' : 'original' };

    hydrate(before, after);
    expect(after.__element_root).toBe(element);
    if (changeKey) expect(raw.get(element)).toBe(original);
    else expect(raw.get(element)).toContain('transition-property:none');
    binding.finish();
    binding.restore();
    expect(raw.get(element)).toBe(original);
  });

  it('does not modify native children owned by a nested list binding', () => {
    const snapshot = row();
    const nested = __CreateElement('list', 0);
    const cell = __CreateView(0);
    __AppendElement(snapshot.__element_root!, nested);
    __AppendElement(nested, cell);
    raw.set(cell, 'transition:width 200ms;');

    const binding = prepareReuseTransition(snapshot)!;
    expect(raw.get(cell)).toBe('transition:width 200ms;');
    binding.finish();
    binding.restore();
  });

  it('does not let an old restore overwrite a later binding on the same native element', () => {
    const snapshot = row();
    const old = prepareReuseTransition(snapshot)!;
    old.finish();
    old.restore();
    raw.set(snapshot.__element_root!, 'width:200px;');
    const current = prepareReuseTransition(snapshot)!;
    old.restore();
    expect(raw.get(snapshot.__element_root!)).toContain('transition-property:none');
    current.finish();
    current.restore();
    expect(raw.get(snapshot.__element_root!)).toBe('width:200px;');
  });

  it('keeps ordinary same-item animation on its separate Native animation path', () => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    const before = raw.get(element);
    const animation = new Element(element).animate([{ width: '100px' }, { width: '200px' }], 300);
    expect(__ElementAnimate).toHaveBeenCalledWith(element, [0, animation.id, [
      { width: '100px' },
      { width: '200px' },
    ], { duration: 300 }]);
    expect(raw.get(element)).toBe(before);
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
  });

  it('ends suppression before an MTS style write from a separately bundled worklet runtime', async () => {
    const snapshot = row();
    const element = snapshot.__element_root!;
    raw.set(element, 'width:100px;');
    vi.resetModules();
    const bundled = await import('../../src/worklet-runtime/api/element');
    bundled.setShouldFlush(false);
    const binding = prepareReuseTransition(snapshot)!;
    binding.finish();

    new bundled.Element(element).setStyleProperty('opacity', '0.5');
    expect(raw.get(element)).toBe('width:100px;');
    binding.restore();
    expect(raw.get(element)).toBe('width:100px;');
    expect(properties.get(element)?.get('opacity')).toBe('0.5');
  });

  it('page teardown cancels pending restoration without rewriting discarded styles', () => {
    const snapshot = row();
    const binding = prepareReuseTransition(snapshot)!;
    const writes = vi.mocked(__SetInlineStyles).mock.calls.length;
    clearReuseTransitions();
    binding.restore();
    expect(__SetInlineStyles).toHaveBeenCalledTimes(writes);
    expect(snapshot.__restoreReuseTransition).toBeUndefined();
  });
});
