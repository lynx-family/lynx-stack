import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../../src/element-template/background/hydration-listener.js';
import {
  collectElementTemplateSubtreeHandleIds,
  BackgroundElementTemplateInstance,
} from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';
import {
  clearEventState,
  getEventHandlerForEventValue,
  publishEvent,
} from '../../../../../src/element-template/prop-adapters/event.js';
import { isMTEventNativeWrapper } from '../../../../../src/element-template/runtime/template/main-thread-event-ctx.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
} from '../../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
  SerializableValue,
} from '../../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../../src/element-template/protocol/update-event.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { lastMock } from '../../../test-utils/mock/mockNativePapi.js';
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
import { serializeBackgroundTree } from '../../../test-utils/debug/serializer.js';
import { initWorklet } from '../../../../../src/worklet-runtime/workletRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_EVENT_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/event/direct-event/index.tsx');
const CONDITIONAL_DIRECT_EVENT_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/event/conditional-direct-event/index.tsx',
);
const MAIN_THREAD_DIRECT_EVENT_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/event/main-thread-direct-event/index.tsx',
);
const MAIN_THREAD_RUN_ON_BACKGROUND_EVENT_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/event/main-thread-run-on-background-event/index.tsx',
);
const SPREAD_EVENT_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/event/spread-event/index.tsx');
const SLOT_ID = 0;

interface CompiledDirectEventModule extends CompiledFixtureModuleExports {
  App: (props: { onTap?: () => void }) => JSX.Element;
}

interface CompiledConditionalDirectEventModule extends CompiledFixtureModuleExports {
  App: (props: { show?: boolean; onTap?: () => void }) => JSX.Element;
}

interface CompiledMainThreadDirectEventModule extends CompiledFixtureModuleExports {
  App: (props: { label?: string }) => JSX.Element;
}

interface CompiledMainThreadRunOnBackgroundEventModule extends CompiledFixtureModuleExports {
  App: (props: { label?: string; onReport?: (label: string) => string }) => JSX.Element;
}

interface SpreadFixtureProps {
  id?: string;
  className?: string;
  bindtap?: () => void;
}

interface CompiledSpreadEventModule extends CompiledFixtureModuleExports {
  App: (props: {
    spread?: SpreadFixtureProps;
    onCatch?: () => void;
    showChild?: boolean;
    childSpread?: SpreadFixtureProps;
  }) => JSX.Element;
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = (__root as BackgroundElementTemplateInstance).firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

function getSlotChildAt(
  index: number,
  host = getRenderedHost(),
): BackgroundElementTemplateInstance {
  const child = host.elementSlots[SLOT_ID]?.[index];
  if (!child) {
    throw new Error(`Missing slot child at ${index}.\n${serializeBackgroundTree(host)}`);
  }
  return child;
}

function collectRecursiveCreateCommandStream(
  instance: BackgroundElementTemplateInstance,
): ElementTemplateUpdateCommandStream {
  const commands: ElementTemplateUpdateCommandStream = [];
  for (const slotChildren of instance.elementSlots) {
    for (const child of slotChildren ?? []) {
      commands.push(...collectRecursiveCreateCommandStream(child));
    }
  }
  commands.push(
    ElementTemplateUpdateOps.createTemplate,
    instance.instanceId,
    instance.type,
    null,
    instance.attributeSlots,
    instance.elementSlots.map(children => (children ?? []).map(child => child.instanceId)),
  );
  return commands;
}

function expectMTEventWrapper(value: unknown): { _c?: Record<string, unknown>; _wkltId: string } {
  expect(isMTEventNativeWrapper(value)).toBe(true);
  return (value as { type: 'worklet'; value: { _c?: Record<string, unknown>; _wkltId: string } }).value;
}

function findJsFnHandle(value: unknown): {
  _execId?: number;
  _fn?: (...args: unknown[]) => unknown;
  _isFirstScreen?: boolean;
  _jsFnId?: number;
} | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if ('_fn' in record || '_isFirstScreen' in record || '_jsFnId' in record) {
    return record as {
      _execId?: number;
      _fn?: (...args: unknown[]) => unknown;
      _isFirstScreen?: boolean;
      _jsFnId?: number;
    };
  }

