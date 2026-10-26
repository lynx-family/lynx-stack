import { createElement } from 'preact/compat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainThreadRef, clearMainThreadRefLastIdForTesting } from '../../../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../../../src/core/mts-capability.js';
import { getReloadVersion } from '../../../../src/core/reload-version.js';
import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
  uninstallElementTemplateCommitHookForTesting,
} from '../../../../src/element-template/background/commit-hook.js';
import { setupBackgroundElementTemplateDocument } from '../../../../src/element-template/background/document.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundPageRootInstance,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { root } from '../../../../src/element-template/index.js';
import { reloadBackground } from '../../../../src/element-template/native/reload-background.js';
import { clearRefState } from '../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type { SerializedCompiledNode } from '../../../../src/element-template/protocol/types.js';
import { __root, setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

function createSerializedTemplate(handleId: number, templateKey: string): SerializedCompiledNode {
  return {
    templateKey,
    attributeSlots: [],
    childSlots: [],
    uid: handleId,
  };
}

describe('ElementTemplate background reload', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
    resetElementTemplateHydrationListener();
    backgroundElementTemplateInstanceManager.clear();
    setRoot(new BackgroundPageRootInstance());
    setupBackgroundElementTemplateDocument();
    installElementTemplateHydrationListener();
  });

  afterEach(() => {
    uninstallElementTemplateCommitHookForTesting();
    resetElementTemplateCommitState();
    resetElementTemplateHydrationListener();
    clearRefState();
    clearEtAttrPlanMap();
    clearMainThreadRefLastIdForTesting();
    clearMtsConfigCacheForTesting();
    takeMainThreadRefInitValuePatch();
    backgroundElementTemplateInstanceManager.clear();
  });

  it('installs a new hydration listener that consumes post-reload hydrate payloads', () => {
    const oldRoot = __root;
    oldRoot.__jsx = null;

    reloadBackground({ msg: 'after' });

    const reloadedRoot = __root as BackgroundElementTemplateInstance;
    expect(reloadedRoot).not.toBe(oldRoot);
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(reloadedRoot);
    expect(backgroundElementTemplateInstanceManager.get(0)).not.toBe(oldRoot);
    const after = new BackgroundElementTemplateInstance('_et_test');
    reloadedRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: {
        page: {
          tag: 'page',
          attributes: null,
          childSlots: [[createSerializedTemplate(-1, '_et_test')]],
          uid: 0,
        },
        reloadVersion: getReloadVersion(),
      },
    });

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(after);
  });

  it('unmounts a hydrated tree on reload without dispatching removeNode patches or dropping MainThreadRef init created in ref detach', () => {
    const originalLynxSdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.0';
    clearMtsConfigCacheForTesting();
    installElementTemplateCommitHook();
    const dispatch = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    let retainedRefFromDetach: MainThreadRef<string> | undefined;
    const refCalls: unknown[] = [];
    const callbackRef = (value: unknown) => {
      refCalls.push(value);
      if (value === null && !retainedRefFromDetach) {
        retainedRefFromDetach = new MainThreadRef('created-in-detach');
      }
    };

    root.render(createElement('view', null));
    const oldView = (__root as BackgroundElementTemplateInstance).firstChild!;
    __etAttrPlanMap[oldView.type] = [0, adaptRefAttrSlot];
    oldView.setAttribute('attributeSlots', [callbackRef]);
    oldView.markMaterializedByHydration();
    markElementTemplateHydrated();
    dispatch.mockClear();

    vi.useFakeTimers();
    try {
      reloadBackground({ next: 1 });

      expect(refCalls).toContain(null);
      expect(retainedRefFromDetach).toBeInstanceOf(MainThreadRef);
      expect(vi.getTimerCount()).toBe(0);
      expect(dispatch).toHaveBeenCalledExactlyOnceWith({
        type: ElementTemplateLifecycleConstant.updateMTRefInitValue,
        data: JSON.stringify([[retainedRefFromDetach!._wvid, 'created-in-detach']]),
      });
    } finally {
      vi.useRealTimers();
      SystemInfo.lynxSdkVersion = originalLynxSdkVersion;
    }
  });

  it('forwards resetPageData options to applyUpdatePageData during ordinary background reload', () => {
    lynx.__initData = { stale: 1, value: 1 };
    __root.__jsx = null;

    reloadBackground({ value: 2 }, { resetPageData: true });

    expect(lynx.__initData).toEqual({ value: 2 });
  });
});
