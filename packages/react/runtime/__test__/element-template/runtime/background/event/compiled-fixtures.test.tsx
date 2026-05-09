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
import {
  collectElementTemplateSubtreeHandleIds,
  BackgroundElementTemplateInstance,
} from '../../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';
import { root } from '../../../../../src/element-template/index.js';
import {
  clearEventState,
  getEventHandlerForEventValue,
  publishEvent,
} from '../../../../../src/element-template/prop-adapters/event.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
} from '../../../../../src/element-template/protocol/types.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { compileFixtureSource } from '../../../test-utils/debug/compiledFixtureCompiler.js';
import {
  loadCompiledFixtureModule,
  type CompiledFixtureModuleExports,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import { primeCompiledFixtureTemplates } from '../../../test-utils/debug/compiledFixtureRegistry.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';
import { serializeBackgroundTree } from '../../../test-utils/debug/serializer.js';

declare const renderPage: () => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_EVENT_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/event/direct-event/index.tsx');
const CONDITIONAL_DIRECT_EVENT_FIXTURE = path.resolve(
  __dirname,
  '../../../fixtures/background/event/conditional-direct-event/index.tsx',
);
const SPREAD_EVENT_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/event/spread-event/index.tsx');
const SLOT_ID = 0;

interface CompiledDirectEventModule extends CompiledFixtureModuleExports {
  App: (props: { onTap?: () => void }) => JSX.Element;
}

interface CompiledConditionalDirectEventModule extends CompiledFixtureModuleExports {
  App: (props: { show?: boolean; onTap?: () => void }) => JSX.Element;
}

interface SpreadFixtureProps {
  id?: string;
  className?: string;
  bindtap?: () => void;
}

interface CompiledSpreadEventModule extends CompiledFixtureModuleExports {
  App: (props: {
    spread?: SpreadFixtureProps;
    onCatch?: () => void;
    showChild?: boolean;
    childSpread?: SpreadFixtureProps;
  }) => JSX.Element;
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = (__root as BackgroundElementTemplateInstance).firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

function getSlotChildAt(
  index: number,
  host = getRenderedHost(),
): BackgroundElementTemplateInstance {
  const child = host.elementSlots[SLOT_ID]?.[index];
  if (!child) {
    throw new Error(`Missing slot child at ${index}.\n${serializeBackgroundTree(host)}`);
  }
  return child;
}

function collectRecursiveCreateCommandStream(
  instance: BackgroundElementTemplateInstance,
): ElementTemplateUpdateCommandStream {
  const commands: ElementTemplateUpdateCommandStream = [];
  for (const slotChildren of instance.elementSlots) {
    for (const child of slotChildren ?? []) {
      commands.push(...collectRecursiveCreateCommandStream(child));
    }
  }
  commands.push(
    ElementTemplateUpdateOps.createTemplate,
    instance.instanceId,
    instance.type,
    null,
    instance.attributeSlots,
    instance.elementSlots.map(children => (children ?? []).map(child => child.instanceId)),
  );
  return commands;
}

describe('Compiled direct event background updates', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  async function loadCompiledDirectEventFixture(): Promise<{
    backgroundModule: CompiledDirectEventModule;
    mainModule: CompiledDirectEventModule;
  }> {
    const mainArtifact = await compileFixtureSource(DIRECT_EVENT_FIXTURE, { target: 'LEPUS' });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule<CompiledDirectEventModule>(mainArtifact);

    const backgroundArtifact = await compileFixtureSource(DIRECT_EVENT_FIXTURE, { target: 'JS' });
    const backgroundModule = await loadCompiledFixtureModule<CompiledDirectEventModule>(backgroundArtifact);

    return { backgroundModule, mainModule };
  }

  async function loadCompiledConditionalDirectEventFixture(): Promise<{
    backgroundModule: CompiledConditionalDirectEventModule;
    mainModule: CompiledConditionalDirectEventModule;
  }> {
    const mainArtifact = await compileFixtureSource(CONDITIONAL_DIRECT_EVENT_FIXTURE, { target: 'LEPUS' });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule<CompiledConditionalDirectEventModule>(mainArtifact);

    const backgroundArtifact = await compileFixtureSource(CONDITIONAL_DIRECT_EVENT_FIXTURE, { target: 'JS' });
    const backgroundModule = await loadCompiledFixtureModule<CompiledConditionalDirectEventModule>(
      backgroundArtifact,
    );

    return { backgroundModule, mainModule };
  }

  async function loadCompiledSpreadEventFixture(): Promise<{
    backgroundModule: CompiledSpreadEventModule;
    mainModule: CompiledSpreadEventModule;
  }> {
    const mainArtifact = await compileFixtureSource(SPREAD_EVENT_FIXTURE, { target: 'LEPUS' });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule<CompiledSpreadEventModule>(mainArtifact);

    const backgroundArtifact = await compileFixtureSource(SPREAD_EVENT_FIXTURE, { target: 'JS' });
    const backgroundModule = await loadCompiledFixtureModule<CompiledSpreadEventModule>(backgroundArtifact);

    return { backgroundModule, mainModule };
  }

  function renderDirectEventOnBackground(
    moduleExports: CompiledDirectEventModule,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, { onTap }));
    return getRenderedHost();
  }

  function hydrateDirectEventFromMainThread(
    moduleExports: CompiledDirectEventModule,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();

    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, { onTap }));
    renderPage();
    envManager.switchToBackground();

    return host;
  }

  function renderSpreadEventOnBackground(
    moduleExports: CompiledSpreadEventModule,
    spread: SpreadFixtureProps | undefined,
    onCatch?: () => void,
    childOptions?: {
      showChild?: boolean;
      childSpread?: SpreadFixtureProps;
    },
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, { spread, onCatch, ...childOptions }));
    return getRenderedHost();
  }

  function hydrateSpreadEventFromMainThread(
    moduleExports: CompiledSpreadEventModule,
    spread: SpreadFixtureProps | undefined,
    onCatch?: () => void,
    childOptions?: {
      showChild?: boolean;
      childSpread?: SpreadFixtureProps;
    },
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();

    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, { spread, onCatch, ...childOptions }));
    renderPage();
    envManager.switchToBackground();

    return host;
  }

  function renderConditionalDirectEventOnBackground(
    moduleExports: CompiledConditionalDirectEventModule,
    show: boolean,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, { show, onTap }));
    return getRenderedHost();
  }

  function hydrateConditionalDirectEventFromMainThread(
    moduleExports: CompiledConditionalDirectEventModule,
    show: boolean,
    onTap?: () => void,
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();

    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, { show, onTap }));
    renderPage();
    envManager.switchToBackground();

    return host;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
    clearEventState();
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
    envManager.setUseElementTemplate(false);
  });

  it('uses the latest background handler without dispatching a native patch when only handler identity changes', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const host = renderDirectEventOnBackground(backgroundModule, firstHandler);
    hydrateDirectEventFromMainThread(mainModule, firstHandler);
    updateEvents = [];

    renderDirectEventOnBackground(backgroundModule, secondHandler);

    const eventValue = `${host.instanceId}:0:`;
    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(secondHandler);
  });

  it('uses ordinary setAttribute patches when direct event handlers are added or removed', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const handler = vi.fn();

    const host = renderDirectEventOnBackground(backgroundModule);
    hydrateDirectEventFromMainThread(mainModule);
    updateEvents = [];

    renderDirectEventOnBackground(backgroundModule, handler);

    const eventValue = `${host.instanceId}:0:`;
    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      eventValue,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

    updateEvents = [];
    renderDirectEventOnBackground(backgroundModule);

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      0,
      null,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([null]);
    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('dispatches native event values to the latest hydrated direct event handler', async () => {
    const { backgroundModule, mainModule } = await loadCompiledDirectEventFixture();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const host = renderDirectEventOnBackground(backgroundModule, firstHandler);
    hydrateDirectEventFromMainThread(mainModule, firstHandler);
    const eventValue = `${host.instanceId}:0:`;

    publishEvent(eventValue, { type: 'tap', phase: 'first' });

    renderDirectEventOnBackground(backgroundModule, secondHandler);
    publishEvent(eventValue, { type: 'tap', phase: 'second' });

    expect(firstHandler).toHaveBeenCalledWith({ type: 'tap', phase: 'first' });
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledWith({ type: 'tap', phase: 'second' });
  });

  it('hydrates compiled spread attrs and dispatches direct plus spread event values independently', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = vi.fn();
    const handleDirectCatch = vi.fn();

    const host = renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    hydrateSpreadEventFromMainThread(
      mainModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );

    const directEventValue = `${host.instanceId}:0:`;
    const spreadEventValue = `${host.instanceId}:1:bindtap`;
    const preparedSpread = { id: 'cta', class: 'primary', bindtap: spreadEventValue };
    expect(host.attributeSlots).toEqual([directEventValue, preparedSpread]);
    expect(getEventHandlerForEventValue(directEventValue)).toBe(handleDirectCatch);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);

    publishEvent(directEventValue, { type: 'tap', source: 'direct' });
    publishEvent(spreadEventValue, { type: 'tap', source: 'spread' });

    expect(handleDirectCatch).toHaveBeenCalledWith({ type: 'tap', source: 'direct' });
    expect(handleSpreadTap).toHaveBeenCalledWith({ type: 'tap', source: 'spread' });
  });

  it('updates compiled spread plain attrs through a whole-slot setAttribute patch', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = vi.fn();
    const handleDirectCatch = vi.fn();

    const host = renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    hydrateSpreadEventFromMainThread(
      mainModule,
      { id: 'cta', className: 'primary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );
    updateEvents = [];

    renderSpreadEventOnBackground(
      backgroundModule,
      { id: 'cta-next', className: 'secondary', bindtap: handleSpreadTap },
      handleDirectCatch,
    );

    const spreadEventValue = `${host.instanceId}:1:bindtap`;
    const preparedSpread = { id: 'cta-next', class: 'secondary', bindtap: spreadEventValue };
    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      host.instanceId,
      1,
      preparedSpread,
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([`${host.instanceId}:0:`, preparedSpread]);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);
  });

  it('registers and dispatches spread events on inserted compiled subtrees', async () => {
    const { backgroundModule, mainModule } = await loadCompiledSpreadEventFixture();
    const handleSpreadTap = vi.fn();

    const host = renderSpreadEventOnBackground(backgroundModule, undefined, undefined, {
      showChild: false,
    });
    hydrateSpreadEventFromMainThread(mainModule, undefined, undefined, { showChild: false });
    updateEvents = [];

    renderSpreadEventOnBackground(backgroundModule, undefined, undefined, {
      showChild: true,
      childSpread: { id: 'inserted', bindtap: handleSpreadTap },
    });
    const inserted = getSlotChildAt(0, host);
    const spreadEventValue = `${inserted.instanceId}:0:bindtap`;
    const preparedSpread = { id: 'inserted', bindtap: spreadEventValue };

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ...collectRecursiveCreateCommandStream(inserted),
      ElementTemplateUpdateOps.insertNode,
      host.instanceId,
      SLOT_ID,
      inserted.instanceId,
      0,
    ]);
    envManager.switchToBackground();
    expect(inserted.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(spreadEventValue)).toBe(handleSpreadTap);

    publishEvent(spreadEventValue, { type: 'tap', source: 'inserted-spread' });

    expect(handleSpreadTap).toHaveBeenCalledWith({ type: 'tap', source: 'inserted-spread' });
  });

  it('registers and dispatches direct events on inserted compiled subtrees', async () => {
    const { backgroundModule, mainModule } = await loadCompiledConditionalDirectEventFixture();
    const handler = vi.fn();

    const host = renderConditionalDirectEventOnBackground(backgroundModule, false);
    hydrateConditionalDirectEventFromMainThread(mainModule, false);
    updateEvents = [];

    renderConditionalDirectEventOnBackground(backgroundModule, true, handler);
    const inserted = getSlotChildAt(0, host);
    const eventValue = `${inserted.instanceId}:0:`;

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ...collectRecursiveCreateCommandStream(inserted),
      ElementTemplateUpdateOps.insertNode,
      host.instanceId,
      SLOT_ID,
      inserted.instanceId,
      0,
    ]);
    envManager.switchToBackground();
    expect(inserted.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

    publishEvent(eventValue, { type: 'tap', phase: 'inserted' });

    expect(handler).toHaveBeenCalledWith({ type: 'tap', phase: 'inserted' });
  });

  it('cleans direct event handlers when compiled subtrees are removed', async () => {
    const { backgroundModule, mainModule } = await loadCompiledConditionalDirectEventFixture();
    const handler = vi.fn();

    const host = renderConditionalDirectEventOnBackground(backgroundModule, true, handler);
    hydrateConditionalDirectEventFromMainThread(mainModule, true, handler);
    const removed = getSlotChildAt(0, host);
    const removedSubtreeHandleIds = collectElementTemplateSubtreeHandleIds(removed);
    const eventValue = `${removed.instanceId}:0:`;
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);
    updateEvents = [];

    vi.useFakeTimers();
    try {
      renderConditionalDirectEventOnBackground(backgroundModule, false);

      envManager.switchToMainThread();
      expect(updateEvents.at(-1)?.ops).toEqual([
        ElementTemplateUpdateOps.removeNode,
        host.instanceId,
        SLOT_ID,
        removed.instanceId,
        removedSubtreeHandleIds,
      ]);
      envManager.switchToBackground();
      expect(getEventHandlerForEventValue(eventValue)).toBe(handler);

      vi.advanceTimersByTime(10000);

      expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBeUndefined();
      expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
      publishEvent(eventValue, { type: 'tap', phase: 'removed' });
      expect(handler).not.toHaveBeenCalledWith({ type: 'tap', phase: 'removed' });
    } finally {
      vi.useRealTimers();
    }
  });
});
