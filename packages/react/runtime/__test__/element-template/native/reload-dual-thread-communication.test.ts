// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  registerBackgroundFunctionCtx,
  runOnBackground,
} from '../../../src/core/background-function/run-on-background.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../src/element-template/background/destroy.js';
import { getReloadVersion } from '../../../src/core/reload-version.js';
import { WorkletEvents } from '../../../src/worklet-runtime/bindings/events.js';
import { reloadMainThread } from '../../../src/element-template/native/reload-main-thread.js';
import { createElementTemplatePage, setupPage } from '../../../src/element-template/runtime/page/page.js';
import {
  __etAttrPlanMap,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  initializeMainThreadDynamicAttrSlots,
  attachMainThreadDynamicAttrRefsForSubtree,
} from '../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { reloadBackground } from '../../../src/element-template/native/reload-background.js';
import { resetElementTemplateMainThreadBackgroundFunctionRuntime } from '../../../src/element-template/runtime/template/main-thread-background-function.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

// ET ordinary reload retains the entry, but clears its background function table.
// Queue a real MTS request, reload before BTS delivery, then deliver the request.
describe('ElementTemplate dual-thread communication delivery across ordinary reload', () => {
  const env = new ElementTemplateEnvManager();
  afterEach(() => {
    env.switchToMainThread(() => resetElementTemplateMainThreadBackgroundFunctionRuntime());
    env.switchToBackground(() => destroyElementTemplateBackgroundRuntime());
    clearEtAttrPlanMap();
    vi.unstubAllGlobals();
  });
  it('stamps calls from old main-thread ref cleanup with the old version', () => {
    env.resetEnv('main');
    SystemInfo.lynxSdkVersion = '4.0';
    const page = createElementTemplatePage();
    setupPage(page);
    const oldVersion = getReloadVersion();
    const dispatch = vi.spyOn(lynx.getJSContext(), 'dispatchEvent');
    const cleanup = vi.fn(() => {
      void runOnBackground(Object.assign(() => {}, { _execId: 2, _jsFnId: 1 }))();
    });
    vi.stubGlobal('runWorklet', vi.fn(() => cleanup));
    __etAttrPlanMap._reload_dual_thread = [0, adaptMTRefAttrSlot];
    initializeMainThreadDynamicAttrSlots(-1, '_reload_dual_thread', [
      { type: 'main-thread-ref', value: { _wkltId: 'ref-cleanup' } },
    ]);
    attachMainThreadDynamicAttrRefsForSubtree([{ uid: -1, ref: page }]);

    reloadMainThread({}, { reloadTemplate: true });

    expect(cleanup).toHaveBeenCalledOnce();
    const request = dispatch.mock.calls.find(([event]) => event.type === WorkletEvents.runOnBackground)![0];
    expect(JSON.parse(request.data as string).reloadVersion).toBe(oldVersion);
    expect(getReloadVersion()).toBe(oldVersion + 1);
  });

  it.each([1, 2])('drops a stale request from %i retired contexts before looking up a function', async (ctxCount) => {
    env.resetEnv('background');
    SystemInfo.lynxSdkVersion = '4.0';
    const oldFn = vi.fn();
    let oldCtx;
    for (let i = 0; i < ctxCount; i++) {
      oldCtx = { _wkltId: 'ctx', _c: { fn: { _jsFnId: 1, _fn: oldFn } }, _execId: 0 };
      registerBackgroundFunctionCtx(oldCtx);
    }
    const oldId = oldCtx!._execId;
    env.switchToMainThread();
    void runOnBackground(Object.assign(() => {}, { _execId: oldId, _jsFnId: 1 }))();

    // The harness shares core modules across threads. Retire MTS resolvers first,
    // as its ordinary reload does, before exercising the real BTS reload below.
    resetElementTemplateMainThreadBackgroundFunctionRuntime();

    const freshFn = vi.fn(() => 'fresh');
    const freshCtx = { _wkltId: 'ctx', _c: { fn: { _jsFnId: 1, _fn: freshFn } }, _execId: 0 };
    expect(() =>
      env.switchToBackground(() => {
        reloadBackground({});
        registerBackgroundFunctionCtx(freshCtx);
      })
    ).not.toThrow();
    expect(freshCtx._execId).toBeGreaterThan(oldId);
    // A stale request must be dropped before looking up its retired context.
    expect(freshFn).not.toHaveBeenCalled();
    expect(oldFn).not.toHaveBeenCalled();

    env.switchToMainThread();
    lynx.getJSContext().dispatchEvent({ type: WorkletEvents.releaseBackgroundWorkletCtx, data: [oldId] });
    const result = runOnBackground(Object.assign(() => {}, { _execId: freshCtx._execId, _jsFnId: 1 }))();
    env.switchToBackground();
    env.switchToMainThread();
    await expect(result).resolves.toBe('fresh');
    expect(freshFn).toHaveBeenCalledOnce();
  });
});
