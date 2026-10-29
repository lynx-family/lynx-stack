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
import { TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX } from '../../../../src/element-template/runtime/template/typed-attributes.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  resetElementTemplateBackgroundFunctionRuntime,
  resetElementTemplateMainThreadBackgroundFunctionRuntime,
} from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { clearMainThreadDynamicAttrState } from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import type { MTEventNativeWrapper } from '../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import type { Worklet } from '../../../../src/worklet-runtime/bindings/types.js';
import { initWorklet } from '../../../../src/worklet-runtime/workletRuntime.js';
import type { SpreadMtsFixtureProps } from '../../fixtures/spread/mts/index.js';
import { loadCompiledFixturePair } from '../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { lastMock } from '../../test-utils/mock/mockNativePapi.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/spread/mts/index.tsx',
);

interface FixtureModule {
  App: (props: SpreadMtsFixtureProps) => JSX.Element;
}

function findCreatedRootSlots(): Record<string, unknown>[] {
  for (const entry of lastMock!.nativeLog) {
    if (
      Array.isArray(entry)
      && entry[0] === '__CreateElementTemplate'
      && entry[1] !== '_et_builtin_raw_text'
      && Array.isArray(entry[3])
    ) {
      return entry[3] as Record<string, unknown>[];
    }
  }
  throw new Error('No compiled template create call found.');
}

function findLatestSetAttributeForSlot(slotIndex: number): Record<string, unknown> | null {
  const entry = lastMock!.nativeLog.findLast(value =>
    Array.isArray(value)
    && value[0] === '__SetAttributeOfElementTemplate'
    && value[2] === slotIndex
  ) as unknown[] | undefined;
  if (!entry) {
    throw new Error(`No __SetAttributeOfElementTemplate found for slot ${slotIndex}.`);
  }
  return entry[3] as Record<string, unknown> | null;
}

function extractSpreadWorklet(spread: Record<string, unknown>, key: string): Worklet {
  const wrapper = spread[key] as MTEventNativeWrapper | undefined;
  expect(wrapper).toMatchObject({ type: 'worklet' });
  return wrapper!.value as Worklet;
}

function extractSpreadGestureCallback(
  spread: Record<string, unknown>,
  callbackName = 'onUpdate',
): Worklet {
  const gesture = spread['main-thread:gesture'] as GestureSlotValue | undefined;
  expect(gesture?.type).toBe('gesture');
  for (const descriptor of gesture!.value) {
    const found = descriptor.callbacks.find(item => item.name === callbackName);
    if (found) {
      return found.callback as Worklet;
    }
  }
  throw new Error(`Gesture callback '${callbackName}' not found.`);
}

