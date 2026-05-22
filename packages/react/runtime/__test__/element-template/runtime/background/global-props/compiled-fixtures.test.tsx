import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import type { CompiledFixtureModuleExports } from '../../../test-utils/debug/compiledFixtureModule.js';

globalThis.__GLOBAL_PROPS_MODE__ = 'event';

const [
  { installElementTemplateCommitHook, resetElementTemplateCommitState },
  { installElementTemplateHydrationListener, resetElementTemplateHydrationListener },
  { installElementTemplatePatchListener, resetElementTemplatePatchListener },
  { injectCalledByNative },
  { ElementTemplateLifecycleConstant },
  pageModule,
  { clearEtAttrPlanMap },
  { LynxTestEventEmitter },
  { loadCompiledFixturePair },
  { ElementTemplateEnvManager },
  { serializeToJSX },
  { createElement },
  { root },
] = await Promise.all([
  import('../../../../../src/element-template/background/commit-hook.js'),
  import('../../../../../src/element-template/background/hydration-listener.js'),
  import('../../../../../src/element-template/native/patch-listener.js'),
  import('../../../../../src/element-template/native/main-thread-api.js'),
  import('../../../../../src/element-template/protocol/lifecycle-constant.js'),
  import('../../../../../src/element-template/runtime/page/page.js'),
  import('../../../../../src/element-template/runtime/template/attr-slot-plan.js'),
  import('../../../../test-utils/lynx-event-emitter.js'),
  import('../../../test-utils/debug/compiledFixtureModule.js'),
  import('../../../test-utils/debug/envManager.js'),
  import('../../../test-utils/debug/serializer.js'),
  import('preact'),
  import('../../../../../src/element-template/index.js'),
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_READ_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/global-props/direct-read/index.tsx',
);
const EVENT_HOOK_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/global-props/event-hook/index.tsx',
);

interface GlobalPropsFixtureProps {
  onChanged?: (data: { theme?: string }) => void;
}

interface CompiledGlobalPropsModule extends CompiledFixtureModuleExports {
  App: (props?: GlobalPropsFixtureProps) => JSX.Element;
}

function waitForRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function settleInitialHydration(envManager: InstanceType<typeof ElementTemplateEnvManager>): Promise<void> {
  await waitForRender();
  envManager.switchToMainThread();
  envManager.switchToBackground();
  await waitForRender();
}

describe('Compiled ET GlobalProps update fixtures', () => {
  const envManager = new ElementTemplateEnvManager();
  let originalLynx: typeof lynx;
  let emitter: InstanceType<typeof LynxTestEventEmitter>;
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];

  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  function installGlobalProps(globalProps: Record<string, unknown>): void {
    const baseLynx = globalThis.lynx;
    vi.stubGlobal('lynx', {
      ...baseLynx,
      __globalProps: globalProps,
      getJSModule(moduleName: string) {
        if (moduleName === 'GlobalEventEmitter') {
          return emitter;
        }
        return baseLynx.getJSModule?.(moduleName);
      },
    });
    globalThis.lynxCoreInject.tt.GlobalEventEmitter = emitter as typeof lynxCoreInject.tt.GlobalEventEmitter;
  }

  function renderFixtureOnBackground(
    moduleExports: CompiledGlobalPropsModule,
    props?: GlobalPropsFixtureProps,
  ): void {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, props));
  }

  function renderFixtureOnMainThread(
    moduleExports: CompiledGlobalPropsModule,
    props?: GlobalPropsFixtureProps,
  ): void {
    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, props));
    renderPage({});
  }

  beforeEach(() => {
    vi.clearAllMocks();
    originalLynx = globalThis.lynx;
    emitter = new LynxTestEventEmitter();
    updateEvents = [];
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);
    installGlobalProps({ theme: 'dark', stable: true });
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

    envManager.switchToMainThread();
    injectCalledByNative();
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
    resetElementTemplateCommitState();
    envManager.setUseElementTemplate(false);
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';
    vi.stubGlobal('lynx', originalLynx);
  });

  it('reactive updateGlobalProps force-renders direct globalProps reads into native update ops', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<CompiledGlobalPropsModule>(
      DIRECT_READ_FIXTURE,
    );

    renderFixtureOnBackground(backgroundModule);
    renderFixtureOnMainThread(mainModule);
    envManager.switchToMainThread();
    expect(serializeToJSX(pageModule.__page)).toContain('dark');
    envManager.switchToBackground();
    await settleInitialHydration(envManager);
    updateEvents = [];

    lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
    await waitForRender();

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops.length).toBeGreaterThan(0);
    expect(serializeToJSX(pageModule.__page)).toContain('light');
  });

  it('event mode emits without updating compiled direct globalProps reads', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';
    const emitted = vi.fn();
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<CompiledGlobalPropsModule>(
      DIRECT_READ_FIXTURE,
    );

    renderFixtureOnBackground(backgroundModule);
    renderFixtureOnMainThread(mainModule);
    envManager.switchToMainThread();
    expect(serializeToJSX(pageModule.__page)).toContain('dark');
    envManager.switchToBackground();
    emitter.addListener('onGlobalPropsChanged', emitted);
    await settleInitialHydration(envManager);
    updateEvents = [];

    const previousGlobalProps = lynx.__globalProps;
    lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
    await waitForRender();

    expect(lynx.__globalProps).not.toBe(previousGlobalProps);
    expect(lynx.__globalProps).toEqual({ theme: 'light', stable: true });
    expect(emitted).toHaveBeenCalledWith(lynx.__globalProps);

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    expect(serializeToJSX(pageModule.__page)).toContain('dark');
  });

  it('event mode updates compiled GlobalProps hook and provider users through the changed event', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';
    const changed = vi.fn();
    const { backgroundModule, mainModule } = await loadCompiledFixturePair<CompiledGlobalPropsModule>(
      EVENT_HOOK_FIXTURE,
    );

    renderFixtureOnBackground(backgroundModule, { onChanged: changed });
    renderFixtureOnMainThread(mainModule);
    envManager.switchToMainThread();
    expect(serializeToJSX(pageModule.__page)).toContain('dark:dark');
    envManager.switchToBackground();
    await settleInitialHydration(envManager);
    updateEvents = [];

    lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
    await waitForRender();

    expect(changed).toHaveBeenCalledWith(lynx.__globalProps);
    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops.length).toBeGreaterThan(0);
    expect(serializeToJSX(pageModule.__page)).toContain('light:light');
  });
});
