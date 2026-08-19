import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installElementTemplateCommitHook,
  isElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { installElementTemplateRenderScopeHooks } from '../../../../src/element-template/background/render-scope.js';
import { formatElementTemplateUpdateCommands } from '../../../../src/element-template/debug/alog.js';
import { callDestroyLifetimeFun } from '../../../../src/element-template/native/callDestroyLifetimeFun.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { reloadBackground } from '../../../../src/element-template/native/reload-background.js';
import { reloadMainThread } from '../../../../src/element-template/native/reload-main-thread.js';
import { clearEventState } from '../../../../src/element-template/prop-adapters/event.js';
import { clearRefState } from '../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../src/element-template/protocol/update-event.js';
import * as pageModule from '../../../../src/element-template/runtime/page/page.js';
import * as rootModule from '../../../../src/element-template/runtime/page/root-instance.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  loadCompiledFixturePair,
  type CompiledFixtureModuleExports,
} from '../../test-utils/debug/compiledFixtureModule.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from '../../test-utils/debug/compiledThreadRunner.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { serializeToJSX } from '../../test-utils/debug/serializer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTHORED_PAGE_FIXTURE = path.resolve(__dirname, '../../fixtures/page-compiled/authored-page/index.tsx');

interface AuthoredPageProps {
  onTap?: () => void;
  pageId?: string;
  pageKey?: string;
  pageKeys?: string[];
  pageRef?: unknown;
  refMode?: 'direct' | 'spread';
  withPage?: boolean;
}

interface CompiledAuthoredPageModule extends CompiledFixtureModuleExports {
  App: (props: AuthoredPageProps) => JSX.Element;
}