  for (const key of Object.keys(record)) {
    const result = findJsFnHandle(record[key]);
    if (result) {
      return result;
    }
  }

  return undefined;
}

function findFirstNativeCreateAttrSlots(): unknown[] {
  const createLog = lastMock!.nativeLog.find((entry) =>
    Array.isArray(entry)
    && entry[0] === '__CreateElementTemplate'
    && entry[1] !== '_et_builtin_raw_text'
  ) as unknown[] | undefined;
  const attributeSlots = createLog?.[3];
  if (!Array.isArray(attributeSlots)) {
    throw new Error('Missing compiled main-thread create attribute slots.');
  }
  return attributeSlots;
}

function findLastNativeSetAttributeValue(): unknown {
  const setAttributeLog = lastMock!.nativeLog.findLast((entry) =>
    Array.isArray(entry)
    && entry[0] === '__SetAttributeOfElementTemplate'
  ) as unknown[] | undefined;
  if (!setAttributeLog) {
    throw new Error('Missing compiled main-thread setAttribute call.');
  }
  return setAttributeLog[3];
}

function installMockWorkletRuntime(hydrateCtx = rstest.fn()): {
  hydrateCtx: ReturnType<typeof rstest.fn>;
  loadLepusChunk: ReturnType<typeof rstest.fn>;
} {
  const loadLepusChunk = rstest.fn().mockImplementation(() => {
    globalThis.lynxWorkletImpl = {
      _workletMap: {},
      _eventDelayImpl: {
        clearDelayedWorklets: rstest.fn(),
        runDelayedWorklet: rstest.fn(),
      },
      _refImpl: {
        _firstScreenWorkletRefMap: new Map(),
        _workletRefMap: {},
        clearFirstScreenWorkletRefMap: rstest.fn(),
        updateWorkletRef: rstest.fn(),
        updateWorkletRefInitValueChanges: rstest.fn(),
      },
      _runOnBackgroundDelayImpl: {
        delayRunOnBackground: rstest.fn(),
        runDelayedBackgroundFunctions: rstest.fn(),
      },
      _hydrateCtx: hydrateCtx,
      _eomImpl: {
        setShouldFlush: rstest.fn(),
      },
      _runRunOnMainThreadTask: rstest.fn(),
    };
    globalThis.registerWorkletInternal = (_type, id, worklet) => {
      globalThis.lynxWorkletImpl._workletMap[id] = worklet;
    };
    return true;
  });
  rstest.stubGlobal('__LoadLepusChunk', loadLepusChunk);
  return { hydrateCtx, loadLepusChunk };
}

function installRealWorkletRuntime(): {
  loadLepusChunk: ReturnType<typeof rstest.fn>;
} {
  const loadLepusChunk = rstest.fn().mockImplementation(() => {
    initWorklet();
    return true;
  });
  rstest.stubGlobal('__LoadLepusChunk', loadLepusChunk);
  return { loadLepusChunk };
}

