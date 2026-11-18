// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import {
  installElementTemplateRefInitValueListener,
  resetElementTemplateRefInitValueListener,
} from '../../../../src/element-template/main-thread-ref-init-value.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import type { GestureSlotValue } from '../../../../src/element-template/prop-adapters/gesture.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../src/element-template/protocol/update-event.js';
import { destroyAllElementTemplateListStates } from '../../../../src/element-template/runtime/list/list.js';
import type {
  ETListComponentAtIndexCallback,
  ETListEnqueueComponentCallback,
} from '../../../../src/element-template/runtime/list/list.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  resetElementTemplateBackgroundFunctionRuntime,
  resetElementTemplateMainThreadBackgroundFunctionRuntime,
} from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { clearMainThreadDynamicAttrState } from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import type { MTEventNativeWrapper } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX } from '../../../../src/element-template/runtime/template/typed-attributes.js';
import type { Worklet } from '../../../../src/worklet-runtime/bindings/types.js';
import { initWorklet } from '../../../../src/worklet-runtime/workletRuntime.js';
import type { ListMtsFixtureProps } from '../../fixtures/list/mts/index.js';
import { loadCompiledFixturePair } from '../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { lastMock } from '../../test-utils/mock/mockNativePapi.js';
import type { CompiledTemplateNode } from '../../test-utils/mock/mockNativePapi/templateTree.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/list/mts/index.tsx',
);

interface FixtureModule {
  App: (props: ListMtsFixtureProps) => JSX.Element;
}

interface CreatedListInfo {
  listNode: CompiledTemplateNode;
  listUid: number;
  attributes: Record<string, unknown>;
  componentAtIndex: ETListComponentAtIndexCallback;
  enqueueComponent: ETListEnqueueComponentCallback;
  getItemUidByKey: (itemKey: string) => number;
}

function findLatestCreatedList(): CreatedListInfo {
  const entry = lastMock!.nativeLog.findLast(value =>
    Array.isArray(value)
    && value[0] === '__CreateTypedElementTemplate'
    && value[1] === 'list'
  ) as unknown[] | undefined;
  if (!entry) {
    throw new Error('No __CreateTypedElementTemplate("list") call found.');
  }
  const listUid = entry[4] as number;
  const attributes = entry[2] as Record<string, unknown>;
  const listNode = elementTemplateRegistry.get(listUid) as CompiledTemplateNode | undefined;
  if (!listNode) {
    throw new Error(`List node ${listUid} not found in elementTemplateRegistry.`);
  }
  return {
    listNode,
    listUid,
    attributes,
    componentAtIndex: attributes['component-at-index'] as ETListComponentAtIndexCallback,
    enqueueComponent: attributes['enqueue-component'] as ETListEnqueueComponentCallback,
    getItemUidByKey(itemKey: string): number {
      const items = (listNode.__childSlots?.[0] ?? []) as CompiledTemplateNode[];
      const matched = items.find(
        item =>
          (item.__options?.['__listItemPlatformInfo'] as Record<string, unknown> | undefined)?.['item-key'] === itemKey,
      );
      if (!matched || typeof matched.__handleId !== 'number') {
        throw new Error(`List item '${itemKey}' not found in list ${listUid}.`);
      }
      return matched.__handleId;
    },
  };
}

function findLatestListSetAttribute(listNode: CompiledTemplateNode): Record<string, unknown> {
  const attrs = listNode.__attributeSlots?.[TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX] as
    | Record<string, unknown>
    | undefined;
  if (!attrs) {
    throw new Error('No attributes slot found on typed list.');
  }
  return attrs;
}

function extractWorklet(attributes: Record<string, unknown>, key: string): Worklet {
  const wrapper = attributes[key] as MTEventNativeWrapper | undefined;
  expect(wrapper).toMatchObject({ type: 'worklet' });
  return wrapper!.value as Worklet;
}

