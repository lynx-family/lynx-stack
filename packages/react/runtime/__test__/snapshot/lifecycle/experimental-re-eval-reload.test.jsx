/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { root, useState } from '../../../src/index';
import { BackgroundSnapshotInstance } from '../../../src/snapshot/snapshot/backgroundSnapshot';
import { reloadMainThread } from '../../../src/snapshot/lifecycle/reload';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { __root, setRoot } from '../../../src/root';
import { SnapshotInstance } from '../../../src/snapshot/snapshot/snapshot';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, nativeMethodQueue, waitSchedule } from '../utils/nativeMethod';

const mainThreadEntryReloaderKey = Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');
const mainThreadReloadCompleterKey = Symbol.for('__LYNX_MAIN_THREAD_RELOAD_COMPLETER__');
const reloadVersionKey = Symbol.for('__LYNX_RELOAD_VERSION__');
let nextMtsRefId = 0;

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  nextMtsRefId = 0;
  globalEnvManager.resetEnv();
  globalThis.runWorklet = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.__reloadStateTestOnTap;
  delete globalThis.__reloadStateTestMtsTap;
  globalEnvManager.resetEnv();
});

function createEntry() {
  const entryId = nextMtsRefId++;
  const mtsRef = { _wkltId: `reload-mts-ref-${entryId}` };
  let moduleTapCount = 0;
  let mtsTapCount = 0;
  let renderedCount = 0;
  let onTap = () => {};

  function App() {
    const [count, setCount] = useState(0);
    renderedCount = count;
    onTap = () => {
      moduleTapCount += 1;
      setCount(value => value + 1);
    };
    globalThis.__reloadStateTestOnTap = onTap;
    const onMtsTap = (event) => {
      'main thread';
      mtsTapCount += 1;
      event.currentTarget.setAttribute('test-state', 'tapped');
    };
    globalThis.__reloadStateTestMtsTap = onMtsTap;
    return (
      <view main-thread:ref={mtsRef} test-state='idle'>
        <text>{count}</text>
        <text bindtap={onTap}>tap</text>
        <text main-thread:bindtap={onMtsTap}>MTS tap</text>
      </view>
    );
  }

  return {
    jsx: <App />,
    mtsRef,
    getModuleTapCount: () => moduleTapCount,
    getMtsTapCount: () => mtsTapCount,
    getRenderedCount: () => renderedCount,
  };
}

function triggerMtsTap() {
  const element = elementTree.toTree().children[0];
  globalThis.__reloadStateTestMtsTap({
    currentTarget: {
      setAttribute(name, value) {
        __SetAttribute(element, name, value);
        __FlushElementTree();
      },
    },
  });
}

function getView() {
  return elementTree.toTree().children[0];
}

function expectViewState(count, mtsState) {
  const view = getView();
  expect(view.props['test-state']).toBe(mtsState);
  expect(view.children[0].children[0].props.text).toBe(count);
}

function applyLatestNativeUpdate() {
  const [method, args] = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalThis[method](args);
}

async function waitForBackgroundUpdate() {
  await waitSchedule();
  globalEnvManager.switchToMainThread();
  applyLatestNativeUpdate();
}

function getElementTreeUiSigns(element) {
  if (!element) return [];
  return [
    element.$$uiSign,
    ...(element.children ?? []).flatMap(getElementTreeUiSigns),
  ];
}

