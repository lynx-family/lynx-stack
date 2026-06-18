import { createElement } from 'preact';
import { afterEach, describe, expect, it, rstest as vi, rstest } from '@rstest/core';

import { LynxTestEventEmitter } from '../../../test-utils/lynx-event-emitter.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../src/element-template/protocol/update-event.js';

type UpdateEvent = {
  ops: unknown[];
  flushOptions: Record<string, unknown>;
};

function waitForRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function setupGlobalPropsRuntime(mode: 'reactive' | 'event') {
  rstest.resetModules();
  vi.stubGlobal('__GLOBAL_PROPS_MODE__', mode);

  const { ElementTemplateEnvManager } = await import('../../test-utils/debug/envManager.js');
  const { ElementTemplateLifecycleConstant } = await import(
    '../../../../src/element-template/protocol/lifecycle-constant.js'
  );
  const { markElementTemplateHydrated, resetElementTemplateCommitState } = await import(
    '../../../../src/element-template/background/commit-hook.js'
  );
  const { resetElementTemplateHydrationListener } = await import(
    '../../../../src/element-template/background/hydration-listener.js'
  );
  const { clearEtAttrPlanMap } = await import(
    '../../../../src/element-template/runtime/template/attr-slot-plan.js'
  );

  const envManager = new ElementTemplateEnvManager();
  const emitter = new LynxTestEventEmitter();
  const updateEvents: UpdateEvent[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data) as UpdateEvent);
  };

  resetElementTemplateCommitState();
  clearEtAttrPlanMap();
  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);

  const baseLynx = globalThis.lynx;
  const originalGlobalEventEmitter = globalThis.lynxCoreInject.tt.GlobalEventEmitter;
  vi.stubGlobal('lynx', {
    ...baseLynx,
    __globalProps: { theme: 'dark', stable: true },
    getJSModule(moduleName: string) {
      if (moduleName === 'GlobalEventEmitter') {
        return emitter;
      }
      return baseLynx.getJSModule?.(moduleName);
    },
  });
  globalThis.lynxCoreInject.tt.GlobalEventEmitter = emitter as typeof lynxCoreInject.tt.GlobalEventEmitter;

  const et = await import('../../../../src/element-template/index.js');

  envManager.switchToMainThread();
  lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
  envManager.switchToBackground();
  markElementTemplateHydrated();

  return {
    ...et,
    emitter,
    envManager,
    updateEvents,
    cleanup() {
      envManager.switchToMainThread();
      lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
      envManager.switchToBackground();
      resetElementTemplateHydrationListener();
      resetElementTemplateCommitState();
      globalThis.lynxCoreInject.tt.GlobalEventEmitter = originalGlobalEventEmitter;
    },
  };
}

describe('ElementTemplate background GlobalProps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reactive updateGlobalProps force-renders direct globalProps reads', async () => {
    const runtime = await setupGlobalPropsRuntime('reactive');
    const emitted = vi.fn();
    const renderedThemes: unknown[] = [];

    try {
      runtime.emitter.addListener('onGlobalPropsChanged', emitted);

      function App() {
        renderedThemes.push(lynx.__globalProps.theme);
        return createElement('text', null, lynx.__globalProps.theme);
      }

      runtime.root.render(createElement(App));
      runtime.updateEvents.length = 0;

      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitForRender();

      expect(lynx.__globalProps).toEqual({ theme: 'light', stable: true });
      expect(renderedThemes).toEqual(['dark', 'light']);
      expect(emitted).toHaveBeenCalledWith(lynx.__globalProps);
    } finally {
      runtime.cleanup();
    }
  });

  it('event mode emits without force-rendering direct globalProps reads', async () => {
    const runtime = await setupGlobalPropsRuntime('event');
    const emitted = vi.fn();
    const renderedThemes: unknown[] = [];

    try {
      runtime.emitter.addListener('onGlobalPropsChanged', emitted);

      function App() {
        renderedThemes.push(lynx.__globalProps.theme);
        return createElement('text', null, lynx.__globalProps.theme);
      }

      runtime.root.render(createElement(App));
      runtime.updateEvents.length = 0;

      const previousGlobalProps = lynx.__globalProps;
      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitForRender();

      expect(lynx.__globalProps).not.toBe(previousGlobalProps);
      expect(lynx.__globalProps).toEqual({ theme: 'light', stable: true });
      expect(renderedThemes).toEqual(['dark']);
      expect(emitted).toHaveBeenCalledWith(lynx.__globalProps);

      runtime.envManager.switchToMainThread();
      expect(runtime.updateEvents).toEqual([]);
    } finally {
      runtime.cleanup();
    }
  });

  it('event mode updates GlobalProps hook users through the changed event', async () => {
    const runtime = await setupGlobalPropsRuntime('event');
    const changed = vi.fn();
    const renderedThemes: unknown[] = [];

    try {
      function App() {
        const globalProps = runtime.useGlobalProps();
        runtime.useGlobalPropsChanged(changed);
        renderedThemes.push(globalProps.theme);
        return createElement('text', null, globalProps.theme);
      }

      runtime.root.render(createElement(App));
      runtime.updateEvents.length = 0;

      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitForRender();

      expect(changed).toHaveBeenCalledWith(lynx.__globalProps);
      expect(renderedThemes).toEqual(['dark', 'light']);
    } finally {
      runtime.cleanup();
    }
  });
});
