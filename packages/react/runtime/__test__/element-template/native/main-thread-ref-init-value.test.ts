import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainThreadRef, clearMainThreadRefLastIdForTesting } from '../../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../../src/core/mts-capability.js';
import { increaseReloadVersion } from '../../../src/core/reload-version.js';
import {
  installElementTemplateRefInitValueListener,
  resetElementTemplateRefInitValueListener,
  sendMTRefInitValueToMainThread,
} from '../../../src/element-template/main-thread-ref-init-value.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../src/element-template/native/patch-listener.js';
import { destroyElementTemplateMainThreadRuntime } from '../../../src/element-template/native/mts-destroy.js';
import { ElementTemplateLifecycleConstant } from '../../../src/element-template/protocol/lifecycle-constant.js';
import { getFromWorkletRefMap, initWorkletRef } from '../../../src/worklet-runtime/workletRef.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

describe('ElementTemplate ref initialization event', () => {
  const env = new ElementTemplateEnvManager();
  let previousImpl: typeof globalThis.lynxWorkletImpl;
  let previousSdkVersion: string;

  beforeEach(() => {
    env.resetEnv('background');
    previousSdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.0';
    clearMtsConfigCacheForTesting();
    clearMainThreadRefLastIdForTesting();
    takeMainThreadRefInitValuePatch();
    previousImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = { ...previousImpl, _refImpl: initWorkletRef() };
  });

  afterEach(() => {
    env.switchToMainThread();
    resetElementTemplateRefInitValueListener();
    globalThis.lynxWorkletImpl = previousImpl;
    SystemInfo.lynxSdkVersion = previousSdkVersion;
    clearMtsConfigCacheForTesting();
    takeMainThreadRefInitValuePatch();
    vi.unstubAllGlobals();
  });

  it.each([true, false, undefined])('initializes a retained ref after reload (alog: %s)', (alog) => {
    vi.stubGlobal('__ALOG__', alog);
    const log = vi.spyOn(console, 'alog');
    env.switchToMainThread();
    installElementTemplateRefInitValueListener();
    env.switchToBackground();
    const ref = new MainThreadRef(233);
    const handle = JSON.parse(JSON.stringify(ref));
    sendMTRefInitValueToMainThread();
    // Advance after BTS sent the event, before MTS receives it.
    increaseReloadVersion();
    env.switchToMainThread();
    expect(getFromWorkletRefMap(handle)).toMatchObject({ current: 233 });
    if (alog) {
      expect(log).toHaveBeenCalledWith('[ReactLynxDebug] ElementTemplate BTS -> MTS sendMTRefInitValue:\n[[1,233]]');
      expect(log).toHaveBeenCalledWith('[ReactLynxDebug] ElementTemplate MTS updateMTRefInitValue:\n[[1,233]]');
    } else {
      expect(log.mock.calls.some(([message]) => String(message).includes('MTRefInitValue'))).toBe(false);
    }
  });

  it('does not send an empty queue or resend initialization', () => {
    const dispatch = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    sendMTRefInitValueToMainThread();
    expect(dispatch).not.toHaveBeenCalled();
    new MainThreadRef('once');
    sendMTRefInitValueToMainThread();
    sendMTRefInitValueToMainThread();
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: ElementTemplateLifecycleConstant.updateMTRefInitValue,
      data: JSON.stringify([[1, 'once']]),
    });
  });

  it('keeps its receiver when the UI listener resets and removes it on destruction', () => {
    env.switchToMainThread();
    const apply = vi.spyOn(globalThis.lynxWorkletImpl._refImpl, 'updateWorkletRefInitValueChanges');
    installElementTemplateRefInitValueListener();
    installElementTemplateRefInitValueListener();
    installElementTemplatePatchListener();
    resetElementTemplatePatchListener();
    env.switchToBackground();
    new MainThreadRef('first');
    sendMTRefInitValueToMainThread();
    env.switchToMainThread();
    expect(apply).toHaveBeenCalledOnce();
    destroyElementTemplateMainThreadRuntime();
    env.switchToBackground();
    new MainThreadRef('after-destroy');
    sendMTRefInitValueToMainThread();
    env.switchToMainThread();
    expect(apply).toHaveBeenCalledOnce();
  });
});
