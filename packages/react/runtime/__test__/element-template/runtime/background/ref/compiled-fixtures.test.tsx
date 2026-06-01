import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installElementTemplateCommitHook,
  resetElementTemplateCommitState,
} from '../../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../../src/element-template/background/instance.js';
import { clearRefState } from '../../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import {
  loadCompiledFixturePair,
  type CompiledFixtureModuleExports,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/direct-ref/index.tsx');
const SPREAD_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/spread-ref/index.tsx');
const MULTI_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/multi-ref/index.tsx');
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

interface MultiRefAppProps {
  directRef?: unknown;
  objectRef?: unknown;
  spread?: SpreadFixtureProps;
}

interface UnsupportedFixtureProps {
  mainThreadRef?: unknown;
  workletRef?: unknown;
}

interface CompiledAppModule<TProps extends object> extends CompiledFixtureModuleExports {
  App: (props: TProps) => JSX.Element;
}

async function loadCompiledFixture<T extends object>(
  sourcePath: string,
): Promise<{
  backgroundModule: T;
  mainModule: T;
}> {
  return loadCompiledFixturePair<T>(sourcePath);
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

  function renderOnBackground<TProps extends object>(
    moduleExports: CompiledAppModule<TProps>,
    props: TProps,
  ): BackgroundElementTemplateInstance {
    const host = renderCompiledFixtureOnBackground(moduleExports, envManager, props);
    if (!host) {
      throw new Error('Missing rendered host.');
    }
    return host;
  }

  function hydrateFromMainThread<TProps extends object>(
    moduleExports: CompiledAppModule<TProps>,
    props: TProps,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();
    renderCompiledFixtureOnMainThread(moduleExports, envManager, props);
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

  it('hydrates compiled templates with multiple ref slots independently', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<MultiRefAppProps>>(
      MULTI_REF_FIXTURE,
    );
    const directRef = vi.fn();
    const objectRef: { current: unknown } = { current: null };
    const spreadRef = vi.fn();
    const props = {
      directRef,
      objectRef,
      spread: {
        id: 'cta',
        ref: spreadRef,
      },
    };

    const host = renderOnBackground(backgroundModule, props);
    const initialDirectSelector = `[ref=${host.instanceId}-0]`;
    const initialObjectSelector = `[ref=${host.instanceId}-1]`;
    const initialSpreadSelector = `[ref=${host.instanceId}-2]`;
    expect(host.attributeSlots).toEqual([
      `${host.instanceId}-0`,
      `${host.instanceId}-1`,
      { id: 'cta', ref: `${host.instanceId}-2` },
    ]);
    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: initialDirectSelector,
    }));
    expect(objectRef.current).toMatchObject({
      selector: initialObjectSelector,
    });
    expect(spreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: initialSpreadSelector,
    }));

    hydrateFromMainThread(mainModule, props);
    expect(directRef).toHaveBeenCalledTimes(1);
    expect(spreadRef).toHaveBeenCalledTimes(1);
    const stableDirectSelector = `[ref=${host.instanceId}-0]`;
    const stableSpreadSelector = `[ref=${host.instanceId}-2]`;
    const stableObjectProxy = objectRef.current;
    directRef.mockClear();
    spreadRef.mockClear();
    updateEvents = [];

    const nextDirectRef = vi.fn();
    const nextSpreadRef = vi.fn();
    renderOnBackground(backgroundModule, {
      directRef: nextDirectRef,
      objectRef,
      spread: {
        id: 'cta',
        ref: nextSpreadRef,
      },
    });

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(directRef).toHaveBeenCalledWith(null);
    expect(nextDirectRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: stableDirectSelector,
    }));
    expect(objectRef.current).toBe(stableObjectProxy);
    expect(spreadRef).toHaveBeenCalledWith(null);
    expect(nextSpreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: stableSpreadSelector,
    }));
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