function extractGestureCallback(attributes: Record<string, unknown>, callbackName = 'onUpdate'): Worklet {
  const gesture = attributes['main-thread:gesture'] as GestureSlotValue | undefined;
  expect(gesture?.type).toBe('gesture');
  for (const descriptor of gesture!.value) {
    const found = descriptor.callbacks.find(item => item.name === callbackName);
    if (found) {
      return found.callback as Worklet;
    }
  }
  throw new Error(`Gesture callback '${callbackName}' not found.`);
}

function getAttachedObjectRefTargets(refMap: Record<string, unknown>): unknown[] {
  return Object.values(refMap)
    .map(entry => {
      const current = (entry as { current?: unknown })?.current;
      if (typeof current !== 'object' || current === null) {
        return null;
      }
      // Unwrap MainThread.Element wrapper ({ element: ElementRef } via getter) when present.
      return (current as { element?: unknown }).element ?? current;
    })
    .filter(target => target !== null);
}

describe('Compiled ET <list> MTS capabilities and <list-item> MTRef lifecycle', () => {
  const env = new ElementTemplateEnvManager();
  let sdk: string | undefined;
  let updates: ElementTemplateUpdateCommitContext[];
  const onUpdate = (event: { data: unknown }) => updates.push(parseElementTemplateUpdateEventPayload(event.data));

  beforeEach(() => {
    vi.clearAllMocks();
    sdk = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.0';
    updates = [];
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
    clearMainThreadDynamicAttrState();
    destroyAllElementTemplateListStates();
    resetElementTemplateBackgroundFunctionRuntime();
    env.resetEnv('background');
    env.setUseElementTemplate(true);
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();
    env.switchToMainThread();
    initWorklet();
    installElementTemplateRefInitValueListener();
    installElementTemplatePatchListener();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    env.switchToBackground();
    vi.stubGlobal('__LoadLepusChunk', vi.fn(() => true));
  });

  afterEach(() => {
    env.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    resetElementTemplatePatchListener();
    resetElementTemplateRefInitValueListener();
    clearMainThreadDynamicAttrState();
    destroyAllElementTemplateListStates();
    resetElementTemplateMainThreadBackgroundFunctionRuntime();
    env.switchToBackground();
    resetElementTemplateHydrationListener();
    resetElementTemplateBackgroundFunctionRuntime();
    env.setUseElementTemplate(false);
    SystemInfo.lynxSdkVersion = sdk;
    delete globalThis.lynxWorkletImpl;
    // @ts-expect-error Restore globals installed by the real worklet runtime.
    delete globalThis.registerWorklet;
    // @ts-expect-error Restore globals installed by the real worklet runtime.
    delete globalThis.registerWorkletInternal;
    // @ts-expect-error Restore globals installed by the real worklet runtime.
    delete globalThis.runWorklet;
    vi.unstubAllGlobals();
  });

  it('supports <list> own MTEvent/Gesture/MTRef and <list-item> MTRef across first screen, Native cell binding/recycling, hydration, and post-hydrate updates', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const onListScrollReport = vi.fn((label: string, hasListEl: boolean, count: number) =>
      `scroll:${label}:${hasListEl}:${count}`
    );
    const onListGestureReport = vi.fn((label: string, count: number) => `gesture:${label}:${count}`);
    const onListRefReport = vi.fn();
    const onItemRefReport = vi.fn();

    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v1',
      listRefMode: 'object',
      onListScrollReport,
      onListGestureReport,
      onListRefReport,
      onItemRefReport,
    });
    renderCompiledFixtureOnMainThread(mainModule, env, {
      label: 'v1',
      listRefMode: 'object',
      onListScrollReport,
      onListGestureReport,
      onListRefReport,
      onItemRefReport,
    });

    const listInfo = findLatestCreatedList();
    expect(listInfo.attributes).not.toHaveProperty('main-thread:ref');
    expect(listInfo.attributes).not.toHaveProperty('component-at-indexes');
    expect(listInfo.attributes).toMatchObject({
      id: 'feed-list',
      'has-react-ref': true,
      flatten: false,
      'component-at-index': listInfo.componentAtIndex,
      'enqueue-component': listInfo.enqueueComponent,
    });

    const itemAUid = listInfo.getItemUidByKey('item-a');
    const itemBUid = listInfo.getItemUidByKey('item-b');
    const itemCUid = listInfo.getItemUidByKey('item-c');

    const preHydrateScroll = extractWorklet(listInfo.attributes, 'main-thread:bindscroll');
    const preHydrateGesture = extractGestureCallback(listInfo.attributes, 'onUpdate');

    let delayedScroll: Promise<unknown>;
    let delayedGesture: Promise<unknown>;
    const expectedListElementRef = __GetElementByAttrSlot(
      listInfo.listNode as unknown as ElementTemplateHandle,
      0,
    );
    env.switchToMainThread(() => {
      const firstScreenRefMap = globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap;
      // Only <list>'s own object MTRef is attached on first screen, pointing to the list's own ElementRef.
      expect(getAttachedObjectRefTargets(firstScreenRefMap)).toEqual([expectedListElementRef]);
      expect(onItemRefReport).not.toHaveBeenCalled();

      // Pre-hydration Native ComponentAtIndex mounts item-a; repeated ComponentAtIndex is idempotent.
      const preHydrateSetAttrBefore = lastMock!.nativeLog.filter(
        entry => Array.isArray(entry) && entry[0] === '__SetAttribute',
      ).length;
      listInfo.componentAtIndex(listInfo.listUid, itemAUid);
      listInfo.componentAtIndex(listInfo.listUid, itemAUid);
      const preHydrateSetAttrAfter = lastMock!.nativeLog.filter(
        entry => Array.isArray(entry) && entry[0] === '__SetAttribute',
      ).length;
      expect(preHydrateSetAttrAfter).toBe(preHydrateSetAttrBefore + 1);

      delayedScroll = globalThis.runWorklet(preHydrateScroll, []) as Promise<unknown>;
      delayedGesture = globalThis.runWorklet(preHydrateGesture, []) as Promise<unknown>;
      expect(onListScrollReport).not.toHaveBeenCalled();
      expect(onListGestureReport).not.toHaveBeenCalled();
    });

    // Hydration completed: item-a was mounted pre-hydrate, while item-b was still unmounted.
    expect(updates.at(-1)?.isHydration).toBe(true);
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([
      ['mount', 'item-a', 'v1'],
      ['mount', 'item-a', 'v1'],
      ['cleanup', 'item-a', 'v1'],
    ]);
    expect(onListScrollReport).toHaveBeenCalledWith('v1', true, 1);
    expect(onListGestureReport).toHaveBeenCalledWith('v1', 11);
    onItemRefReport.mockClear();

    env.switchToMainThread();
    await expect(delayedScroll!).resolves.toBe('scroll:v1:true:1');
    await expect(delayedGesture!).resolves.toBe('gesture:v1:11');

    // Only <list>'s own object ref is attached right now; item-b (spread object ref) is still unmounted.
    expect(getAttachedObjectRefTargets(globalThis.lynxWorkletImpl._refImpl._workletRefMap)).toEqual([
      expectedListElementRef,
    ]);

    // Mount item-b via ComponentAtIndex -> spread object ref attaches to item-b's exact ElementRef; mount ref-free item-c -> no-op.
    const expectedItemBElementRef = __GetElementByAttrSlot(elementTemplateRegistry.get(itemBUid)!, 1);
    expect(expectedItemBElementRef).not.toBeNull();
    listInfo.componentAtIndex(listInfo.listUid, itemBUid);
    listInfo.componentAtIndex(listInfo.listUid, itemCUid);
    expect(getAttachedObjectRefTargets(globalThis.lynxWorkletImpl._refImpl._workletRefMap)).toEqual([
      expectedListElementRef,
      expectedItemBElementRef,
    ]);

    // EnqueueComponent detaches item-a & item-b, and repeated EnqueueComponent for available pool items is idempotent.
    listInfo.enqueueComponent(listInfo.listUid, itemAUid);
    listInfo.enqueueComponent(listInfo.listUid, itemAUid);
    listInfo.enqueueComponent(listInfo.listUid, itemBUid);
    listInfo.enqueueComponent(listInfo.listUid, itemBUid);
    listInfo.enqueueComponent(listInfo.listUid, itemCUid);
    expect(getAttachedObjectRefTargets(globalThis.lynxWorkletImpl._refImpl._workletRefMap)).toEqual([
      expectedListElementRef,
    ]);

    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([['cleanup', 'item-a', 'v1']]);
    onItemRefReport.mockClear();

    // Remount item-a and item-c via ComponentAtIndex, keeping item-b in the available pool.
    // Verify ComponentAtIndex suppresses EOM microtask __FlushElementTree() when item-a's ref calls el.setAttribute.
    env.switchToMainThread();
    const setAttributeCallsBefore = lastMock!.nativeLog.filter(
      entry => Array.isArray(entry) && entry[0] === '__SetAttribute',
    ).length;
    const flushCallsBefore = lastMock!.nativeLog.filter(
      entry => Array.isArray(entry) && entry[0] === '__FlushElementTree',
    ).length;
    listInfo.componentAtIndex(listInfo.listUid, itemAUid);
    listInfo.componentAtIndex(listInfo.listUid, itemCUid);
    await Promise.resolve();
    const setAttributeCallsAfter = lastMock!.nativeLog.filter(
      entry => Array.isArray(entry) && entry[0] === '__SetAttribute',
    ).length;
    const flushCallsAfter = lastMock!.nativeLog.filter(
      entry => Array.isArray(entry) && entry[0] === '__FlushElementTree',
    ).length;
    expect(setAttributeCallsAfter).toBe(setAttributeCallsBefore + 1);
    expect(flushCallsAfter).toBe(flushCallsBefore);
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([['mount', 'item-a', 'v1']]);
    onItemRefReport.mockClear();

    // Post-hydration update:
    // - Switch <list> from object ref to callback ref and refresh label='v2'
    // - Reorder mounted item-a and item-c (mounted item-a changes callback ref closure to v2,
    //   initially ref-free mounted item-c dynamically gains an object MTRef child,
    //   and unmounted item-b stays detached).
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v2',
      listRefMode: 'callback',
      items: [
        { key: 'item-c', hasChildRef: true, useCallbackRef: false },
        { key: 'item-a', hasChildRef: true, useCallbackRef: true },
        { key: 'item-b', hasChildRef: true, useCallbackRef: false },
      ],
      onListScrollReport,
      onListGestureReport,
      onListRefReport,
      onItemRefReport,
    });
    env.switchToMainThread();
    env.switchToBackground();

    expect(onListRefReport.mock.calls).toEqual([['mount', 'v2']]);
    expect(onItemRefReport.mock.calls).toEqual([
      ['cleanup', 'item-a', 'v1'],
      ['mount', 'item-a', 'v2'],
    ]);
    onListRefReport.mockClear();
    onItemRefReport.mockClear();

    env.switchToMainThread();
    const itemCNode = elementTemplateRegistry.get(itemCUid) as CompiledTemplateNode;
    const itemCBadgeNode = (itemCNode.children?.[0] as { children?: CompiledTemplateNode[] } | undefined)
      ?.children?.[0];
    const expectedItemCBadgeElementRef = __GetElementByAttrSlot(
      itemCBadgeNode as unknown as ElementTemplateHandle,
      1,
    );
    expect(expectedItemCBadgeElementRef).not.toBeNull();
    // item-c is mounted and just gained itemCObjectRef; item-b is still unmounted; listElRef was set by listCallbackRef.
    expect(getAttachedObjectRefTargets(globalThis.lynxWorkletImpl._refImpl._workletRefMap)).toEqual([
      expectedListElementRef,
      expectedItemCBadgeElementRef,
    ]);

    const updatedListAttrs = findLatestListSetAttribute(listInfo.listNode);
    expect(updatedListAttrs['component-at-index']).toBe(listInfo.componentAtIndex);
    expect(updatedListAttrs['enqueue-component']).toBe(listInfo.enqueueComponent);
    const updatedScroll = extractWorklet(updatedListAttrs, 'main-thread:bindscroll');
    const scrollV2 = globalThis.runWorklet(updatedScroll, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onListScrollReport).toHaveBeenLastCalledWith('v2', true, 12);
    env.switchToMainThread();
    await expect(scrollV2).resolves.toBe('scroll:v2:true:12');

    // Remove the MTRef child from mounted item-c and clear <list>'s own MTRef.
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v2',
      listRefMode: 'none',
      enableListEvents: false,
      enableListGesture: false,
      items: [
        { key: 'item-c', hasChildRef: false },
        { key: 'item-a', hasChildRef: true, useCallbackRef: true },
      ],
      onListScrollReport,
      onListGestureReport,
      onListRefReport,
      onItemRefReport,
    });
    env.switchToMainThread();
    env.switchToBackground();

    expect(onListRefReport.mock.calls).toEqual([['cleanup', 'v2']]);
    expect(onItemRefReport).not.toHaveBeenCalled();
    onListRefReport.mockClear();

    env.switchToMainThread();
    expect(getAttachedObjectRefTargets(globalThis.lynxWorkletImpl._refImpl._workletRefMap)).toEqual([]);

    // Unmounting <list> cleans up mounted item-a's callback MTRef and destroys list state.
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      showList: false,
      onListScrollReport,
      onListGestureReport,
      onListRefReport,
      onItemRefReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([['cleanup', 'item-a', 'v2']]);
  });

  it('syncs <list-item> MTRef candidates added during hydration mismatch and dynamic post-hydration <list> creation', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const onItemRefReport = vi.fn();

    // Background renders item-c WITH a callback MTRef plus an extra item-d WITH a callback MTRef,
    // while first-screen main thread rendered item-c WITHOUT a child MTRef and no item-d.
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'hydrate-sync',
      listRefMode: 'none',
      items: [
        { key: 'item-c', hasChildRef: true, useCallbackRef: true },
        { key: 'item-d', hasChildRef: true, useCallbackRef: true },
      ],
      onItemRefReport,
    });
    renderCompiledFixtureOnMainThread(mainModule, env, {
      label: 'hydrate-sync',
      listRefMode: 'none',
      items: [
        { key: 'item-c', hasChildRef: false },
      ],
      onItemRefReport,
    });

    const firstList = findLatestCreatedList();
    const itemCUid = firstList.getItemUidByKey('item-c');

    // Native mounts item-c before hydration; during hydration item-c gains a callback MTRef child!
    env.switchToMainThread(() => {
      firstList.componentAtIndex(firstList.listUid, itemCUid);
    });

    expect(updates.at(-1)?.isHydration).toBe(true);
    env.switchToBackground();
    // Mounted item-c immediately attaches the hydrated MTRef child; newly inserted item-d stays deferred!
    expect(onItemRefReport.mock.calls).toEqual([['mount', 'item-c', 'hydrate-sync']]);
    onItemRefReport.mockClear();

    const itemDUid = firstList.getItemUidByKey('item-d');
    env.switchToMainThread(() => {
      firstList.componentAtIndex(firstList.listUid, itemDUid);
    });
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([['mount', 'item-d', 'hydrate-sync']]);
    onItemRefReport.mockClear();

    // Unmount <list> and dynamically recreate it post-hydration via createTypedElement + initial updateTypedListItem.
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      showList: false,
      onItemRefReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([
      ['cleanup', 'item-c', 'hydrate-sync'],
      ['cleanup', 'item-d', 'hydrate-sync'],
    ]);
    onItemRefReport.mockClear();

    renderCompiledFixtureOnBackground(backgroundModule, env, {
      showList: true,
      label: 'recreated',
      listRefMode: 'callback',
      items: [
        { key: 'item-a', hasChildRef: true, useCallbackRef: true },
      ],
      onItemRefReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    // Item ref is still deferred until Native calls component-at-index on the newly created <list>.
    expect(onItemRefReport).not.toHaveBeenCalled();

    const recreatedList = findLatestCreatedList();
    const recreatedItemAUid = recreatedList.getItemUidByKey('item-a');
    env.switchToMainThread(() => {
      recreatedList.componentAtIndex(recreatedList.listUid, recreatedItemAUid);
    });
    env.switchToBackground();
    expect(onItemRefReport.mock.calls).toEqual([['mount', 'item-a', 'recreated']]);
  });
});
