import { afterEach, beforeEach, describe, expect, it, rstest as vi } from '@rstest/core';

import {
  globalCommitContext,
  markRemovedSubtreeForPostDispatchTeardown,
} from '../../../src/element-template/background/commit-context.js';
import { resetElementTemplateCommitState } from '../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../src/element-template/background/manager.js';
import { ElementTemplateLifecycleConstant } from '../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../src/element-template/protocol/opcodes.js';
import type { SerializedElementTemplate } from '../../../src/element-template/protocol/types.js';
import { callDestroyLifetimeFun } from '../../../src/element-template/native/callDestroyLifetimeFun.js';
import { __root } from '../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

describe('callDestroyLifetimeFun', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
    envManager.resetEnv('background');
  });

  afterEach(() => {
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
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

    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    expect(globalCommitContext.ops).toEqual([]);
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
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
      data: [
        {
          templateKey: '_et_test',
          attributeSlots: [],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
  });
});
