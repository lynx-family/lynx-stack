import { createElement } from 'preact/compat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../src/core/reload-version.js';
import { MainThreadRef, clearMainThreadRefLastIdForTesting } from '../../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../../src/core/mts-capability.js';
import {
  globalCommitContext,
  markRemovedSubtreeForPostDispatchTeardown,
} from '../../../src/element-template/background/commit-context.js';
import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
  uninstallElementTemplateCommitHookForTesting,
} from '../../../src/element-template/background/commit-hook.js';
import { setupBackgroundElementTemplateDocument } from '../../../src/element-template/background/document.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../src/element-template/background/hydration-listener.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundPageRootInstance,
} from '../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../src/element-template/background/manager.js';
import { root, useEffect } from '../../../src/element-template/index.js';
import { clearRefState } from '../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../src/element-template/protocol/opcodes.js';
import type { SerializedCompiledNode } from '../../../src/element-template/protocol/types.js';
import { callDestroyLifetimeFun } from '../../../src/element-template/native/callDestroyLifetimeFun.js';
import { __root, setRoot } from '../../../src/element-template/runtime/page/root-instance.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';
import { resetPerformanceMocks } from '../test-utils/mock/performance.js';

describe('callDestroyLifetimeFun', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
    clearMainThreadRefLastIdForTesting();
    clearMtsConfigCacheForTesting();
    takeMainThreadRefInitValuePatch();
    envManager.resetEnv('background');
  });

  afterEach(() => {
    uninstallElementTemplateCommitHookForTesting();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
    clearRefState();
    clearEtAttrPlanMap();
    takeMainThreadRefInitValuePatch();
  });

  it('destroys background runtime state', () => {
    const root = new BackgroundElementTemplateInstance('_et_test');
    const child = new BackgroundElementTemplateInstance('_et_child');
    root.appendChild(child);
    markRemovedSubtreeForPostDispatchTeardown(root);
    globalCommitContext.ops = [
      ElementTemplateUpdateOps.createTemplate,
      child.instanceId,
      '_et_child',
      null,
      [],
      [],
    ];

    callDestroyLifetimeFun();

    expect([...globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown]).toEqual([]);
    expect(globalCommitContext.ops).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
  });

  it('discards pending MainThreadRef init values on full-lifetime destroy', () => {
    new MainThreadRef('stale');

    callDestroyLifetimeFun();

    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('removes the hydration listener without processing later hydrate payloads', () => {
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);

    callDestroyLifetimeFun();

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: {
        page: {
          tag: 'page',
          attributes: null,
          childSlots: [[
            {
              templateKey: '_et_test',
              attributeSlots: [],
              childSlots: [],
              uid: -1,
            } satisfies SerializedCompiledNode,
          ]],
          uid: 0,
        },
        reloadVersion: getReloadVersion(),
      },
    });

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
  });

  it('unmounts a hydrated tree without dispatching removeNode patches and discards MainThreadRef init created in ref detach', () => {
    setRoot(new BackgroundPageRootInstance());
    setupBackgroundElementTemplateDocument();
    installElementTemplateCommitHook();
    const dispatch = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    const refCalls: unknown[] = [];
    const callbackRef = (value: unknown) => {
      refCalls.push(value);
      if (value === null) {
        new MainThreadRef('created-during-destroy-detach');
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
      callDestroyLifetimeFun();

      expect(refCalls).toContain(null);
      expect(dispatch).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(takeMainThreadRefInitValuePatch()).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleans up background runtime state in finally even when unmount effect cleanup throws', async () => {
    setRoot(new BackgroundPageRootInstance());
    setupBackgroundElementTemplateDocument();
    installElementTemplateCommitHook();

    const cleanupError = new Error('unmount effect cleanup failure');
    function ThrowingOnCleanup() {
      useEffect(() => {
        return () => {
          new MainThreadRef('created-before-throw');
          throw cleanupError;
        };
      }, []);
      return createElement('view', null);
    }

    root.render(createElement(ThrowingOnCleanup, null));
    await Promise.resolve();
    markElementTemplateHydrated();

    try {
      expect(() => callDestroyLifetimeFun()).toThrow(cleanupError);
      expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
      expect(takeMainThreadRefInitValuePatch()).toEqual([]);
    } finally {
      resetPerformanceMocks();
    }
  });
});
