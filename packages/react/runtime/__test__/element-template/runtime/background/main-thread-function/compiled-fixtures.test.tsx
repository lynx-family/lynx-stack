// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../../src/element-template/background/hydration-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../../src/element-template/protocol/update-event.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { resetElementTemplateMainThreadFunctionRuntime } from '../../../../../src/element-template/runtime/template/main-thread-function.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../../src/element-template/native/patch-listener.js';
import { initWorklet } from '../../../../../src/worklet-runtime/workletRuntime.js';
import { compileFixtureSource } from '../../../test-utils/debug/compiledFixtureCompiler.js';
import {
  loadCompiledFixturePair,
  type CompiledFixtureModuleExports,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/main-thread-function/run-on-main-thread/index.tsx',
);

interface CompiledRunOnMainThreadModule extends CompiledFixtureModuleExports {
  App: (props: { label?: string; source?: string }) => JSX.Element;
  callMainDirect: (label?: string) => Promise<string>;
  lastRenderPromise?: Promise<string>;
}

function getLastUpdate(events: ElementTemplateUpdateCommitContext[]): ElementTemplateUpdateCommitContext {
  const event = events.at(-1);
  if (!event) {
    throw new Error('Missing ElementTemplate update payload.');
  }
  return event;
}

function findRunWorkletCtxPayload(
  dispatchSpy: ReturnType<typeof rstest.spyOn>,
): { params: unknown[]; resolveId: number; worklet: { _wkltId?: string } } {
  const event = dispatchSpy.mock.calls
    .map(([payload]) => payload as { type?: string; data?: unknown })
    .find(payload => payload.type === WorkletEvents.runWorkletCtx);
  if (!event) {
    throw new Error('Missing runWorkletCtx dispatch.');
  }
  return JSON.parse(event.data as string) as {
    params: unknown[];
    resolveId: number;
    worklet: { _wkltId?: string };
  };
}

function hasRunWorkletCtxDispatch(dispatchSpy: ReturnType<typeof rstest.spyOn>): boolean {
  return dispatchSpy.mock.calls.some(([payload]) =>
    (payload as { type?: string }).type === WorkletEvents.runWorkletCtx
  );
}

