import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../../src/core/reload-version.js';
import { setupBackgroundElementTemplateDocument } from '../../../../src/element-template/background/document.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { reloadBackground } from '../../../../src/element-template/native/reload.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type { SerializedElementTemplate } from '../../../../src/element-template/protocol/types.js';
import { __root, setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

function createSerializedTemplate(handleId: number, templateKey: string): SerializedElementTemplate {
  return {
    templateKey,
    attributeSlots: [],
    elementSlots: [],
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
    setRoot(new BackgroundElementTemplateInstance('root'));
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
    const after = new BackgroundElementTemplateInstance('_et_test');
    reloadedRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: {
        instances: [createSerializedTemplate(-1, '_et_test')],
        reloadVersion: getReloadVersion(),
      },
    });

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(after);
  });
});
