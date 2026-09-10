import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../../src/core/reload-version.js';
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
import { reloadBackground } from '../../../../src/element-template/native/reload-background.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type { SerializedCompiledNode } from '../../../../src/element-template/protocol/types.js';
import { __root, setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
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
    resetElementTemplateHydrationListener();
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
});