describe('Compiled runOnMainThread background fixtures', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
  };

  beforeEach(() => {
    rstest.clearAllMocks();
    SystemInfo.lynxSdkVersion = '4.0';
    updateEvents = [];
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

    rstest.stubGlobal(
      '__LoadLepusChunk',
      rstest.fn().mockImplementation(() => {
        initWorklet();
        return true;
      }),
    );

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    resetElementTemplatePatchListener();
    envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
    resetElementTemplateMainThreadFunctionRuntime();
    clearEtAttrPlanMap();
    envManager.setUseElementTemplate(false);

    delete globalThis.lynxWorkletImpl;
    // @ts-expect-error - test cleanup restores the worklet runtime globals.
    delete globalThis.registerWorklet;
    // @ts-expect-error - test cleanup restores the worklet runtime globals.
    delete globalThis.registerWorkletInternal;
    // @ts-expect-error - test cleanup restores the worklet runtime globals.
    delete globalThis.runWorklet;
    // @ts-expect-error - test cleanup restores the native loader global.
    delete globalThis.__LoadLepusChunk;
  });

  async function loadFixture(): Promise<{
    backgroundModule: CompiledRunOnMainThreadModule;
    mainModule: CompiledRunOnMainThreadModule;
  }> {
    return loadCompiledFixturePair<CompiledRunOnMainThreadModule>(
      FIXTURE,
      { enableWorkletTransform: true },
    );
  }

  async function hydrateFixture(
    backgroundModule: CompiledRunOnMainThreadModule,
    mainModule: CompiledRunOnMainThreadModule,
  ): Promise<void> {
    renderCompiledFixtureOnBackground(backgroundModule, envManager, {
      label: 'first',
      source: 'hydrate',
    });
    renderCompiledFixtureOnMainThread(mainModule, envManager, {
      label: 'first',
      source: 'hydrate',
    });
    envManager.switchToMainThread();
    envManager.switchToBackground();
    await expect(backgroundModule.lastRenderPromise).resolves.toBe('main:hydrate:first');
  }

  it('compiles through the ET alias without Snapshot internals', async () => {
    const mainArtifact = await compileFixtureSource(FIXTURE, {
      enableWorkletTransform: true,
      target: 'LEPUS',
    });
    const backgroundArtifact = await compileFixtureSource(FIXTURE, {
      enableWorkletTransform: true,
      target: 'JS',
    });

    expect(backgroundArtifact.code).toContain('runOnMainThread');
    expect(backgroundArtifact.code).toContain('from \'@lynx-js/react\'');
    expect(backgroundArtifact.code).not.toContain('snapshot/');
    expect(backgroundArtifact.code).not.toContain('__globalSnapshotPatch');
    expect(backgroundArtifact.code).not.toContain('PatchList');
    expect(backgroundArtifact.code).not.toContain('isRendering');
    expect(mainArtifact.code).toContain('loadWorkletRuntime');
    expect(mainArtifact.code).toContain('registerWorkletInternal("main-thread"');
    expect(mainArtifact.code).not.toContain('snapshot/');
  });

  it('delivers pre-hydrate compiled render calls through delayed-only hydrate payloads', async () => {
    const { backgroundModule, mainModule } = await loadFixture();
    const dispatchSpy = rstest.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    renderCompiledFixtureOnBackground(backgroundModule, envManager, {
      label: 'first',
      source: 'hydrate',
    });

    expect(hasRunWorkletCtxDispatch(dispatchSpy)).toBe(false);
    const hydratePromise = backgroundModule.lastRenderPromise;
    if (!hydratePromise) {
      throw new Error('Missing pre-hydrate runOnMainThread Promise.');
    }

    renderCompiledFixtureOnMainThread(mainModule, envManager, {
      label: 'first',
      source: 'hydrate',
    });

    envManager.switchToMainThread();
    const hydratePayload = getLastUpdate(updateEvents);
    expect(hydratePayload).toMatchObject({
      isHydration: true,
      ops: [],
      delayedRunOnMainThreadData: [
        {
          params: ['hydrate:first'],
          resolveId: expect.any(Number),
          worklet: { _wkltId: expect.any(String) },
        },
      ],
    });
    envManager.switchToBackground();

    await expect(hydratePromise).resolves.toBe('main:hydrate:first');
  });

  it('keeps post-hydration compiled render calls on the delayed update path', async () => {
    const { backgroundModule, mainModule } = await loadFixture();

    await hydrateFixture(backgroundModule, mainModule);
    updateEvents = [];
    const dispatchSpy = rstest.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    renderCompiledFixtureOnBackground(backgroundModule, envManager, {
      label: 'second',
      source: 'update',
    });

    expect(hasRunWorkletCtxDispatch(dispatchSpy)).toBe(false);
    const updatePromise = backgroundModule.lastRenderPromise;
    if (!updatePromise) {
      throw new Error('Missing post-hydration runOnMainThread Promise.');
    }

    envManager.switchToMainThread();
    const updatePayload = getLastUpdate(updateEvents);
    expect(updatePayload.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      expect.any(Number),
      0,
      'second',
    ]);
    expect(updatePayload.delayedRunOnMainThreadData).toEqual([
      expect.objectContaining({
        params: ['update:second'],
        resolveId: expect.any(Number),
        worklet: expect.objectContaining({ _wkltId: expect.any(String) }),
      }),
    ]);
    envManager.switchToBackground();

    await expect(updatePromise).resolves.toBe('main:update:second');
  });

  it('dispatches post-hydration compiled calls made outside render directly', async () => {
    const { backgroundModule, mainModule } = await loadFixture();

    await hydrateFixture(backgroundModule, mainModule);
    const dispatchSpy = rstest.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    const directPromise = backgroundModule.callMainDirect('ready');
    const data = findRunWorkletCtxPayload(dispatchSpy);
    expect(data).toMatchObject({
      params: ['direct:ready'],
      resolveId: expect.any(Number),
      worklet: { _wkltId: expect.any(String) },
    });

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({
        resolveId: data.resolveId,
        returnValue: 'main:direct:ready',
      }),
    });
    envManager.switchToBackground();

    await expect(directPromise).resolves.toBe('main:direct:ready');
  });
});
