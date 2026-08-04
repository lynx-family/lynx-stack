// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Background, MainThread, useState } from '../../src/index';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
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
  globalThis.__OnLifecycleEvent.mockClear();
});

afterEach(() => {
  elementTree.clear();
});

/**
 * The island: the subtree a root `<MainThread>` wraps. Its module is compiled
 * for the main thread, so this body runs on both threads. `<Background>`
 * inside it is the per-subtree opt-out — the main thread renders the
 * skeleton, the background renders the real feed.
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

/** What the entry does on the main thread: render this tree, then paint. */
function renderTree(tree) {
  __root.__jsx = tree;
  renderPage();
}

/**
 * What the entry does on the main thread once the build has compiled it:
 * `root.render(<MainThread><Island/></MainThread>)`, then `renderPage`.
 */
function renderIsland(Island) {
  renderTree(
    <MainThread>
      <Island />
    </MainThread>,
  );
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
    renderIsland(Shell);

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
    renderIsland(Shell);

    // The elements the main thread built, by identity.
    const islandView = __root.__element_root.children[0];
    const islandText = islandView.children[0];

    const patch = await handOver(
      <MainThread>
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

    renderIsland(Interactive);

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

  it('paints nothing when the entry brought no island', () => {
    // What a build whose entry declares no root boundary degrades to: the
    // main thread has nothing to render, and the background's first-screen
    // hydration inserts the whole tree.
    renderPage();

    expect(__root.__element_root.children).toHaveLength(0);
  });

  it('keeps an island named on a <Background>, and replaces only the fallback', async () => {
    // The other way to reach the main thread from inside a deferred region:
    // instead of a `<MainThread>` down in `children` — a position the main
    // thread never walks to — the boundary itself names the island, so it is
    // at a fixed index in both threads' trees.
    function Nav() {
      return <view class='nav' />;
    }

    function Page() {
      return (
        <view class='page'>
          <Background island={<Nav />} fallback={<view class='feed-skeleton' />}>
            <Feed />
          </Background>
        </view>
      );
    }

    renderTree(<Page />);

    // The main thread built both arms: the island, then the fallback.
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="page"
        >
          <view
            class="nav"
          />
          <view
            class="feed-skeleton"
          />
        </view>
      </page>
    `);

    const nav = __root.__element_root.children[0].children[0];

    const patch = await handOver(<Page />);

    // Only the deferred arm moves: the fallback out, the feed in. The island
    // is adopted where it stands.
    expect(operations(patch)).toEqual([
      SnapshotOperation.RemoveChild,
      SnapshotOperation.CreateElement,
      SnapshotOperation.InsertBefore,
    ]);
    expect(elementTree.root.children[0].children[0]).toBe(nav);
    expect(elementTree.root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view
          class="page"
        >
          <view
            class="nav"
          />
          <view
            class="feed"
          >
            <text>
              <raw-text
                text="feed"
              />
            </text>
          </view>
        </view>
      </page>
    `);
  });

  it('keeps rendering the island when `updatePage` runs before the first screen', () => {
    renderIsland(Shell);

    const before = JSON.stringify(__root.__element_root);
    // Native may push data before the background is ready; the pre-hydration
    // re-render must not leave the first frame empty.
    updatePage({});

    expect(JSON.stringify(elementTree.root)).toContain('island');
    expect(JSON.stringify(elementTree.root)).toBe(before);
  });
});
