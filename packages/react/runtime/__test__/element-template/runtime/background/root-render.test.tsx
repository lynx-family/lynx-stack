import { beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { resetElementTemplateCommitState } from '../../../../src/element-template/background/commit-hook.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { installElementTemplateRenderScopeHooks } from '../../../../src/element-template/background/render-scope.js';
import { callDestroyLifetimeFun } from '../../../../src/element-template/native/callDestroyLifetimeFun.js';
import { root } from '../../../../src/element-template/index.js';
import { clearRefState, flushPendingRefs } from '../../../../src/element-template/prop-adapters/ref.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import {
  __etAttrPlanMap,
  adaptRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

describe('ElementTemplate root render timing', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    rstest.clearAllMocks();
    clearEtAttrPlanMap();
    clearRefState();
    resetElementTemplateCommitState();
    envManager.resetEnv('background');
  });

  it('does not eagerly render on main thread and only caches jsx on root', () => {
    envManager.switchToMainThread();
    const oldJsx = (__root as { __jsx?: unknown }).__jsx;

    root.render(<view id='main-thread' />);

    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(lynx.performance.profileEnd).not.toHaveBeenCalled();
    expect((__root as { __jsx?: unknown }).__jsx ?? oldJsx).toBeDefined();
  });

  it('wraps background render with profile timing', () => {
    root.render(<view />);

    const { performance } = lynx;
    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(performance.profileEnd).toHaveBeenCalled();
  });

  it('keeps render scope hook installation idempotent', () => {
    expect(() => {
      installElementTemplateRenderScopeHooks();
      installElementTemplateRenderScopeHooks();
    }).not.toThrow();
  });

  it('cleans direct refs through root unmount on background destroy', () => {
    const ref = { current: null };

    root.render(<view />);
    const instance = (__root as BackgroundElementTemplateInstance).firstChild;
    expect(instance).toBeInstanceOf(BackgroundElementTemplateInstance);
    __etAttrPlanMap[instance!.type] = [0, adaptRefAttrSlot];
    instance?.setAttribute('attributeSlots', [ref]);
    expect(instance?.attributeSlots).toEqual([`${instance?.instanceId}-0`]);
    flushPendingRefs();
    expect(ref.current).toMatchObject({ selector: expect.stringMatching(/^\[ref=\d+-0\]$/) });

    callDestroyLifetimeFun();

    expect(ref.current).toBeNull();
  });
});