describe('Compiled direct event background updates', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  let originalLynxSdkVersion: string | undefined;
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
  };

  async function loadCompiledDirectEventFixture(): Promise<{
    backgroundModule: CompiledDirectEventModule;
    mainModule: CompiledDirectEventModule;
  }> {
    return loadCompiledFixturePair<CompiledDirectEventModule>(DIRECT_EVENT_FIXTURE);
  }

  async function loadCompiledConditionalDirectEventFixture(): Promise<{
    backgroundModule: CompiledConditionalDirectEventModule;
    mainModule: CompiledConditionalDirectEventModule;
  }> {
    return loadCompiledFixturePair<CompiledConditionalDirectEventModule>(
      CONDITIONAL_DIRECT_EVENT_FIXTURE,
    );
  }

  async function loadCompiledSpreadEventFixture(): Promise<{
    backgroundModule: CompiledSpreadEventModule;
    mainModule: CompiledSpreadEventModule;
  }> {
    return loadCompiledFixturePair<CompiledSpreadEventModule>(SPREAD_EVENT_FIXTURE);
  }

  async function loadCompiledMainThreadDirectEventFixture(): Promise<{
    backgroundModule: CompiledMainThreadDirectEventModule;
    mainModule: CompiledMainThreadDirectEventModule;
  }> {
    return loadCompiledFixturePair<CompiledMainThreadDirectEventModule>(
      MAIN_THREAD_DIRECT_EVENT_FIXTURE,
      { enableWorkletTransform: true },
    );
  }

  async function loadCompiledMainThreadRunOnBackgroundEventFixture(): Promise<{
    backgroundModule: CompiledMainThreadRunOnBackgroundEventModule;
    mainModule: CompiledMainThreadRunOnBackgroundEventModule;
  }> {
    return loadCompiledFixturePair<CompiledMainThreadRunOnBackgroundEventModule>(
      MAIN_THREAD_RUN_ON_BACKGROUND_EVENT_FIXTURE,
      { enableWorkletTransform: true },
    );
  }

  function renderDirectEventOnBackground(
    moduleExports: CompiledDirectEventModule,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = renderCompiledFixtureOnBackground(moduleExports, envManager, { onTap });
    if (!host) {
      throw new Error('Missing rendered host.');
    }
    return host;
  }

  function hydrateDirectEventFromMainThread(
    moduleExports: CompiledDirectEventModule,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();
    renderCompiledFixtureOnMainThread(moduleExports, envManager, { onTap });
    return host;
  }

  function renderSpreadEventOnBackground(
    moduleExports: CompiledSpreadEventModule,
    spread: SpreadFixtureProps | undefined,
    onCatch?: () => void,
    childOptions?: {
      showChild?: boolean;
      childSpread?: SpreadFixtureProps;
    },
  ): BackgroundElementTemplateInstance {
    const host = renderCompiledFixtureOnBackground(moduleExports, envManager, {
      spread,
      onCatch,
      ...childOptions,
    });
    if (!host) {
      throw new Error('Missing rendered host.');
    }
    return host;
  }

  function hydrateSpreadEventFromMainThread(
    moduleExports: CompiledSpreadEventModule,
    spread: SpreadFixtureProps | undefined,
    onCatch?: () => void,
    childOptions?: {
      showChild?: boolean;
      childSpread?: SpreadFixtureProps;
    },
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();
    renderCompiledFixtureOnMainThread(moduleExports, envManager, {
      spread,
      onCatch,
      ...childOptions,
    });
    return host;
  }

  function renderConditionalDirectEventOnBackground(
    moduleExports: CompiledConditionalDirectEventModule,
    show: boolean,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = renderCompiledFixtureOnBackground(moduleExports, envManager, { show, onTap });
    if (!host) {
      throw new Error('Missing rendered host.');
    }
    return host;
  }

  function hydrateConditionalDirectEventFromMainThread(
    moduleExports: CompiledConditionalDirectEventModule,
    show: boolean,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();
    renderCompiledFixtureOnMainThread(moduleExports, envManager, { show, onTap });
    return host;
  }

  beforeEach(() => {
    rstest.clearAllMocks();
    originalLynxSdkVersion = SystemInfo.lynxSdkVersion;
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
    clearEventState();
    clearMainThreadDynamicAttrState();
    updateEvents = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

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
    envManager.setUseElementTemplate(false);
    clearMainThreadDynamicAttrState();
    SystemInfo.lynxSdkVersion = originalLynxSdkVersion;
    delete globalThis.lynxWorkletImpl;
    // @ts-expect-error - tests that install the real runtime restore this global.
    delete globalThis.registerWorklet;
    // @ts-expect-error - test cleanup restores the runtime loader global.
    delete globalThis.registerWorkletInternal;
    // @ts-expect-error - tests that install the real runtime restore this global.
    delete globalThis.runWorklet;
    // @ts-expect-error - test cleanup restores the native loader global.
    delete globalThis.__LoadLepusChunk;
    // @ts-expect-error - dynamic component tests install this runtime global.
    delete globalThis.globDynamicComponentEntry;
  });

  it('hydrates and updates compiled direct main-thread events through native MTEvent slots', async () => {
    const mainArtifact = await compileFixtureSource(MAIN_THREAD_DIRECT_EVENT_FIXTURE, {
      enableWorkletTransform: true,
      target: 'LEPUS',
    });
    expect(mainArtifact.code).toContain('from "@lynx-js/react/internal"');
    expect(mainArtifact.code).toContain('loadWorkletRuntime');
    expect(mainArtifact.code).toContain('adaptMTEventAttrSlot');
    expect(mainArtifact.code).not.toContain('registerWorkletOnBackground');
    expect(mainArtifact.code).not.toContain('transformToWorklet');

    const hydrateCtx = rstest.fn();
    const { loadLepusChunk } = installMockWorkletRuntime(hydrateCtx);

    const { backgroundModule, mainModule } = await loadCompiledMainThreadDirectEventFixture();
    expect(loadLepusChunk).toHaveBeenCalledWith('worklet-runtime', {
      dynamicComponentEntry: '__Card__',
      chunkType: 0,
    });
    expect(Object.keys(globalThis.lynxWorkletImpl._workletMap)).toHaveLength(1);

    const host = renderCompiledFixtureOnBackground(backgroundModule, envManager, { label: 'first' });
    renderCompiledFixtureOnMainThread(mainModule, envManager, { label: 'first' });

    const firstScreenWrapper = findFirstNativeCreateAttrSlots()[0];
    const firstScreenCtx = expectMTEventWrapper(firstScreenWrapper);
    expect(firstScreenCtx._c).toEqual({ label: 'first' });
    expect(typeof firstScreenWrapper).toBe('object');
    expect(typeof firstScreenWrapper).not.toBe('function');
    expect(host.attributeSlots[0]).toEqual(firstScreenWrapper);
    expect(getMainThreadDynamicAttrState(host.instanceId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: firstScreenCtx,
    });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.isHydration).toBe(true);
    const hydrateWrapper = findLastNativeSetAttributeValue();
    const hydratedCtx = expectMTEventWrapper(hydrateWrapper);
    expect(hydratedCtx._c).toEqual({ label: 'first' });
    expect(hydrateWrapper).not.toBe(firstScreenWrapper);
    expect(hydrateCtx).toHaveBeenCalledWith(hydratedCtx, firstScreenCtx);
    expect(getMainThreadDynamicAttrState(host.instanceId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: hydratedCtx as SerializableValue,
    });

    updateEvents = [];
    lastMock!.mockSetAttributeOfElementTemplate.mockClear();
    envManager.switchToBackground();
    renderCompiledFixtureOnBackground(backgroundModule, envManager, { label: 'second' });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.isHydration).toBeUndefined();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      expect.objectContaining({
        type: 'worklet',
        value: expect.objectContaining({
          _c: { label: 'second' },
          _wkltId: hydratedCtx._wkltId,
        }),
      }),
    ]);
    const updatedWrapper = findLastNativeSetAttributeValue();
    const updatedCtx = expectMTEventWrapper(updatedWrapper);
    expect(updatedCtx).not.toBe(hydratedCtx);
    expect(updatedCtx._c).toEqual({ label: 'second' });
    expect(hydrateCtx).toHaveBeenCalledTimes(1);
    expect(getMainThreadDynamicAttrState(host.instanceId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: updatedCtx as SerializableValue,
    });
  });

  it('hydrates compiled direct main-thread events with serialized runOnBackground handles', async () => {
    SystemInfo.lynxSdkVersion = '4.0';
    const mainArtifact = await compileFixtureSource(MAIN_THREAD_RUN_ON_BACKGROUND_EVENT_FIXTURE, {
      enableWorkletTransform: true,
      target: 'LEPUS',
    });
    const backgroundArtifact = await compileFixtureSource(MAIN_THREAD_RUN_ON_BACKGROUND_EVENT_FIXTURE, {
      enableWorkletTransform: true,
      target: 'JS',
    });
    expect(mainArtifact.code).toContain('from "@lynx-js/react/internal"');
    expect(mainArtifact.code).toContain('loadWorkletRuntime');
    expect(mainArtifact.code).toContain('runOnBackground');
    expect(backgroundArtifact.code).toContain('transformToWorklet');

    const { loadLepusChunk } = installRealWorkletRuntime();
    const { backgroundModule, mainModule } = await loadCompiledMainThreadRunOnBackgroundEventFixture();
    expect(loadLepusChunk).toHaveBeenCalledWith('worklet-runtime', {
      dynamicComponentEntry: undefined,
      chunkType: 0,
    });
    const onReport = rstest.fn((label: string) => `reported:${label}`);
    const host = renderCompiledFixtureOnBackground(backgroundModule, envManager, { label: 'first', onReport });
    renderCompiledFixtureOnMainThread(mainModule, envManager, { label: 'first', onReport });

    const rawCtx = host.getRawAttributeSlot(0) as {
      _c?: Record<string, unknown>;
      _execId?: number;
      _wkltId: string;
    };
    const backgroundCtx = expectMTEventWrapper(host.attributeSlots[0]);
    const firstScreenCtx = expectMTEventWrapper(findFirstNativeCreateAttrSlots()[0]);
    const backgroundHandle = findJsFnHandle(backgroundCtx);
    const rawHandle = findJsFnHandle(rawCtx);
    const firstScreenHandle = findJsFnHandle(firstScreenCtx);

    expect(rawCtx).not.toBe(backgroundCtx);
    expect(backgroundCtx._c).toEqual(expect.objectContaining({ label: 'first' }));
    expect(backgroundHandle).toBe(rawHandle);
    expect(backgroundHandle?._fn).toBe(onReport);
    expect(rawHandle?._fn).toBe(onReport);
    expect(firstScreenHandle?._isFirstScreen).toBe(true);
    expect(backgroundCtx).toHaveProperty('_execId');
    expect(rawCtx).not.toHaveProperty('_execId');
    expect(rawHandle).not.toHaveProperty('_execId');

    let delayedResult: Promise<unknown> | undefined;
    envManager.switchToMainThread(() => {
      delayedResult = globalThis.runWorklet(firstScreenCtx, []) as Promise<unknown>;
      expect(onReport).not.toHaveBeenCalled();
      expect(
        globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
          .delayedBackgroundFunctionArray.length,
      ).toBe(1);
    });
    const hydrateWrapper = findLastNativeSetAttributeValue();
    const hydratedCtx = expectMTEventWrapper(hydrateWrapper);
    const hydratedHandle = findJsFnHandle(hydratedCtx);

    expect(hydratedCtx).not.toBe(backgroundCtx);
    expect(hydratedCtx).toEqual(expect.objectContaining({
      _c: expect.objectContaining({ label: 'first' }),
      _execId: backgroundCtx._execId,
      _wkltId: backgroundCtx._wkltId,
    }));
    expect(hydratedHandle?._fn).toBe('[BackgroundFunction]');
    expect(hydratedHandle?._jsFnId).toBe(backgroundHandle?._jsFnId);
    expect(hydratedHandle?._execId).toBe(backgroundCtx._execId);
    expect(
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl
        .delayedBackgroundFunctionArray.length,
    ).toBe(0);
    expect(rawHandle).not.toHaveProperty('_execId');

    envManager.switchToBackground();
    expect(onReport).toHaveBeenCalledWith('first');

    envManager.switchToMainThread();
    await expect(delayedResult).resolves.toBe('reported:first');
  });

  it('records dynamic-entry compiled direct main-thread event state on first-screen create', async () => {
    globalThis.globDynamicComponentEntry = 'lazy-entry';
    installMockWorkletRuntime();

    const { backgroundModule, mainModule } = await loadCompiledFixturePair<CompiledMainThreadDirectEventModule>(
      MAIN_THREAD_DIRECT_EVENT_FIXTURE,
      {
        enableWorkletTransform: true,
        isDynamicComponent: true,
      },
    );

    const host = renderCompiledFixtureOnBackground(backgroundModule, envManager, { label: 'dynamic' });
    renderCompiledFixtureOnMainThread(mainModule, envManager, { label: 'dynamic' });

    const createLog = lastMock!.nativeLog.find((entry) =>
      Array.isArray(entry)
      && entry[0] === '__CreateElementTemplate'
      && entry[1] !== '_et_builtin_raw_text'
    ) as unknown[] | undefined;
    expect(createLog?.[1]).toMatch(/^_et_[0-9a-f]{12}$/);
    expect(createLog?.[2]).toBe('lazy-entry');
    const firstScreenCtx = expectMTEventWrapper(findFirstNativeCreateAttrSlots()[0]);
    expect(firstScreenCtx._c).toEqual({ label: 'dynamic' });
    expect(getMainThreadDynamicAttrState(host.instanceId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: firstScreenCtx as SerializableValue,
    });
  });

  it('uses the latest background handler without dispatching a native patch when only handler identity changes', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const firstHandler = rstest.fn();
    const secondHandler = rstest.fn();

    const host = renderDirectEventOnBackground(backgroundModule, firstHandler);
    hydrateDirectEventFromMainThread(mainModule, firstHandler);
    envManager.switchToMainThread();
    updateEvents = [];
    envManager.switchToBackground();

    renderDirectEventOnBackground(backgroundModule, secondHandler);

    const eventValue = `${host.instanceId}:0:`;
    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(secondHandler);
  });

  it('uses ordinary setAttribute patches when direct event handlers are added or removed', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const handler = rstest.fn();

    const host = renderDirectEventOnBackground(backgroundModule);
    hydrateDirectEventFromMainThread(mainModule);
    updateEvents = [];

    renderDirectEventOnBackground(backgroundModule, handler);

    const eventValue = `${host.instanceId}:0:`;
    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      eventValue,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

    updateEvents = [];
    renderDirectEventOnBackground(backgroundModule);

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      null,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([null]);
    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('dispatches native event values to the latest hydrated direct event handler', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const firstHandler = rstest.fn();
    const secondHandler = rstest.fn();

    const host = renderDirectEventOnBackground(backgroundModule, firstHandler);
    hydrateDirectEventFromMainThread(mainModule, firstHandler);
    const eventValue = `${host.instanceId}:0:`;

    publishEvent(eventValue, { type: 'tap', phase: 'first' });

    renderDirectEventOnBackground(backgroundModule, secondHandler);
    publishEvent(eventValue, { type: 'tap', phase: 'second' });

    expect(firstHandler).toHaveBeenCalledWith({ type: 'tap', phase: 'first' });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledWith({ type: 'tap', phase: 'second' });
  });

  it('hydrates compiled spread attrs and dispatches direct plus spread event values independently', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = rstest.fn();
    const handleDirectCatch = rstest.fn();

    const host = renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    hydrateSpreadEventFromMainThread(
      mainModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );

    const directEventValue = `${host.instanceId}:0:`;
    const spreadEventValue = `${host.instanceId}:1:bindtap`;
    const preparedSpread = { id: 'cta', class: 'primary', bindtap: spreadEventValue };
    expect(host.attributeSlots).toEqual([directEventValue, preparedSpread]);
    expect(getEventHandlerForEventValue(directEventValue)).toBe(handleDirectCatch);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);

    publishEvent(directEventValue, { type: 'tap', source: 'direct' });
    publishEvent(spreadEventValue, { type: 'tap', source: 'spread' });

    expect(handleDirectCatch).toHaveBeenCalledWith({ type: 'tap', source: 'direct' });
    expect(handleSpreadTap).toHaveBeenCalledWith({ type: 'tap', source: 'spread' });
  });

  it('updates compiled spread plain attrs through a whole-slot setAttribute patch', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = rstest.fn();
    const handleDirectCatch = rstest.fn();

    const host = renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    hydrateSpreadEventFromMainThread(
      mainModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    updateEvents = [];

    renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta-next', className: 'secondary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );

    const spreadEventValue = `${host.instanceId}:1:bindtap`;
    const preparedSpread = { id: 'cta-next', class: 'secondary', bindtap: spreadEventValue };
    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      1,
      preparedSpread,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([`${host.instanceId}:0:`, preparedSpread]);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);
  });

  it('registers and dispatches spread events on inserted compiled subtrees', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = rstest.fn();

    const host = renderSpreadEventOnBackground(backgroundModule, undefined, undefined, {
      showChild: false,
    });
    hydrateSpreadEventFromMainThread(mainModule, undefined, undefined, { showChild: false });
    updateEvents = [];

    renderSpreadEventOnBackground(backgroundModule, undefined, undefined, {
      showChild: true,
      childSpread: { id: 'inserted', bindtap: handleSpreadTap },
    });
    const inserted = getSlotChildAt(0, host);
    const spreadEventValue = `${inserted.instanceId}:0:bindtap`;
    const preparedSpread = { id: 'inserted', bindtap: spreadEventValue };

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ...collectRecursiveCreateCommandStream(inserted),
      ElementTemplateUpdateOps.insertNode,
      host.instanceId,
      SLOT_ID,
      inserted.instanceId,
      0,
    ]);
    envManager.switchToBackground();
    expect(inserted.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);

    publishEvent(spreadEventValue, { type: 'tap', source: 'inserted-spread' });

    expect(handleSpreadTap).toHaveBeenCalledWith({ type: 'tap', source: 'inserted-spread' });
  });

  it('registers and dispatches direct events on inserted compiled subtrees', async () => {
    const { backgroundModule, mainModule } = await loadCompiledConditionalDirectEventFixture();
    const handler = rstest.fn();

    const host = renderConditionalDirectEventOnBackground(backgroundModule, false);
    hydrateConditionalDirectEventFromMainThread(mainModule, false);
    updateEvents = [];

    renderConditionalDirectEventOnBackground(backgroundModule, true, handler);
    const inserted = getSlotChildAt(0, host);
    const eventValue = `${inserted.instanceId}:0:`;

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ...collectRecursiveCreateCommandStream(inserted),
      ElementTemplateUpdateOps.insertNode,
      host.instanceId,
      SLOT_ID,
      inserted.instanceId,
      0,
    ]);
    envManager.switchToBackground();
    expect(inserted.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

    publishEvent(eventValue, { type: 'tap', phase: 'inserted' });

    expect(handler).toHaveBeenCalledWith({ type: 'tap', phase: 'inserted' });
  });

  it('cleans direct event handlers when compiled subtrees are removed', async () => {
    const { backgroundModule, mainModule } = await loadCompiledConditionalDirectEventFixture();
    const handler = rstest.fn();

    const host = renderConditionalDirectEventOnBackground(backgroundModule, true, handler);
    hydrateConditionalDirectEventFromMainThread(mainModule, true, handler);
    const removed = getSlotChildAt(0, host);
    const removedSubtreeHandleIds = collectElementTemplateSubtreeHandleIds(removed);
    const eventValue = `${removed.instanceId}:0:`;
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);
    updateEvents = [];

    rstest.useFakeTimers();
    try {
      renderConditionalDirectEventOnBackground(backgroundModule, false);

      envManager.switchToMainThread();
      expect(updateEvents.at(-1)?.ops).toEqual([
        ElementTemplateUpdateOps.removeNode,
        host.instanceId,
        SLOT_ID,
        removed.instanceId,
        removedSubtreeHandleIds,
      ]);
      envManager.switchToBackground();
      expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

      rstest.advanceTimersByTime(10000);

      expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBeUndefined();
      expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
      publishEvent(eventValue, { type: 'tap', phase: 'removed' });
      expect(handler).not.toHaveBeenCalledWith({ type: 'tap', phase: 'removed' });
    } finally {
      rstest.useRealTimers();
    }
  });
});