describe('Compiled ET spread MTEvent, MTRef, and Gesture lifecycle', () => {
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

  it('hydrates multiple spread main-thread events, composed gestures, and root/nested object MTRefs with pre-hydrate replay', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const onTapReport = vi.fn((source: string, label: string, count: number) => `${source}:${label}:${count}`);
    const onMoveReport = vi.fn((label: string, count: number) => `move:${label}:${count}`);
    const onGestureReport = vi.fn((source: string, label: string, count: number) => `${source}:${label}:${count}`);

    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'first',
      onTapReport,
      onMoveReport,
      onGestureReport,
    });
    renderCompiledFixtureOnMainThread(mainModule, env, {
      label: 'first',
      onTapReport,
      onMoveReport,
      onGestureReport,
    });

    const firstScreenSlots = findCreatedRootSlots();
    const firstSpread = firstScreenSlots[0]!;
    const nestedSpread = firstScreenSlots[2]!;

    // Spread main-thread:ref is stripped before Native create while layout-only/flatten guards are added.
    expect(firstSpread).not.toHaveProperty('main-thread:ref');
    expect(firstSpread).toMatchObject({ 'has-react-ref': true, flatten: false });
    expect(nestedSpread).not.toHaveProperty('main-thread:ref');
    expect(nestedSpread).toMatchObject({ 'has-react-ref': true, flatten: false });

    const preHydrateTap = extractSpreadWorklet(firstSpread, 'main-thread:bindtap');
    const preHydrateMove = extractSpreadWorklet(firstSpread, 'main-thread:catchtouchmove');
    const preHydrateGesture = extractSpreadGestureCallback(firstSpread, 'onUpdate');

    let delayedTap: Promise<unknown>;
    let delayedGesture: Promise<unknown>;
    env.switchToMainThread(() => {
      // Object MainThreadRefs on both root and nested spread targets are attached on first screen.
      const firstScreenRefMap = globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap;
      expect(
        Object.values(firstScreenRefMap).filter(entry => (entry as { current?: unknown })?.current != null),
      ).toHaveLength(2);

      delayedTap = globalThis.runWorklet(preHydrateTap, []) as Promise<unknown>;
      delayedGesture = globalThis.runWorklet(preHydrateGesture, []) as Promise<unknown>;
      expect(onTapReport).not.toHaveBeenCalled();
      expect(onGestureReport).not.toHaveBeenCalled();
    });

    expect(updates.at(-1)?.isHydration).toBe(true);
    // Both root and nested spread object MainThreadRefs (including nestedElRef not captured in any worklet closure)
    // are attached in _workletRefMap after hydration.
    expect(
      Object.values(globalThis.lynxWorkletImpl._refImpl._workletRefMap).filter(
        entry =>
          typeof (entry as { current?: unknown })?.current === 'object'
          && (entry as { current?: unknown }).current !== null,
      ),
    ).toHaveLength(2);
    const hydratedSpread = findLatestSetAttributeForSlot(0)!;
    expect(hydratedSpread).not.toHaveProperty('main-thread:ref');
    expect(hydratedSpread).toMatchObject({ 'has-react-ref': true, flatten: false });

    const hydratedTap = extractSpreadWorklet(hydratedSpread, 'main-thread:bindtap');
    const hydratedMove = extractSpreadWorklet(hydratedSpread, 'main-thread:catchtouchmove');
    const hydratedGesture = extractSpreadGestureCallback(hydratedSpread, 'onUpdate');
    expect(hydratedTap).not.toBe(preHydrateTap);
    expect(hydratedMove).not.toBe(preHydrateMove);
    expect(hydratedGesture).not.toBe(preHydrateGesture);

    env.switchToBackground();
    expect(onTapReport).toHaveBeenCalledWith('primary:with-ref', 'first', 1);
    expect(onGestureReport).toHaveBeenCalledWith('primary-gesture', 'first', 2);

    env.switchToMainThread();
    await expect(delayedTap!).resolves.toBe('primary:with-ref:first:1');
    await expect(delayedGesture!).resolves.toBe('primary-gesture:first:2');

    // Post-hydrate execution preserves MainThreadRef count (2 -> 3 -> 4) across all spread callbacks.
    const moveRes = globalThis.runWorklet(hydratedMove, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onMoveReport).toHaveBeenCalledWith('first', 3);
    env.switchToMainThread();
    await expect(moveRes).resolves.toBe('move:first:3');

    // Closure update & clearing in spread slot.
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'second',
      onTapReport,
      onMoveReport,
      onGestureReport,
    });
    env.switchToMainThread();
    const updatedSpread = findLatestSetAttributeForSlot(0)!;
    const updatedTap = extractSpreadWorklet(updatedSpread, 'main-thread:bindtap');
    const tapRes = globalThis.runWorklet(updatedTap, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onTapReport).toHaveBeenLastCalledWith('primary:with-ref', 'second', 4);
    env.switchToMainThread();
    await expect(tapRes).resolves.toBe('primary:with-ref:second:4');

    // Clearing spread events & gesture emits explicit nulls to Native.
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'second',
      enableEvents: false,
      enableGesture: false,
      onTapReport,
      onMoveReport,
      onGestureReport,
    });
    env.switchToMainThread();
    const clearedSpread = findLatestSetAttributeForSlot(0)!;
    expect(clearedSpread).toMatchObject({
      'main-thread:bindtap': null,
      'main-thread:catchtouchmove': null,
      'main-thread:gesture': null,
    });
  });

  it('handles multi-spread MTRef/MTEvent/Gesture override, masked ctx hydration, key-deletion fallback, latest closure update, and unmount cleanup', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const onRefReport = vi.fn();
    const onTapReport = vi.fn((source: string, label: string, count: number) => `${source}:${label}:${count}`);
    const onGestureReport = vi.fn((source: string, label: string, count: number) => `${source}:${label}:${count}`);

    // Initial render with secondSpread overriding firstSpread's callback ref, bindtap, and gesture.
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v1',
      refKind: 'callback',
      secondSpreadMode: 'override-events-gesture-ref',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    renderCompiledFixtureOnMainThread(mainModule, env, {
      label: 'v1',
      refKind: 'callback',
      secondSpreadMode: 'override-events-gesture-ref',
      onRefReport,
      onTapReport,
      onGestureReport,
    });

    // Hydrate completes: BOTH slot 0 (masked firstSpread) and slot 1 (overriding secondSpread) hydrate!
    env.switchToMainThread(() => {
      const firstScreenRefs = Object.values(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap);
      expect(firstScreenRefs.some(entry => (entry as { current?: unknown })?.current != null)).toBe(true);
    });
    env.switchToBackground();
    expect(onRefReport.mock.calls).toEqual([
      ['mount-override:v1', 'present'],
      ['mount-override:v1', 'present'],
      ['cleanup-override:v1', 'cleaned'],
    ]);

    env.switchToMainThread();
    expect(
      Object.values(globalThis.lynxWorkletImpl._refImpl._workletRefMap).some(
        entry =>
          typeof (entry as { current?: unknown })?.current === 'object'
          && (entry as { current?: unknown })?.current !== null,
      ),
    ).toBe(true);

    // Capture the hydrated slot 0 (masked) and slot 1 (overriding) spread payloads.
    const hydratedMaskedSlot0 = findLatestSetAttributeForSlot(0)!;
    const hydratedOverrideSlot1 = findLatestSetAttributeForSlot(1)!;
    const overrideTap = extractSpreadWorklet(hydratedOverrideSlot1, 'main-thread:bindtap');
    const overrideGesture = extractSpreadGestureCallback(hydratedOverrideSlot1, 'onUpdate');

    // Execute overriding slot 1 MTEvent (+10) and Gesture (+100).
    const overrideTapRes = globalThis.runWorklet(overrideTap, []) as Promise<unknown>;
    const overrideGestureRes = globalThis.runWorklet(overrideGesture, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onTapReport).toHaveBeenLastCalledWith('secondary', 'v1', 10);
    expect(onGestureReport).toHaveBeenLastCalledWith('secondary-gesture', 'v1', 110);
    env.switchToMainThread();
    await expect(overrideTapRes).resolves.toBe('secondary:v1:10');
    await expect(overrideGestureRes).resolves.toBe('secondary-gesture:v1:110');

    env.switchToBackground();
    onRefReport.mockClear();

    // Explicit { 'main-thread:ref': undefined } in secondSpread overrides firstSpread with null (detaches ref).
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v1',
      refKind: 'callback',
      secondSpreadMode: 'null-ref',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    expect(onRefReport.mock.calls).toEqual([['cleanup-override:v1', 'cleaned']]);
    onRefReport.mockClear();

    // Omitting MTS keys from secondSpread while keeping label='v1' emits NO new slot 0 patch!
    // Native falls back to slot 0's already-hydrated MTEvent & Gesture ctxs, while slot 0's callback ref mounts.
    env.switchToMainThread();
    lastMock!.nativeLog.length = 0;
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v1',
      refKind: 'callback',
      secondSpreadMode: 'omit',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    env.switchToMainThread();
    // Confirm slot 0 was NOT re-patched (memoized on label='v1'), only slot 1 was updated to omit the override keys.
    expect(
      lastMock!.nativeLog.some(entry =>
        Array.isArray(entry) && entry[0] === '__SetAttributeOfElementTemplate' && entry[2] === 0
      ),
    ).toBe(false);
    expect(findLatestSetAttributeForSlot(1)).toEqual({ 'data-extra': 'ok' });

    env.switchToBackground();
    expect(onRefReport.mock.calls).toEqual([['mount:v1', 'present']]);
    onRefReport.mockClear();

    // Execute the masked-at-hydration slot 0 MTEvent & Gesture ctxs that Native now falls back to!
    env.switchToMainThread();
    const fallbackMaskedTap = extractSpreadWorklet(hydratedMaskedSlot0, 'main-thread:bindtap');
    const fallbackMaskedGesture = extractSpreadGestureCallback(hydratedMaskedSlot0, 'onUpdate');
    const fallbackTapRes = globalThis.runWorklet(fallbackMaskedTap, []) as Promise<unknown>;
    const fallbackGestureRes = globalThis.runWorklet(fallbackMaskedGesture, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onTapReport).toHaveBeenLastCalledWith('primary:with-ref', 'v1', 111);
    expect(onGestureReport).toHaveBeenLastCalledWith('primary-gesture', 'v1', 112);
    env.switchToMainThread();
    await expect(fallbackTapRes).resolves.toBe('primary:with-ref:v1:111');
    await expect(fallbackGestureRes).resolves.toBe('primary-gesture:v1:112');

    // Updating a sibling prop in firstSpread without changing memoized primaryCallbackRef does NOT remount it.
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v1',
      cardId: 'card-sibling-update',
      refKind: 'callback',
      secondSpreadMode: 'omit',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    expect(onRefReport).not.toHaveBeenCalled();

    // Updating label='v2' refreshes slot 0's closure for MTRef, MTEvent, and Gesture!
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      label: 'v2',
      cardId: 'card-sibling-update',
      refKind: 'callback',
      secondSpreadMode: 'omit',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    env.switchToMainThread();
    const updatedSlot0 = findLatestSetAttributeForSlot(0)!;
    const latestTap = extractSpreadWorklet(updatedSlot0, 'main-thread:bindtap');
    const latestGesture = extractSpreadGestureCallback(updatedSlot0, 'onUpdate');
    const latestTapRes = globalThis.runWorklet(latestTap, []) as Promise<unknown>;
    const latestGestureRes = globalThis.runWorklet(latestGesture, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onRefReport.mock.calls).toEqual([
      ['cleanup:v1', 'cleaned'],
      ['mount:v2', 'present'],
    ]);
    expect(onTapReport).toHaveBeenLastCalledWith('primary:with-ref', 'v2', 113);
    expect(onGestureReport).toHaveBeenLastCalledWith('primary-gesture', 'v2', 114);
    env.switchToMainThread();
    await expect(latestTapRes).resolves.toBe('primary:with-ref:v2:113');
    await expect(latestGestureRes).resolves.toBe('primary-gesture:v2:114');
    env.switchToBackground();
    onRefReport.mockClear();

    // Unmounting cleans up the active spread callback ref once.
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      show: false,
      label: 'v2',
      refKind: 'callback',
      onRefReport,
      onTapReport,
      onGestureReport,
    });
    env.switchToMainThread();
    env.switchToBackground();
    expect(onRefReport.mock.calls).toEqual([['cleanup:v2', 'cleaned']]);
  });

  it('keeps typed <page {...props} /> and <list {...props} /> spreads isolated from main-thread capabilities', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });

    renderCompiledFixtureOnBackground(backgroundModule, env, {
      mode: 'typed-page',
      cardId: 'page-id',
      refKind: 'callback',
    });
    renderCompiledFixtureOnMainThread(mainModule, env, {
      mode: 'typed-page',
      cardId: 'page-id',
      refKind: 'callback',
    });
    env.switchToMainThread();

    const pageAttrEntry = lastMock!.nativeLog.find(entry =>
      Array.isArray(entry)
      && entry[0] === '__SetAttributeOfElementTemplate'
      && typeof entry[1] === 'string'
      && entry[1].startsWith('<page')
      && entry[2] === TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX
    ) as unknown[] | undefined;
    expect(pageAttrEntry?.[3]).toEqual({ id: 'page-id' });

    lastMock!.nativeLog.length = 0;
    renderCompiledFixtureOnBackground(backgroundModule, env, {
      mode: 'typed-list',
      cardId: 'list-id',
      refKind: 'callback',
    });
    env.switchToMainThread();
    const listCreateEntry = lastMock!.nativeLog.find(entry =>
      Array.isArray(entry) && entry[0] === '__CreateTypedElementTemplate' && entry[1] === 'list'
    ) as unknown[] | undefined;
    const listAttrs = (listCreateEntry?.[2] ?? {}) as Record<string, unknown>;
    expect(listAttrs['id']).toBe('list-id');
    expect(listAttrs).not.toHaveProperty('main-thread:bindtap');
    expect(listAttrs).not.toHaveProperty('main-thread:ref');
    expect(listAttrs).not.toHaveProperty('main-thread:gesture');
    expect(listAttrs).not.toHaveProperty('has-react-ref');
  });
});
