import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, vi } from 'vitest';
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
import { backgroundElementTemplateInstanceManager } from '../../../../../src/element-template/background/manager.js';
import { root } from '../../../../../src/element-template/index.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import { compileFixtureSource } from '../../../test-utils/debug/compiledFixtureCompiler.js';
import {
  loadCompiledFixtureModule,
  type CompiledFixtureModuleExports,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import { primeCompiledFixtureTemplates } from '../../../test-utils/debug/compiledFixtureRegistry.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';
import { runFixtureTests } from '../../../test-utils/debug/fixtureRunner.js';
import { serializeBackgroundTree } from '../../../test-utils/debug/serializer.js';

declare const renderPage: () => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures/background/update');
const SLOT_ID = 0;

interface CompiledKeyedListModule extends CompiledFixtureModuleExports {
  App: (props: { items: string[] }) => JSX.Element;
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = (__root as BackgroundElementTemplateInstance).firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

function getSlotChildren(host = getRenderedHost()): BackgroundElementTemplateInstance[] {
  return host.elementSlots[SLOT_ID] ?? [];
}

function getSlotChildAt(
  index: number,
  host = getRenderedHost(),
): BackgroundElementTemplateInstance {
  const child = getSlotChildren(host)[index];
  if (!child) {
    throw new Error(`Missing slot child at ${index}.\n${serializeBackgroundTree(host)}`);
  }
  return child;
}

describe('Compiled background Preact updates', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  async function loadCompiledFixture(sourcePath: string): Promise<{
    backgroundModule: CompiledKeyedListModule;
    mainModule: CompiledKeyedListModule;
  }> {
    const mainArtifact = await compileFixtureSource(sourcePath, { target: 'LEPUS' });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule<CompiledKeyedListModule>(mainArtifact);

    const backgroundArtifact = await compileFixtureSource(sourcePath, { target: 'JS' });
    const backgroundModule = await loadCompiledFixtureModule<CompiledKeyedListModule>(backgroundArtifact);

    return { backgroundModule, mainModule };
  }

  function renderCompiledOnBackground(
    moduleExports: CompiledKeyedListModule,
    items: readonly string[],
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, { items: [...items] }));
    return getRenderedHost();
  }

  function hydrateFromMainThread(
    moduleExports: CompiledKeyedListModule,
    items: readonly string[],
  ): BackgroundElementTemplateInstance {
    const host = getRenderedHost();

    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, { items: [...items] }));
    renderPage();
    envManager.switchToBackground();

    return host;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
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

  describe('keyed moves', () => {
    runFixtureTests({
      fixturesRoot: FIXTURES_DIR,
      async run({ fixtureDir }) {
        const sourcePath = path.join(fixtureDir, 'index.tsx');
        const { backgroundModule, mainModule } = await loadCompiledFixture(sourcePath);

        const host = renderCompiledOnBackground(backgroundModule, ['a', 'b', 'c']);
        hydrateFromMainThread(mainModule, ['a', 'b', 'c']);
        const first = getSlotChildAt(0, host);
        const second = getSlotChildAt(1, host);
        const moved = getSlotChildAt(2, host);
        updateEvents = [];

        renderCompiledOnBackground(backgroundModule, ['c', 'a', 'b']);

        envManager.switchToMainThread();
        expect(updateEvents.at(-1)?.ops).toEqual([
          ElementTemplateUpdateOps.insertNode,
          host.instanceId,
          SLOT_ID,
          moved.instanceId,
          first.instanceId,
        ]);
        envManager.switchToBackground();
        expect(getSlotChildren(host)).toEqual([moved, first, second]);
      },
    });
  });

  describe('removals', () => {
    runFixtureTests({
      fixturesRoot: FIXTURES_DIR,
      async run({ fixtureDir }) {
        const sourcePath = path.join(fixtureDir, 'index.tsx');
        const { backgroundModule, mainModule } = await loadCompiledFixture(sourcePath);
        const host = renderCompiledOnBackground(backgroundModule, ['keep', 'remove']);
        hydrateFromMainThread(mainModule, ['keep', 'remove']);
        const removed = getSlotChildAt(1, host);
        updateEvents = [];

        vi.useFakeTimers();
        try {
          renderCompiledOnBackground(backgroundModule, ['keep']);

          envManager.switchToMainThread();
          expect(updateEvents.at(-1)?.ops).toEqual([
            ElementTemplateUpdateOps.removeNode,
            host.instanceId,
            SLOT_ID,
            removed.instanceId,
            [removed.instanceId],
          ]);
          envManager.switchToBackground();
          expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBe(removed);

          vi.advanceTimersByTime(9999);
          expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBe(removed);

          vi.advanceTimersByTime(1);
          expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBeUndefined();
        } finally {
          vi.useRealTimers();
        }
      },
    });
  });

  describe('remove and re-add', () => {
    runFixtureTests({
      fixturesRoot: FIXTURES_DIR,
      async run({ fixtureDir }) {
        const sourcePath = path.join(fixtureDir, 'index.tsx');
        const { backgroundModule, mainModule } = await loadCompiledFixture(sourcePath);
        const host = renderCompiledOnBackground(backgroundModule, ['keep', 'again']);
        hydrateFromMainThread(mainModule, ['keep', 'again']);
        const keep = getSlotChildAt(0, host);
        const removed = getSlotChildAt(1, host);
        updateEvents = [];

        vi.useFakeTimers();
        try {
          renderCompiledOnBackground(backgroundModule, ['keep']);
          envManager.switchToMainThread();
          expect(updateEvents.at(-1)?.ops).toEqual([
            ElementTemplateUpdateOps.removeNode,
            host.instanceId,
            SLOT_ID,
            removed.instanceId,
            [removed.instanceId],
          ]);
          envManager.switchToBackground();

          updateEvents = [];
          renderCompiledOnBackground(backgroundModule, ['keep', 'again']);
          const current = getSlotChildAt(1, host);
          expect(current).not.toBe(removed);
          envManager.switchToMainThread();
          expect(updateEvents.at(-1)?.ops).toEqual([
            ElementTemplateUpdateOps.createTemplate,
            current.instanceId,
            current.type,
            null,
            current.attributeSlots,
            current.elementSlots.map(children => children.map(child => child.instanceId)),
            ElementTemplateUpdateOps.insertNode,
            host.instanceId,
            SLOT_ID,
            current.instanceId,
            0,
          ]);
          envManager.switchToBackground();

          vi.advanceTimersByTime(10000);

          expect(backgroundElementTemplateInstanceManager.get(current.instanceId)).toBe(current);
          expect(backgroundElementTemplateInstanceManager.get(removed.instanceId)).toBeUndefined();
          expect(getSlotChildren(host)).toEqual([keep, current]);
        } finally {
          vi.useRealTimers();
        }
      },
    });
  });
});