describe('Compiled authored ET page fixtures', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
  };

  function renderOnBackground(
    moduleExports: CompiledAuthoredPageModule,
    props: AuthoredPageProps,
  ): void {
    const child = renderCompiledFixtureOnBackground(moduleExports, envManager, props);
    if (!child) {
      throw new Error('Missing rendered page child.');
    }
  }

  function waitForPassiveEffects(): Promise<void> {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve);
      });
    });
  }

  async function renderHydratedPair(
    backgroundProps: AuthoredPageProps,
    mainThreadProps: AuthoredPageProps = backgroundProps,
  ): Promise<CompiledAuthoredPageModule> {
    const modules = await loadCompiledFixturePair<CompiledAuthoredPageModule>(AUTHORED_PAGE_FIXTURE);
    renderOnBackground(modules.backgroundModule, backgroundProps);
    renderCompiledFixtureOnMainThread(modules.mainModule, envManager, mainThreadProps);
    expect(isElementTemplateHydrated()).toBe(true);
    envManager.switchToMainThread();
    envManager.switchToBackground();
    await waitForPassiveEffects();
    return modules.backgroundModule;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetElementTemplateCommitState();
    resetElementTemplateHydrationListener();
    clearEtAttrPlanMap();
    clearEventState();
    clearRefState();
    updateEvents = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);
    installElementTemplateRenderScopeHooks();
    installElementTemplateCommitHook();
    installElementTemplateHydrationListener();

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  it('preserves authored page key as compiled VNode reconciliation metadata', async () => {
    const { backgroundModule } = await loadCompiledFixturePair<CompiledAuthoredPageModule>(AUTHORED_PAGE_FIXTURE);

    const vnode = backgroundModule.App({ pageKey: 'stable-page' }) as unknown as {
      key?: unknown;
      props: Record<string, unknown>;
    };

    expect(vnode.key).toBe('stable-page');
    expect(vnode.props).not.toHaveProperty('key');
  });

  it('reports multiple authored pages mounted concurrently on background', async () => {
    const { backgroundModule } = await loadCompiledFixturePair<CompiledAuthoredPageModule>(AUTHORED_PAGE_FIXTURE);
    const originalReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      renderOnBackground(backgroundModule, { pageKeys: ['first-page', 'second-page'], withPage: true });
      await waitForPassiveEffects();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Attempt to render more than one `<page />`, which is not supported.',
      }));
    } finally {
      lynx.reportError = originalReportError;
    }
  });

  it('keeps tracking a duplicate after the first authored page unmounts', async () => {
    const { backgroundModule } = await loadCompiledFixturePair<CompiledAuthoredPageModule>(AUTHORED_PAGE_FIXTURE);
    const originalReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      renderOnBackground(backgroundModule, { pageKeys: ['first-page', 'second-page'], withPage: true });
      await waitForPassiveEffects();
      expect(reportError).toHaveBeenCalledTimes(1);
      reportError.mockClear();

      renderOnBackground(backgroundModule, { pageKeys: ['second-page'], withPage: true });
      await waitForPassiveEffects();
      renderOnBackground(backgroundModule, { pageKeys: ['second-page', 'third-page'], withPage: true });
      await waitForPassiveEffects();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Attempt to render more than one `<page />`, which is not supported.',
      }));
    } finally {
      lynx.reportError = originalReportError;
    }
  });

  it('does not report a keyed authored page replacement as multiple pages', async () => {
    const { backgroundModule } = await loadCompiledFixturePair<CompiledAuthoredPageModule>(AUTHORED_PAGE_FIXTURE);
    const originalReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      renderOnBackground(backgroundModule, { pageKey: 'first-page', withPage: true });
      await waitForPassiveEffects();
      reportError.mockClear();

      renderOnBackground(backgroundModule, { pageKey: 'replacement-page', withPage: true });
      await waitForPassiveEffects();

      expect(reportError).not.toHaveBeenCalled();
    } finally {
      lynx.reportError = originalReportError;
    }
  });

  it('reconciles background page attrs when main-thread first screen differs', async () => {
    await renderHydratedPair(
      { pageId: 'background', withPage: true },
      { pageId: 'main-thread', withPage: true },
    );

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)).toMatchObject({
      isHydration: true,
      ops: [
        ElementTemplateUpdateOps.setAttribute,
        0,
        0,
        {
          id: 'background',
          class: 'screen',
          bindtap: null,
        },
      ],
    });
    expect(pageModule.__page).toMatchObject({
      attributes: expect.objectContaining({ id: 'background' }),
    });
    envManager.switchToBackground();
  });

  afterEach(() => {
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    resetElementTemplatePatchListener();
    envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    clearEventState();
    clearRefState();
    envManager.setUseElementTemplate(false);
  });

  it('updates, clears, and remounts compiled authored page state on reserved target 0', async () => {
    const onTap = vi.fn();
    const pageRef = vi.fn();
    const pageProps = { onTap, pageId: 'screen', pageRef, withPage: true };
    const backgroundModule = await renderHydratedPair(pageProps);

    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(rootModule.__root);
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBe(onTap);
    expect(pageRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=0-0]',
    }));

    expect(__SerializeElementTemplate).toHaveBeenCalledTimes(1);
    expect(__SerializeElementTemplate).toHaveBeenCalledWith(pageModule.__page);

    envManager.switchToMainThread();
    expect(pageModule.__page).toMatchObject({
      type: 'page',
      attributes: expect.objectContaining({
        id: 'screen',
        class: 'screen',
      }),
    });
    expect(updateEvents.at(-1)?.isHydration).toBe(true);
    expect(updateEvents.at(-1)?.ops).toEqual([]);
    envManager.switchToBackground();

    pageRef.mockClear();
    updateEvents = [];
    const nextOnTap = vi.fn();
    renderOnBackground(backgroundModule, { ...pageProps, onTap: nextOnTap });

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBe(nextOnTap);
    expect(pageRef).not.toHaveBeenCalled();

    renderOnBackground(backgroundModule, { ...pageProps, onTap: nextOnTap, pageId: 'next' });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      0,
      0,
      {
        id: 'next',
        class: 'screen',
        bindtap: '0:0:bindtap',
        ref: '0-0',
      },
    ]);
    expect(pageModule.__page).toMatchObject({
      attributes: expect.objectContaining({ id: 'next' }),
    });
    envManager.switchToBackground();

    updateEvents = [];
    renderOnBackground(backgroundModule, { ...pageProps, onTap: nextOnTap, withPage: false });

    envManager.switchToMainThread();
    expect(formatElementTemplateUpdateCommands(updateEvents.at(-1)?.ops)).toEqual([
      {
        op: 'setAttribute',
        targetId: 0,
        attrSlotIndex: 0,
        value: null,
      },
      {
        op: 'removeNode',
        targetId: 0,
        elementSlotIndex: 0,
        childId: -1,
        removedSubtreeHandleIds: [-1],
      },
      {
        op: 'createTemplate',
        handleId: 3,
        templateKey: expect.any(String),
        bundleUrl: null,
        attributeSlots: [],
        elementSlots: [],
      },
      {
        op: 'insertNode',
        targetId: 0,
        elementSlotIndex: 0,
        childId: 3,
        referenceId: 0,
      },
    ]);
    expect(serializeToJSX(pageModule.__page)).toContain('without page');
    expect(serializeToJSX(pageModule.__page)).not.toContain('child');
    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBeUndefined();
    expect(pageRef).toHaveBeenCalledWith(null);

    const remountOnTap = vi.fn();
    const remountRef = vi.fn();
    updateEvents = [];
    renderOnBackground(backgroundModule, {
      onTap: remountOnTap,
      pageId: 'remounted',
      pageRef: remountRef,
      withPage: true,
    });

    envManager.switchToMainThread();
    expect(formatElementTemplateUpdateCommands(updateEvents.at(-1)?.ops)).toEqual([
      {
        op: 'removeNode',
        targetId: 0,
        elementSlotIndex: 0,
        childId: 3,
        removedSubtreeHandleIds: [3],
      },
      {
        op: 'setAttribute',
        targetId: 0,
        attrSlotIndex: 0,
        value: {
          id: 'remounted',
          class: 'screen',
          bindtap: '0:0:bindtap',
          ref: '0-0',
        },
      },
      {
        op: 'createTemplate',
        handleId: 4,
        templateKey: expect.any(String),
        bundleUrl: null,
        attributeSlots: [],
        elementSlots: [],
      },
      {
        op: 'insertNode',
        targetId: 0,
        elementSlotIndex: 0,
        childId: 4,
        referenceId: 0,
      },
    ]);
    expect(serializeToJSX(pageModule.__page)).toContain('child');
    expect(serializeToJSX(pageModule.__page)).not.toContain('without page');
    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBe(remountOnTap);
    expect(remountRef).toHaveBeenCalledWith(expect.objectContaining({ selector: '[ref=0-0]' }));
  });

  it.each(['direct', 'spread'] as const)(
    'delivers compiled %s page refs through typed attributes',
    async refMode => {
      const backgroundPageRef = vi.fn();
      const mainThreadPageRef = vi.fn();

      await renderHydratedPair(
        { pageRef: backgroundPageRef, refMode, withPage: true },
        { pageRef: mainThreadPageRef, refMode, withPage: true },
      );

      expect(backgroundPageRef).toHaveBeenCalledWith(expect.objectContaining({
        selector: '[ref=0-0]',
      }));
      expect(mainThreadPageRef).not.toHaveBeenCalled();
      envManager.switchToMainThread();
      expect(pageModule.__page).toMatchObject({
        attributes: expect.objectContaining({ ref: '0-0' }),
      });
      envManager.switchToBackground();
    },
  );

  it.each(['direct', 'spread'] as const)(
    'detaches the old compiled %s page ref before attaching its replacement',
    async refMode => {
      const firstRef = vi.fn();
      const mainThreadRef = vi.fn();
      const replacementRef = vi.fn();
      const backgroundModule = await renderHydratedPair(
        {
          pageRef: firstRef,
          refMode,
          withPage: true,
        },
        {
          pageRef: mainThreadRef,
          refMode,
          withPage: true,
        },
      );

      renderOnBackground(backgroundModule, {
        pageRef: replacementRef,
        refMode,
        withPage: true,
      });

      expect(firstRef).toHaveBeenLastCalledWith(null);
      expect(replacementRef).toHaveBeenCalledWith(expect.objectContaining({
        selector: '[ref=0-0]',
      }));
      expect(mainThreadRef).not.toHaveBeenCalled();
      expect(firstRef.mock.invocationCallOrder.at(-1)).toBeLessThan(
        replacementRef.mock.invocationCallOrder[0]!,
      );
    },
  );

  it('reloads from current physical page state after a target-0 replacement', async () => {
    const pageProps = { pageId: 'before-replacement', withPage: true };
    const backgroundModule = await renderHydratedPair(pageProps);

    renderOnBackground(backgroundModule, { ...pageProps, withPage: false });
    renderOnBackground(backgroundModule, {
      ...pageProps,
      pageId: 'background-replacement',
    });

    envManager.switchToMainThread();
    const patchedPage = __SerializeElementTemplate(pageModule.__page) as {
      attributes?: { id?: string } | null;
      elementSlots?: Array<Array<{ uid: number | string }> | null | undefined>;
    };
    expect(patchedPage.attributes?.id).toBe('background-replacement');
    expect(patchedPage.elementSlots?.[0]).toHaveLength(1);
    const patchedRootUid = patchedPage.elementSlots?.[0]?.[0]?.uid;
    expect(patchedRootUid).toBeDefined();
    expect(serializeToJSX(pageModule.__page)).toContain('child');

    envManager.switchToBackground();
    (rootModule.__root as unknown as { __jsx: unknown }).__jsx = backgroundModule.App(pageProps);
    reloadBackground({});
    expect(isElementTemplateHydrated()).toBe(false);

    envManager.switchToMainThread();
    updateEvents = [];
    vi.mocked(__SerializeElementTemplate).mockClear();
    reloadMainThread({}, { reloadTemplate: true });
    expect(__SerializeElementTemplate).toHaveBeenCalledTimes(2);
    const cleanupSnapshot = vi.mocked(__SerializeElementTemplate).mock.results[0]?.value as {
      attributes?: { id?: string } | null;
      elementSlots?: Array<Array<{ uid: number | string }> | null | undefined>;
    };
    expect(cleanupSnapshot.attributes?.id).toBe('background-replacement');
    expect(cleanupSnapshot.elementSlots?.[0]?.map(root => root.uid)).toContain(patchedRootUid);
    const reloadEnvelope = vi.mocked(__SerializeElementTemplate).mock.results[1]?.value as {
      attributes?: { id?: string } | null;
      elementSlots?: Array<Array<{ uid: number | string }> | null | undefined>;
    };
    expect(reloadEnvelope.attributes?.id).toBe('before-replacement');
    expect(reloadEnvelope.elementSlots?.[0]).toHaveLength(1);
    expect(reloadEnvelope.elementSlots?.[0]?.map(root => root.uid)).not.toContain(patchedRootUid);
    envManager.switchToBackground();
    expect(isElementTemplateHydrated()).toBe(true);

    envManager.switchToMainThread();
    const reloadedPage = __SerializeElementTemplate(pageModule.__page) as {
      attributes?: { id?: string } | null;
      elementSlots?: Array<Array<{ uid: number | string }> | null | undefined>;
    };
    expect(reloadedPage.attributes?.id).toBe('before-replacement');
    expect(reloadedPage.elementSlots?.[0]).toHaveLength(1);
    expect(reloadedPage.elementSlots?.[0]?.map(root => root.uid)).not.toContain(patchedRootUid);
    expect(serializeToJSX(pageModule.__page)).toContain('child');
    expect(updateEvents.at(-1)).toMatchObject({
      isHydration: true,
      ops: [],
    });
    envManager.switchToBackground();
  });

  it('clears compiled page event and ref state on background destroy', async () => {
    const onTap = vi.fn();
    const pageRef = vi.fn();
    await renderHydratedPair({ onTap, pageId: 'screen', pageRef, withPage: true });

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBe(onTap);
    pageRef.mockClear();

    callDestroyLifetimeFun();

    expect(isElementTemplateHydrated()).toBe(false);
    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBeNull();
    expect(pageRef).toHaveBeenCalledWith(null);
  });

  it('rebinds compiled page state after reload and accepts later updates', async () => {
    const pageProps = { pageId: 'before-reload', withPage: true };
    const backgroundModule = await renderHydratedPair(pageProps);
    const oldBackgroundRoot = rootModule.__root;

    reloadBackground({});
    expect(rootModule.__root).not.toBe(oldBackgroundRoot);

    envManager.switchToMainThread();
    reloadMainThread({}, { reloadTemplate: true });
    envManager.switchToBackground();
    expect(isElementTemplateHydrated()).toBe(true);
    envManager.switchToMainThread();
    envManager.switchToBackground();

    updateEvents = [];
    renderOnBackground(backgroundModule, { ...pageProps, pageId: 'after-reload' });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      0,
      0,
      {
        id: 'after-reload',
        class: 'screen',
        bindtap: null,
        ref: null,
      },
    ]);
    expect(pageModule.__page).toMatchObject({
      attributes: expect.objectContaining({ id: 'after-reload' }),
    });
    envManager.switchToBackground();
  });
});
