// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Background, MainThread, useState } from '../../src/index';
import { MAIN_THREAD_ROOT_ISLAND, installMainThreadIslandFirstFrame } from '../../src/main-thread-island';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { setMainThreadFirstFrame } from '../../src/snapshot/lifecycle/render';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { SnapshotOperation } from '../../src/snapshot/lifecycle/patch/snapshotPatch';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalThis.__ENABLE_MTS_RENDERING__ = false;
  globalThis.__OnLifecycleEvent.mockClear();
});

afterEach(() => {
  globalThis.__ENABLE_MTS_RENDERING__ = true;
  delete globalThis[MAIN_THREAD_ROOT_ISLAND];
  setMainThreadFirstFrame(undefined);
  elementTree.clear();
});

/**
 * The island: what the `'main thread component'` directive designates. Its
 * module is compiled into the main-thread layer, so this body runs on both
 * threads. `<Background>` inside it is the per-subtree opt-out — the main
 * thread renders the skeleton, the background renders the real feed.
 */
function Shell() {
  const [title] = useState('island');
  return (
    <view class='page'>
      <text>{title}</text>
      <Background fallback={<view class='feed-skeleton' />}>
        <Feed />
      </Background>
    </view>
  );
}

function Feed() {
  return (
    <view class='feed'>
      <text>feed</text>
    </view>
  );
}

/** What `runtime/mts-rendering-disabled/islands.js` does at chunk bootstrap. */
function installIsland(Island, renderStaticFallback = () => {}) {
  globalThis[MAIN_THREAD_ROOT_ISLAND] = Island;
  installMainThreadIslandFirstFrame(renderStaticFallback);
}

/** Hand the main thread's first screen over and apply the resulting patch. */
async function handOver(backgroundTree) {
  globalEnvManager.switchToBackground();
  render(backgroundTree, __root);
  lynx.getNativeApp().callLepusMethod.mockClear();

  lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
  globalThis.__OnLifecycleEvent.mockClear();

  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
  const patch = JSON.parse(rLynxChange[1].data).patchList[0].snapshotPatch;

  globalEnvManager.switchToMainThread();
  globalThis[rLynxChange[0]](rLynxChange[1]);
  rLynxChange[2]();
  await waitSchedule();

  return patch;
}

function operations(patch) {
  const seen = [];
  for (let i = 0; i < patch.length; i++) {
    const op = patch[i];
    seen.push(op);
    switch (op) {
      case SnapshotOperation.CreateElement:
        i += 2;
        break;
      case SnapshotOperation.InsertBefore:
        i += 4;
        break;
      case SnapshotOperation.RemoveChild:
        i += 2;
        break;
      case SnapshotOperation.SetAttribute:
        i += 3;
        break;
      case SnapshotOperation.SetAttributes:
        i += 2;
        break;
      default:
        throw new Error(`unexpected operation ${op} in ${JSON.stringify(patch)}`);
    }
  }
  return seen;
}

describe('main-thread island', () => {
  it('renders the island as the first frame', () => {
    installIsland(Shell);
    renderPage();

    // Not the empty page of the plain assembled bundle: the island ran on the
    // main thread, and `<Background>` inside it rendered its fallback.
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="page"
        >
          <text>
            <raw-text
              text="island"
            />
          </text>
          <wrapper>
            <view
              class="feed-skeleton"
            />
          </wrapper>
        </view>
      </page>
    `);
  });

  it('adopts the island instead of recreating it', async () => {
    installIsland(Shell);
    renderPage();

    // The elements the main thread built, by identity.
    const islandView = __root.__element_root.children[0];
    const islandText = islandView.children[0];

    const patch = await handOver(
      <MainThread fallback={<view class='fallback' />}>
        <Shell />
      </MainThread>,
    );

    // The whole point of D3: the background's render of the same subtree is
    // matched against what the main thread already built, so the handover
    // touches only the `<Background>` boundary — the one place the two
    // renders legitimately disagree.
    //
    // Read the patch: remove the skeleton, create `Feed`, insert it. The
    // island's own instances are neither created nor re-set — the background
    // took over the ids the main thread allocated for them (negative ids,
    // which is what tells them apart from the background's own).
    expect(operations(patch)).toEqual([
      SnapshotOperation.RemoveChild,
      SnapshotOperation.CreateElement,
      SnapshotOperation.InsertBefore,
    ]);
    expect(patch[1]).toBeLessThan(0);
    expect(patch[2]).toBeLessThan(0);

    // Element identity survives the handover.
    expect(elementTree.root.children[0]).toBe(islandView);
    expect(elementTree.root.children[0].children[0]).toBe(islandText);

    // …and the deferred subtree arrived.
    expect(elementTree.root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="page"
        >
          <text>
            <raw-text
              text="island"
            />
          </text>
          <wrapper>
            <view
              class="feed"
            >
              <text>
                <raw-text
                  text="feed"
                />
              </text>
            </view>
          </wrapper>
        </view>
      </page>
    `);
  });

  it('keeps the island\'s worklet binding across the handover', async () => {
    // A main-thread event handler is the reason an island exists: it works on
    // the first frame, before the background is up. The handover must leave
    // the element that carries the binding in place — re-creating it would
    // drop the binding, and with it the worklet ctx and gesture state hung
    // off the element.
    const onTap = { _wkltId: 'island-tap' };

    function Interactive() {
      return (
        <view class='page'>
          <text main-thread:bindtap={onTap}>island</text>
        </view>
      );
    }

    installIsland(Interactive);
    renderPage();

    const islandText = __root.__element_root.children[0].children[0];
    expect(islandText.props.event['bindEvent:tap']).toBeDefined();

    const patch = await handOver(
      <MainThread>
        <Interactive />
      </MainThread>,
    );

    // The background adopted the whole island: it never created or removed an
    // instance, it only re-sent the worklet value onto the instance the main
    // thread already owns.
    expect(operations(patch)).not.toContain(SnapshotOperation.CreateElement);
    expect(operations(patch)).not.toContain(SnapshotOperation.RemoveChild);
    expect(elementTree.root.children[0].children[0]).toBe(islandText);
    expect(islandText.props.event['bindEvent:tap']).toBeDefined();
  });

  it('falls back to the static first frame when no island was registered', () => {
    // What a build that could not compile the island into the main-thread
    // bundle degrades to.
    const renderStaticFallback = vi.fn();
    installMainThreadIslandFirstFrame(renderStaticFallback);
    renderPage();

    expect(renderStaticFallback).toHaveBeenCalledOnce();
    expect(__root.__element_root.children).toHaveLength(0);
  });

  it('keeps rendering the island when `updatePage` runs before the first screen', () => {
    installIsland(Shell);
    renderPage();

    const before = JSON.stringify(__root.__element_root);
    // Native may push data before the background is ready; the pre-hydration
    // re-render must not leave the first frame empty.
    updatePage({});

    expect(JSON.stringify(elementTree.root)).toContain('island');
    expect(JSON.stringify(elementTree.root)).toBe(before);
  });
});
