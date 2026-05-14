import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'preact';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../../src/element-template/background/instance.js';
import { root } from '../../../../../src/element-template/index.js';
import { clearRefState } from '../../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { compileFixtureSource } from '../../../test-utils/debug/compiledFixtureCompiler.js';
import {
  loadCompiledFixtureModule,
  type CompiledFixtureModuleExports,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import { primeCompiledFixtureTemplates } from '../../../test-utils/debug/compiledFixtureRegistry.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';

declare const renderPage: () => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/direct-ref/index.tsx');
const SPREAD_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/spread-ref/index.tsx');
const UNSUPPORTED_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/unsupported-ref/index.tsx');

interface DirectFixtureProps {
  hostRef?: unknown;
}

interface SpreadFixtureProps {
  id?: string;
  ref?: unknown;
  'main-thread:ref'?: unknown;
  'worklet:ref'?: unknown;
}

interface SpreadAppProps {
  spread?: SpreadFixtureProps;
}

interface UnsupportedFixtureProps {
  mainThreadRef?: unknown;
  workletRef?: unknown;
}

interface CompiledAppModule<TProps> extends CompiledFixtureModuleExports {
  App: (props: TProps) => JSX.Element;
}

async function loadCompiledFixture<T extends object>(
  sourcePath: string,
): Promise<{
  backgroundModule: T;
  mainModule: T;
}> {
  const mainArtifact = await compileFixtureSource(sourcePath, { target: 'LEPUS' });
  primeCompiledFixtureTemplates(mainArtifact);
  const mainModule = await loadCompiledFixtureModule<T>(mainArtifact);

  const backgroundArtifact = await compileFixtureSource(sourcePath, { target: 'JS' });
  const backgroundModule = await loadCompiledFixtureModule<T>(backgroundArtifact);

  return { backgroundModule, mainModule };
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = (__root as BackgroundElementTemplateInstance).firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

describe('Compiled ordinary ref background updates', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  function renderOnBackground<TProps>(
    moduleExports: CompiledAppModule<TProps>,
    props: TProps,
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, props));
    return getRenderedHost();
  }

  function hydrateFromMainThread<TProps>(
    moduleExports: CompiledAppModule<TProps>,
    props: TProps,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();

    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, props));
    renderPage();
    envManager.switchToBackground();

    return host;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
    resetElementTemplateHydrationListener();
    clearEtAttrPlanMap();
    clearRefState();
    updateEvents = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    clearRefState();
    envManager.setUseElementTemplate(false);
  });

  it('hydrates compiled direct refs and applies later ref-only updates without native patches', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<DirectFixtureProps>>(
      DIRECT_REF_FIXTURE,
    );
    const oldRef = vi.fn();
    const newRef = vi.fn();

    const host = renderOnBackground(backgroundModule, { hostRef: oldRef });
    expect(oldRef).toHaveBeenCalledTimes(1);

    hydrateFromMainThread(mainModule, { hostRef: oldRef });
    expect(oldRef).toHaveBeenCalledTimes(1);
    expect(host.attributeSlots).toEqual([`${host.instanceId}-0`]);
    oldRef.mockClear();
    updateEvents = [];

    renderOnBackground(backgroundModule, { hostRef: newRef });

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(oldRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: `[ref=${host.instanceId}-0]`,
    }));
  });

  it('hydrates compiled spread refs, skips unsupported ref-like keys, and dedupes wrapper churn', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<SpreadAppProps>>(
      SPREAD_REF_FIXTURE,
    );
    const stableRef = vi.fn();
    const newRef = vi.fn();
    const unsupportedMainThreadRef = vi.fn();
    const unsupportedWorkletRef = vi.fn();

    const host = renderOnBackground(backgroundModule, {
      spread: {
        id: 'cta',
        ref: stableRef,
        'main-thread:ref': unsupportedMainThreadRef,
        'worklet:ref': unsupportedWorkletRef,
      },
    });
    expect(stableRef).toHaveBeenCalledTimes(1);

    hydrateFromMainThread(mainModule, {
      spread: {
        id: 'cta',
        ref: stableRef,
        'main-thread:ref': unsupportedMainThreadRef,
        'worklet:ref': unsupportedWorkletRef,
      },
    });

    const preparedSpread = { id: 'cta', ref: `${host.instanceId}-0` };
    expect(stableRef).toHaveBeenCalledTimes(1);
    expect(host.attributeSlots).toEqual([preparedSpread]);
    stableRef.mockClear();
    updateEvents = [];

    renderOnBackground(backgroundModule, {
      spread: { id: 'cta-next', ref: stableRef },
    });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      { id: 'cta-next', ref: `${host.instanceId}-0` },
    ]);
    envManager.switchToBackground();
    expect(stableRef).not.toHaveBeenCalled();
    updateEvents = [];

    renderOnBackground(backgroundModule, {
      spread: { id: 'cta-next', ref: newRef },
    });

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(stableRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: `[ref=${host.instanceId}-0]`,
    }));
    expect(unsupportedMainThreadRef).not.toHaveBeenCalled();
    expect(unsupportedWorkletRef).not.toHaveBeenCalled();
  });

  it('drops compiled unsupported namespaced refs before native payloads', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<UnsupportedFixtureProps>>(
      UNSUPPORTED_REF_FIXTURE,
    );
    const mainThreadRef = vi.fn();
    const workletRef = vi.fn();

    const props = { mainThreadRef, workletRef };
    const host = renderOnBackground(backgroundModule, props);
    expect(host.attributeSlots).toEqual([null, null]);

    hydrateFromMainThread(mainModule, props);

    expect(host.attributeSlots).toEqual([null, null]);
    expect(mainThreadRef).not.toHaveBeenCalled();
    expect(workletRef).not.toHaveBeenCalled();
  });
});
