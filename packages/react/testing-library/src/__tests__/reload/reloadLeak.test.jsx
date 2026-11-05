// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { useInitData, useState } from '@lynx-js/react';

import { render } from '../..';
import { reloadTemplate } from './reloadTemplate.js';
import { __root } from '../../../../runtime/lib/root.js';
import { resetFirstScreenSyncState } from '../../../../runtime/lib/snapshot/lifecycle/event/firstScreenSync.js';
import { snapshotInstanceManager, traverseSnapshotInstance } from '../../../../runtime/lib/snapshot/index.js';

let setLabel;

function App() {
  const { text = 'Hello' } = useInitData() ?? {};
  const [label, _setLabel] = useState('World');
  setLabel = _setLabel;
  return (
    <view>
      <text>{text}</text>
      <text>{label}</text>
    </view>
  );
}

function Row({ text }) {
  return <text>{text}</text>;
}

function ListApp() {
  const { keys = [0, 1, 2] } = useInitData() ?? {};
  return (
    <list>
      {keys.map((key) => (
        <list-item key={key} item-key={key}>
          <Row text={`item ${key}`} />
        </list-item>
      ))}
    </list>
  );
}

function collect(root) {
  const nodes = [];
  traverseSnapshotInstance(root, node => {
    nodes.push(node);
  });
  return nodes;
}

function types(nodes) {
  return nodes.map(node => node.type);
}

function holdingElements(nodes) {
  return types(nodes.filter(node => node.__element_root !== undefined || node.__elements !== undefined));
}

function linked(nodes, root) {
  return types(nodes.filter(node => node !== root && node.parentNode !== null));
}

function registered(nodes) {
  return types(nodes.filter(node => snapshotInstanceManager.values.get(node.__id) === node));
}

describe('reload does not retain the old tree', () => {
  it('unlinks the old tree and drops its element references', async () => {
    const ui = <App />;
    const { container } = render(ui, { enableMainThread: true });

    lynxTestingEnv.switchToMainThread();
    const oldRoot = __root;
    const oldNodes = collect(oldRoot);
    expect(oldNodes.length).toBeGreaterThan(1);

    reloadTemplate(ui, { text: 'Enjoy' });

    lynxTestingEnv.switchToMainThread();
    expect(__root).not.toBe(oldRoot);
    expect(holdingElements(oldNodes)).toEqual([]);
    expect(linked(oldNodes, oldRoot)).toEqual([]);
    expect(registered(oldNodes)).toEqual([]);

    expect(container.innerHTML).toBe('<view><text>Enjoy</text><text>World</text></view>');
    lynxTestingEnv.switchToBackgroundThread();
    await act(() => {
      setLabel('Again');
    });
    expect(container.innerHTML).toBe('<view><text>Enjoy</text><text>Again</text></view>');
  });

  it('releases the tree an update before first-screen sync replaces', () => {
    lynxTestingEnv.mainThread.globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    resetFirstScreenSyncState();
    try {
      const { container } = render(<App />, { enableMainThread: true, enableBackgroundThread: false });

      lynxTestingEnv.switchToMainThread();
      const oldRoot = __root;
      const oldNodes = collect(oldRoot);

      globalThis.updatePage({ text: 'Enjoy' });
      expect(__root).not.toBe(oldRoot);
      expect(holdingElements(oldNodes)).toEqual([]);
      expect(linked(oldNodes, oldRoot)).toEqual([]);
      expect(registered(oldNodes)).toEqual([]);
      expect(container.innerHTML).toBe('<view><text>Enjoy</text><text>World</text></view>');
    } finally {
      lynxTestingEnv.mainThread.globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
    }
  });

  it('keeps working across two reloads', async () => {
    const ui = <App />;
    const { container } = render(ui, { enableMainThread: true });
    const page = container;

    reloadTemplate(ui, { text: 'Enjoy' });
    reloadTemplate(ui, { text: 'Again' });

    expect(lynxTestingEnv.mainThread.elementTree.root).toBe(page);
    expect(container.innerHTML).toBe('<view><text>Again</text><text>World</text></view>');
    lynxTestingEnv.switchToBackgroundThread();
    await act(() => {
      setLabel('Lynx');
    });
    expect(container.innerHTML).toBe('<view><text>Again</text><text>Lynx</text></view>');
  });

  it('releases the background tree it destroys', () => {
    const ui = <App />;
    render(ui, { enableMainThread: true });

    lynxTestingEnv.switchToBackgroundThread();
    const oldNodes = collect(__root).filter(node => node !== __root);
    expect(oldNodes.length).toBeGreaterThan(0);

    vi.useFakeTimers();
    try {
      reloadTemplate(ui, {});
      vi.advanceTimersByTime(20000);
    } finally {
      vi.useRealTimers();
    }

    expect(linked(oldNodes, null)).toEqual([]);
  });
});
