import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createElement } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { root } from '../../../../src/element-template/index.js';
import { updateCardData } from '../../../../src/element-template/lynx/update-data.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../src/element-template/protocol/types.js';
import { __page } from '../../../../src/element-template/runtime/page/page.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { compileFixtureSource } from '../../test-utils/debug/compiledFixtureCompiler.js';
import { loadCompiledFixtureModule } from '../../test-utils/debug/compiledFixtureModule.js';
import type { CompiledFixtureModuleExports } from '../../test-utils/debug/compiledFixtureModule.js';
import { primeCompiledFixtureTemplates } from '../../test-utils/debug/compiledFixtureRegistry.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { serializeToJSX } from '../../test-utils/debug/serializer.js';

declare const renderPage: (data?: Record<string, unknown>) => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.resolve(__dirname, '../../fixtures/background/init-data-update/index.tsx');

type Listener = (...args: unknown[]) => void;

class LynxTestEventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  addListener(eventName: string, listener: Listener): void {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.add(listener);
      return;
    }
    this.listeners.set(eventName, new Set([listener]));
  }

  removeListener(eventName: string, listener: Listener): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName: string, args?: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(...(args ?? []));
    }
  }
}

function waitForRender(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function loadCompiledInitDataFixture(): Promise<{
  backgroundModule: CompiledFixtureModuleExports;
  mainModule: CompiledFixtureModuleExports;
}> {
  const mainArtifact = await compileFixtureSource(FIXTURE, { target: 'LEPUS' });
  primeCompiledFixtureTemplates(mainArtifact);
  const mainModule = await loadCompiledFixtureModule(mainArtifact);

  const backgroundArtifact = await compileFixtureSource(FIXTURE, { target: 'JS' });
  const backgroundModule = await loadCompiledFixtureModule(backgroundArtifact);

  return { backgroundModule, mainModule };
}

describe('Compiled ET InitData updateData fixture', () => {
  const envManager = new ElementTemplateEnvManager();
  let originalLynx: typeof lynx;
  let emitter: LynxTestEventEmitter;
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];

  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  function installInitData(initData: Record<string, unknown>): void {
    const baseLynx = globalThis.lynx;
    vi.stubGlobal('lynx', {
      ...baseLynx,
      __initData: initData,
      getJSModule(moduleName: string) {
        if (moduleName === 'GlobalEventEmitter') {
          return emitter;
        }
        return baseLynx.getJSModule?.(moduleName);
      },
    });
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
    installInitData({ msg: 'init' });
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

    envManager.switchToMainThread();
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
    vi.stubGlobal('lynx', originalLynx);
  });

  it('updates raw text after hydrated background updateCardData', async () => {
    const { backgroundModule, mainModule } = await loadCompiledInitDataFixture();

    envManager.switchToBackground();
    root.render(createElement(backgroundModule.App));

    envManager.switchToMainThread();
    root.render(createElement(mainModule.App));
    renderPage({ msg: 'init' });
    expect(serializeToJSX(__page)).toContain('init');

    envManager.switchToBackground();
    updateEvents = [];
    updateCardData({ msg: 'update' });
    await waitForRender();

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.flushOptions).toMatchObject({ triggerDataUpdated: true });
    expect(updateEvents.at(-1)?.ops.length).toBeGreaterThan(0);
    expect(serializeToJSX(__page)).toContain('update');
    expect((__FlushElementTree as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[1]).toMatchObject({
      triggerDataUpdated: true,
    });
  });
});
