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
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import type { GestureSlotValue } from '../../../../src/element-template/prop-adapters/gesture.js';
import {
  installElementTemplateRefInitValueListener,
  resetElementTemplateRefInitValueListener,
} from '../../../../src/element-template/main-thread-ref-init-value.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../src/element-template/protocol/update-event.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  resetElementTemplateBackgroundFunctionRuntime,
  resetElementTemplateMainThreadBackgroundFunctionRuntime,
} from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { clearMainThreadDynamicAttrState } from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { initWorklet } from '../../../../src/worklet-runtime/workletRuntime.js';
import type { Worklet } from '../../../../src/worklet-runtime/bindings/types.js';
import { loadCompiledFixturePair } from '../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { lastMock } from '../../test-utils/mock/mockNativePapi.js';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/gesture/direct/index.tsx',
);
interface GestureProps {
  label?: string;
  enabled?: boolean;
  show?: boolean;
  onReport?: (label: string, count: number) => string;
}
interface FixtureModule {
  App: (props: GestureProps) => JSX.Element;
}

function firstScreenGesture(): GestureSlotValue {
  for (const entry of lastMock!.nativeLog) {
    if (Array.isArray(entry) && entry[0] === '__CreateElementTemplate' && Array.isArray(entry[3])) {
      const gesture = entry[3].find((value: unknown) =>
        value != null && typeof value === 'object' && (value as GestureSlotValue).type === 'gesture'
      );
      if (gesture) return gesture as GestureSlotValue;
    }
  }
  throw new Error('No compiled first-screen Gesture slot was created.');
}

function latestNativeGesture(): GestureSlotValue | null {
  const entry = lastMock!.nativeLog.findLast(value =>
    Array.isArray(value) && value[0] === '__SetAttributeOfElementTemplate'
  ) as unknown[] | undefined;
  if (!entry) throw new Error('No Gesture attribute update reached Native.');
  return entry[3] as GestureSlotValue | null;
}

function callback(value: GestureSlotValue): Worklet {
  expect(value.type).toBe('gesture');
  const item = value.value[0]!.callbacks.find(item => item.name === 'onUpdate');
  expect(item).toBeDefined();
  return item!.callback as Worklet;
}

describe('Compiled ET direct Gesture worklet lifecycle', () => {
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

  it('replays pre-hydrate background calls and preserves MainThreadRef mutations in the hydrated callback', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const onReport = vi.fn((label: string, count: number) => `${label}:${count}`);
    renderCompiledFixtureOnBackground(backgroundModule, env, { label: 'first', onReport });
    renderCompiledFixtureOnMainThread(mainModule, env, { label: 'first', onReport });
    const first = callback(firstScreenGesture());
    let delayed: Promise<unknown>;
    env.switchToMainThread(() => {
      delayed = globalThis.runWorklet(first, []) as Promise<unknown>;
      expect(onReport).not.toHaveBeenCalled();
      expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(1);
    });
    expect(updates.at(-1)?.isHydration).toBe(true);
    const hydrated = callback(latestNativeGesture()!);
    expect(hydrated).not.toBe(first);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(0);
    env.switchToBackground();
    expect(onReport).toHaveBeenCalledWith('first', 1);
    env.switchToMainThread();
    await expect(delayed!).resolves.toBe('first:1');
    const next = globalThis.runWorklet(hydrated, []) as Promise<unknown>;
    env.switchToBackground();
    expect(onReport).toHaveBeenLastCalledWith('first', 2);
    env.switchToMainThread();
    await expect(next).resolves.toBe('first:2');
  });

  it('uses the latest closure and propagates clearing a Gesture to Native', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<FixtureModule>(fixturePath, {
      enableWorkletTransform: true,
      envManager: env,
    });
    const firstReport = vi.fn((label: string) => label);
    const nextReport = vi.fn((label: string) => label);
    const host = renderCompiledFixtureOnBackground(backgroundModule, env, { label: 'first', onReport: firstReport });
    renderCompiledFixtureOnMainThread(mainModule, env, { label: 'first', onReport: firstReport });
    env.switchToMainThread();
    env.switchToBackground();
    updates = [];
    renderCompiledFixtureOnBackground(backgroundModule, env, { label: 'second', onReport: nextReport });
    env.switchToMainThread();
    expect(updates.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setGesture,
      host!.instanceId,
      0,
      expect.objectContaining({ type: 'gesture' }),
    ]);
    const result = globalThis.runWorklet(callback(latestNativeGesture()!), []) as Promise<unknown>;
    env.switchToBackground();
    expect(nextReport).toHaveBeenCalledWith('second', 1);
    expect(firstReport).not.toHaveBeenCalled();
    env.switchToMainThread();
    await expect(result).resolves.toBe('second');
    env.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, env, { enabled: false, onReport: nextReport });
    env.switchToMainThread();
    expect(latestNativeGesture()).toBeNull();
    expect(updates.at(-1)?.ops).toEqual([ElementTemplateUpdateOps.setGesture, host!.instanceId, 0, null]);
  });
});
