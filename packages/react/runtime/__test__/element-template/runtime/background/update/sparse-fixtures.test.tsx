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
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
} from '../../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../../src/element-template/protocol/update-event.js';
import { clearEtAttrPlanMap } from '../../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { __root } from '../../../../../src/element-template/runtime/page/root-instance.js';
import {
  type CompiledFixtureModuleExports,
  loadCompiledFixturePair,
} from '../../../test-utils/debug/compiledFixtureModule.js';
import { ElementTemplateEnvManager } from '../../../test-utils/debug/envManager.js';

declare const renderPage: () => void;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../../fixtures/background/update/sparse/compiled-element-slot',
);

interface SparseTemplateAppProps {
  showCard?: boolean;
  showHeader?: boolean;
  items?: string[];
}

interface SparseTemplateModule extends CompiledFixtureModuleExports {
  App: (props: SparseTemplateAppProps) => JSX.Element;
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = (__root as BackgroundElementTemplateInstance).firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

async function loadFixture(): Promise<{
  backgroundModule: SparseTemplateModule;
  mainModule: SparseTemplateModule;
}> {
  return loadCompiledFixturePair<SparseTemplateModule>(path.join(FIXTURE_DIR, 'index.tsx'));
}

describe('Sparse element slot updates', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
  };

  function renderOnBackground(
    moduleExports: SparseTemplateModule,
    props: SparseTemplateAppProps,
  ): BackgroundElementTemplateInstance {
    envManager.switchToBackground();
    root.render(createElement(moduleExports.App, props));
    return getRenderedHost();
  }

  function hydrateFromMainThread(
    moduleExports: SparseTemplateModule,
    props: SparseTemplateAppProps,
  ): void {
    envManager.switchToMainThread();
    root.render(createElement(moduleExports.App, props));
    renderPage();
    envManager.switchToBackground();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
    clearEtAttrPlanMap();
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
    globalThis.__ALOG__ = false;
  });

  it('emits a create patch with sparse element slots when mounting post-hydration', async () => {
    const { backgroundModule, mainModule } = await loadFixture();

    renderOnBackground(backgroundModule, { showCard: false });
    hydrateFromMainThread(mainModule, { showCard: false });
    updateEvents = [];

    renderOnBackground(backgroundModule, { showCard: true, showHeader: false, items: ['body'] });

    envManager.switchToMainThread();
    const ops = updateEvents.at(-1)?.ops as ElementTemplateUpdateCommandStream;
    expect(ops).toBeDefined();

    const sparseCreateIndex = ops.findIndex((value, index) =>
      value === ElementTemplateUpdateOps.createTemplate
      && Array.isArray(ops[index + 5])
      && (ops[index + 5] as unknown[]).length === 2
      && (ops[index + 5] as unknown[])[0] === null
      && (1 in (ops[index + 5] as unknown[]))
    );
    expect(sparseCreateIndex).toBeGreaterThanOrEqual(0);
    const serializedSlots = ops[sparseCreateIndex + 5] as unknown[];
    expect(serializedSlots).toHaveLength(2);
    expect(serializedSlots[0]).toBe(null);
    expect(Array.isArray(serializedSlots[1])).toBe(true);
    expect((serializedSlots[1] as unknown[]).length).toBe(1);
    envManager.switchToBackground();
  });

  it('walks sparse element slots when alog prints the background tree during hydration', async () => {
    globalThis.__ALOG__ = true;
    const alogSpy = vi.fn();
    (console as { alog?: (message: string) => void }).alog = alogSpy;

    const { backgroundModule, mainModule } = await loadFixture();

    renderOnBackground(backgroundModule, { showCard: true, showHeader: false, items: ['body'] });
    hydrateFromMainThread(mainModule, { showCard: true, showHeader: false, items: ['body'] });

    const treeLog = alogSpy.mock.calls.map(args => args[0] as string).find(message =>
      message.includes('BackgroundElementTemplate tree before hydration')
    );
    expect(treeLog).toBeDefined();
    // SparseCard's root template lists only `elementSlots[1]:` because slot 0
    // (the header view's conditional child) is the hole the print loop must skip.
    expect(treeLog!).toMatch(/elementSlots\[1\]:/);
  });
});