describe('experimental re-eval reload', () => {
  it('resets React state, preserves MTS element mutations, and reattaches refs and events', async () => {
    const firstEntry = createEntry();
    __root.__jsx = firstEntry.jsx;
    renderPage();
    expect(elementTree).toMatchInlineSnapshot(`
      "<page
        cssId="default-entry-from-native:0"
      >
        <view
          has-react-ref={true}
          test-state="idle"
        >
          <text>
            <raw-text
              text={0}
            />
          </text>
          <text
            event={
              Object {
                "bindEvent:tap": "-2:1:",
              }
            }
          >
            <raw-text
              text="tap"
            />
          </text>
          <text>
            <raw-text
              text="MTS tap"
            />
          </text>
        </view>
      </page>"
    `);
    globalEnvManager.switchToBackground();
    root.render(firstEntry.jsx, __root);
    await waitSchedule();
    lynx.getApp().OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    globalEnvManager.switchToMainThread();
    applyLatestNativeUpdate();

    globalEnvManager.switchToBackground();
    globalThis.__reloadStateTestOnTap();
    await waitSchedule();
    globalEnvManager.switchToMainThread();
    const firstMtsRefAttach = globalThis.runWorklet.mock.calls.find(([ref, args]) =>
      ref === firstEntry.mtsRef && args[0]?.elementRefptr
    );
    expect(firstMtsRefAttach).toBeDefined();
    expect(firstMtsRefAttach[1][0].elementRefptr).toBe(elementTree.toTree().children[0]);
    applyLatestNativeUpdate();

    expect(firstEntry.getRenderedCount()).toBe(1);
    expect(firstEntry.getModuleTapCount()).toBe(1);
    expectViewState(1, 'idle');
    triggerMtsTap();
    expect(firstEntry.getMtsTapCount()).toBe(1);
    expectViewState(1, 'tapped');

    const lynxSymbols = lynx;
    const originalEntryReloader = lynxSymbols[mainThreadEntryReloaderKey];
    const originalReloadCompleter = lynxSymbols[mainThreadReloadCompleterKey];
    const previousReloadVersion = lynxSymbols[reloadVersionKey];
    const reloadedEntry = createEntry();
    const uiSignsBeforeReload = getElementTreeUiSigns(elementTree.toTree());
    const reloader = vi.fn(() => {
      const newRoot = new SnapshotInstance('root');
      newRoot.__jsx = reloadedEntry.jsx;
      setRoot(newRoot);
    });
    const completeReload = originalReloadCompleter;
    const completer = vi.fn(handoff => completeReload(handoff));

    lynxSymbols[mainThreadEntryReloaderKey] = reloader;
    lynxSymbols[mainThreadReloadCompleterKey] = completer;
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);

    try {
      nativeMethodQueue.clear();
      globalThis.runWorklet.mockClear();
      reloadMainThread({}, { reloadTemplate: true });
      await waitSchedule();

      expect(reloader).toHaveBeenCalledTimes(1);
      expect(completer).toHaveBeenCalledTimes(1);
      expect(completer.mock.calls[0][0]).toEqual(expect.objectContaining({
        oldRoot: expect.any(SnapshotInstance),
        page: expect.anything(),
        options: { reloadTemplate: true },
        firstScreenSyncState: expect.any(Object),
      }));
      expect(elementTree).toMatchInlineSnapshot(`
        "<page
          cssId="default-entry-from-native:0"
        >
          <view
            has-react-ref={true}
            test-state="tapped"
          >
            <text>
              <raw-text
                text={0}
              />
            </text>
            <text
              event={
                Object {
                  "bindEvent:tap": "-5:1:",
                }
              }
            >
              <raw-text
                text="tap"
              />
            </text>
            <text>
              <raw-text
                text="MTS tap"
              />
            </text>
          </view>
        </page>"
      `);
      expect(reloadedEntry.getRenderedCount()).toBe(0);
      expect(reloadedEntry.getModuleTapCount()).toBe(0);
      expect(reloadedEntry.getMtsTapCount()).toBe(0);
      expectViewState(0, 'tapped');
      const reloadedMtsRefAttach = globalThis.runWorklet.mock.calls.find(([ref, args]) =>
        ref === reloadedEntry.mtsRef && args[0]?.elementRefptr
      );
      expect(reloadedMtsRefAttach).toBeDefined();
      expect(reloadedMtsRefAttach[1][0].elementRefptr.props['has-react-ref']).toBe(true);
      expect(reloadedMtsRefAttach[1][0].elementRefptr).toBe(elementTree.toTree().children[0]);
      const reloadPapiNames = nativeMethodQueue.map(([apiName]) => apiName);
      const reloadPapiCounts = {};
      for (const apiName of reloadPapiNames) {
        reloadPapiCounts[apiName] = (reloadPapiCounts[apiName] ?? 0) + 1;
      }
      expect(reloadPapiNames.filter(apiName => apiName.startsWith('__Create'))).toEqual([]);
      expect(getElementTreeUiSigns(elementTree.toTree())).toEqual(uiSignsBeforeReload);
      expect(reloadPapiCounts).toMatchInlineSnapshot(`
        {
          "__AddEvent": 1,
          "__FlushElementTree": 1,
          "__GetElementUniqueID": 1,
          "__GetTag": 1,
          "__SetAttribute": 2,
        }
      `);

      nativeMethodQueue.clear();
      triggerMtsTap();
      expect(reloadedEntry.getMtsTapCount()).toBe(1);
      expectViewState(0, 'tapped');
      const mtsTapPapiNames = nativeMethodQueue.map(([apiName]) => apiName);
      const mtsTapPapiCounts = {};
      for (const apiName of mtsTapPapiNames) {
        mtsTapPapiCounts[apiName] = (mtsTapPapiCounts[apiName] ?? 0) + 1;
      }
      expect(mtsTapPapiNames.filter(apiName => apiName.startsWith('__Create'))).toEqual([]);
      expect(mtsTapPapiCounts).toMatchInlineSnapshot(`
        {
          "__FlushElementTree": 1,
          "__SetAttribute": 1,
        }
      `);
      expect(elementTree).toMatchInlineSnapshot(`
        "<page
          cssId="default-entry-from-native:0"
        >
          <view
            has-react-ref={true}
            test-state="tapped"
          >
            <text>
              <raw-text
                text={0}
              />
            </text>
            <text
              event={
                Object {
                  "bindEvent:tap": "-5:1:",
                }
              }
            >
              <raw-text
                text="tap"
              />
            </text>
            <text>
              <raw-text
                text="MTS tap"
              />
            </text>
          </view>
        </page>"
      `);
      expect(
        nativeMethodQueue.filter(([apiName]) => apiName.startsWith('__Create')),
      ).toEqual([]);
      expect(getElementTreeUiSigns(elementTree.toTree())).toEqual(uiSignsBeforeReload);

      globalEnvManager.switchToBackground();
      setRoot(new BackgroundSnapshotInstance('root'));
      root.render(reloadedEntry.jsx, __root);
      await waitSchedule();
      lynx.getApp().OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls.at(-1));
      globalEnvManager.switchToMainThread();
      applyLatestNativeUpdate();

      globalEnvManager.switchToBackground();
      globalThis.__reloadStateTestOnTap();
      await waitForBackgroundUpdate();
      expect(elementTree).toMatchInlineSnapshot(`
        "<page
          cssId="default-entry-from-native:0"
        >
          <view
            has-react-ref={true}
            test-state="tapped"
          >
            <text>
              <raw-text
                text={1}
              />
            </text>
            <text
              event={
                Object {
                  "bindEvent:tap": "-5:1:",
                }
              }
            >
              <raw-text
                text="tap"
              />
            </text>
            <text>
              <raw-text
                text="MTS tap"
              />
            </text>
          </view>
        </page>"
      `);
      expect(reloadedEntry.getRenderedCount()).toBe(1);
      expect(reloadedEntry.getModuleTapCount()).toBe(1);
      expectViewState(1, 'tapped');
    } finally {
      if (originalEntryReloader === undefined) {
        delete lynxSymbols[mainThreadEntryReloaderKey];
      } else {
        lynxSymbols[mainThreadEntryReloaderKey] = originalEntryReloader;
      }
      if (originalReloadCompleter === undefined) {
        delete lynxSymbols[mainThreadReloadCompleterKey];
      } else {
        lynxSymbols[mainThreadReloadCompleterKey] = originalReloadCompleter;
      }
      if (previousReloadVersion === undefined) {
        delete lynxSymbols[reloadVersionKey];
      } else {
        lynxSymbols[reloadVersionKey] = previousReloadVersion;
      }
    }

    vi.unstubAllGlobals();
  });
});
