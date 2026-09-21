/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicBG } from './reloadBG';
import { BasicMT } from './reloadMT';
import { destroyBackground } from '../../../src/snapshot/lifecycle/destroy';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { __root } from '../../../src/root';
import { setupPage, traverseSnapshotInstance } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));

  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();

  globalEnvManager.resetEnv();
  elementTree.clear();
});

function collect(root) {
  const nodes = [];
  traverseSnapshotInstance(root, node => {
    nodes.push(node);
  });
  return nodes;
}

describe('reload does not retain the old tree', () => {
  it('unlinks the old tree and drops its element references', function() {
    globalEnvManager.switchToMainThread();
    __root.__jsx = BasicMT;
    renderPage({ text: 'Hello' });

    const oldRoot = __root;
    const oldNodes = collect(oldRoot);
    expect(oldNodes.length).toBeGreaterThan(1);
    expect(oldRoot.__element_root).toBeDefined();

    updatePage({ text: 'Enjoy' }, { reloadTemplate: true });

    // The reload renders a fresh tree, so `__root` is a different instance.
    expect(__root).not.toBe(oldRoot);

    // `hydrate` copies the element handles onto the new tree without clearing
    // them here, so without a teardown every old node keeps a live element.
    const stillHoldingElements = oldNodes.filter(
      node => node.__element_root !== undefined || node.__elements !== undefined,
    );
    expect(stillHoldingElements).toHaveLength(0);

    // Parent and child point at each other, so an old tree left linked is a
    // reference cycle: reachable from nothing, freed by a tracing GC only.
    const stillLinked = oldNodes.filter(node => node !== oldRoot && node.parentNode !== null);
    expect(stillLinked).toHaveLength(0);
  });

  it('keeps rendering through reloads after the old tree is torn down', function() {
    globalEnvManager.switchToMainThread();
    __root.__jsx = BasicMT;
    renderPage({ text: 'Hello' });

    const elementRoot = __root.__element_root;

    updatePage({ text: 'Enjoy' }, { reloadTemplate: true });
    // `hydrate` hands the new tree the same element handles, and the teardown
    // only drops the old tree's own reference to them.
    expect(__root.__element_root).toBe(elementRoot);

    // The second reload hydrates against a tree whose predecessor was already
    // torn down, which is where a teardown that took too much would show up.
    updatePage({ text: 'Again' }, { reloadTemplate: true });
    expect(__root.__element_root).toBe(elementRoot);

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Again"
            />
          </text>
          <text>
            <raw-text
              text="World"
            />
          </text>
          <view
            attr={
              {
                "dataX": "WorldX",
              }
            }
          />
          <wrapper>
            <view
              attr={
                {
                  "attr": {
                    "dataX": "WorldX",
                  },
                }
              }
            />
          </wrapper>
        </view>
      </page>
    `);
  });

  it('releases the background tree it destroys', async function() {
    globalEnvManager.switchToBackground();
    render(BasicBG, __root);
    await waitSchedule();

    const oldNodes = collect(__root).filter(node => node !== __root);
    expect(oldNodes.length).toBeGreaterThan(0);

    vi.useFakeTimers();
    destroyBackground();
    // `removeChild` only unlinks the subtree root; the rest is torn down on the
    // delayed boundary the commit task schedules.
    vi.advanceTimersByTime(20000);

    const stillLinked = oldNodes.filter(node => node.parentNode !== null);
    vi.useRealTimers();
    expect(stillLinked).toHaveLength(0);
  });

  it('keeps the reloaded tree working', function() {
    globalEnvManager.switchToMainThread();
    __root.__jsx = BasicMT;
    renderPage({ text: 'Hello' });

    updatePage({ text: 'Enjoy' }, { reloadTemplate: true });

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Enjoy"
            />
          </text>
          <text>
            <raw-text
              text="World"
            />
          </text>
          <view
            attr={
              {
                "dataX": "WorldX",
              }
            }
          />
          <wrapper>
            <view
              attr={
                {
                  "attr": {
                    "dataX": "WorldX",
                  },
                }
              }
            />
          </wrapper>
        </view>
      </page>
    `);
  });
});
