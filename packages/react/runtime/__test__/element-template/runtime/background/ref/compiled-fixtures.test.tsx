import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createElement, options } from 'preact';
import type { ReactNode } from 'react';
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
import { Component, Suspense, root, useState } from '../../../../../src/element-template/index.js';
import { clearRefState, hasPendingRefs } from '../../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../../src/element-template/protocol/opcodes.js';
import type { ElementTemplateUpdateCommitContext } from '../../../../../src/element-template/protocol/types.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../../src/element-template/protocol/update-event.js';
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
import { resetPerformanceMocks } from '../../../test-utils/mock/performance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIRECT_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/direct-ref/index.tsx');
const FAILED_RENDER_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/failed-render/index.tsx');
const SPREAD_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/spread-ref/index.tsx');
const MULTI_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/multi-ref/index.tsx');
const NAMESPACED_REF_FIXTURE = path.resolve(__dirname, '../../../fixtures/background/ref/unsupported-ref/index.tsx');

interface DirectFixtureProps {
  hostRef?: unknown;
}

interface FailedRenderFixtureProps extends DirectFixtureProps {
  children?: ReactNode;
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
    updateEvents.push(parseElementTemplateUpdateEventPayload(event.data));
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

  function flushAndClearUpdateEvents(): void {
    envManager.switchToMainThread();
    envManager.switchToBackground();
    updateEvents = [];
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

  it('does not attach refs from an uncommitted render on a later empty commit', async () => {
    const { backgroundModule } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const ref = vi.fn();
    const error = new Error('failed child render');
    function ThrowingChild(): never {
      throw error;
    }

    expect(() =>
      renderOnBackground(backgroundModule, {
        hostRef: ref,
        children: createElement(ThrowingChild, {}),
      })
    ).toThrow(error);
    // The existing profiler does not close spans for aborted renders.
    resetPerformanceMocks();
    expect((__root as BackgroundElementTemplateInstance).firstChild).toBeNull();
    expect(ref).not.toHaveBeenCalled();

    root.render(null);

    expect(ref).not.toHaveBeenCalled();
    expect(hasPendingRefs()).toBe(false);
  });

  it('discards a failed state update without losing a committed ref cleanup', async () => {
    const { backgroundModule: { App } } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const cleanup = vi.fn();
    const committedRef = vi.fn(() => cleanup);
    const failedRef = vi.fn();
    const error = new Error('failed state update');
    let update!: () => void;
    function ThrowingChild(): never {
      throw error;
    }
    function UpdatingChild() {
      const [fail, setFail] = useState(false);
      update = () => setFail(true);
      return fail
        ? createElement(App, { hostRef: failedRef, children: createElement(ThrowingChild, {}) })
        : null;
    }

    root.render(createElement(App, { hostRef: committedRef, children: createElement(UpdatingChild, {}) }));
    expect(committedRef).toHaveBeenCalledTimes(1);
    const previousDebounce = options.debounceRendering;
    let rerender!: () => void;
    options.debounceRendering = callback => {
      rerender = callback;
    };
    try {
      update();
      expect(() => rerender()).toThrow(error);
      resetPerformanceMocks();
    } finally {
      options.debounceRendering = previousDebounce;
    }
    expect(failedRef).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();

    root.render(null);

    expect(failedRef).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(committedRef).toHaveBeenCalledTimes(1);
    expect(hasPendingRefs()).toBe(false);
  });

  it.each([
    { hydrated: false, returnsCleanup: false },
    { hydrated: false, returnsCleanup: true },
    { hydrated: true, returnsCleanup: false },
    { hydrated: true, returnsCleanup: true },
  ])('preserves pending old-ref cleanup after a failed replacement: %j', async ({ hydrated, returnsCleanup }) => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const calls: string[] = [];
    const oldRef = vi.fn((value: unknown) => {
      calls.push(value === null ? 'old:null' : 'old:attach');
      return value !== null && returnsCleanup
        ? () => {
          calls.push('old:cleanup');
        }
        : undefined;
    });
    const failedRef = vi.fn();
    const nextRef = vi.fn((value: unknown) => {
      calls.push(value === null ? 'next:null' : 'next:attach');
    });
    const error = new Error('failed ref replacement');
    function ThrowingChild(): never {
      throw error;
    }

    renderOnBackground(backgroundModule, { hostRef: oldRef });
    if (hydrated) {
      hydrateFromMainThread(mainModule, { hostRef: oldRef });
    }
    expect(() =>
      renderOnBackground(backgroundModule, {
        hostRef: failedRef,
        children: createElement(ThrowingChild, {}),
      })
    ).toThrow(error);
    resetPerformanceMocks();
    expect(calls).toEqual(['old:attach']);

    renderOnBackground(backgroundModule, { hostRef: nextRef });

    expect(calls).toEqual(['old:attach', returnsCleanup ? 'old:cleanup' : 'old:null', 'next:attach']);
    expect(failedRef).not.toHaveBeenCalled();
    root.render(null);
    expect(calls).toEqual(['old:attach', returnsCleanup ? 'old:cleanup' : 'old:null', 'next:attach', 'next:null']);
    expect(hasPendingRefs()).toBe(false);
  });

  it.each([false, true])('does not detach an aborted state-update ref on unmount (hydrated: %s)', async (hydrated) => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const { App } = backgroundModule;
    const cleanup = vi.fn();
    const committedRef = vi.fn(() => cleanup);
    const failedRef = vi.fn();
    const error = new Error('failed same-host update');
    let update!: () => void;
    function ThrowingChild(): never {
      throw error;
    }
    function StatefulApp() {
      const [fail, setFail] = useState(false);
      update = () => setFail(true);
      return createElement(App, {
        hostRef: fail ? failedRef : committedRef,
        children: fail ? createElement(ThrowingChild, {}) : null,
      });
    }

    root.render(createElement(StatefulApp, {}));
    if (hydrated) {
      hydrateFromMainThread(mainModule, { hostRef: committedRef });
    }
    const previousDebounce = options.debounceRendering;
    let rerender!: () => void;
    options.debounceRendering = callback => {
      rerender = callback;
    };
    try {
      update();
      expect(() => rerender()).toThrow(error);
      resetPerformanceMocks();
    } finally {
      options.debounceRendering = previousDebounce;
    }
    expect(cleanup).not.toHaveBeenCalled();
    expect(failedRef).not.toHaveBeenCalled();

    root.render(null);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(committedRef).toHaveBeenCalledTimes(1);
    expect(failedRef).not.toHaveBeenCalled();
    expect(hasPendingRefs()).toBe(false);
  });

  it('keeps successful refs when an error boundary handles a sibling render failure', async () => {
    const { backgroundModule: { App } } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const ref = vi.fn();
    const fallbackRef = vi.fn();
    const error = new Error('handled child render');
    class ErrorBoundary extends Component<{ children?: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? createElement(App, { hostRef: fallbackRef }) : this.props.children;
      }
    }
    function ThrowingChild(): never {
      throw error;
    }

    root.render(createElement(App, {
      hostRef: ref,
      children: createElement(ErrorBoundary, {}, createElement(ThrowingChild, {})),
    }));
    expect(ref).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(fallbackRef).toHaveBeenCalledTimes(1);

    root.render(null);
    expect(ref).toHaveBeenLastCalledWith(null);
    expect(fallbackRef).toHaveBeenLastCalledWith(null);
  });

  it('keeps successful refs when Suspense handles a pending sibling', async () => {
    const { backgroundModule: { App } } = await loadCompiledFixture<CompiledAppModule<FailedRenderFixtureProps>>(
      FAILED_RENDER_FIXTURE,
    );
    const ref = vi.fn();
    const fallbackRef = vi.fn();
    const pending = new Promise(() => {});
    function SuspendingChild(): never {
      throw pending;
    }

    root.render(createElement(App, {
      hostRef: ref,
      children: createElement(Suspense, {
        fallback: createElement(App, { hostRef: fallbackRef }),
        children: createElement(SuspendingChild, {}),
      }),
    }));
    expect(ref).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(fallbackRef).toHaveBeenCalledTimes(1);

    root.render(null);
    expect(ref).toHaveBeenLastCalledWith(null);
    expect(fallbackRef).toHaveBeenLastCalledWith(null);
  });

  it.each([false, true])(
    'keeps a reentrant ref attachment after the old batch (same callback: %s)',
    async (sameCallback) => {
      const { backgroundModule: { App } } = await loadCompiledFixture<CompiledAppModule<MultiRefAppProps>>(
        MULTI_REF_FIXTURE,
      );
      const calls: string[] = [];
      const previous = vi.fn((value: unknown) => {
        calls.push(value === null ? 'previous:null' : 'previous:attach');
      });
      const next = sameCallback
        ? previous
        : vi.fn((value: unknown) => {
          calls.push(value === null ? 'next:null' : 'next:attach');
        });
      const first = vi.fn(() => () => {
        calls.push('first:cleanup');
        root.render(createElement(App, { directRef: null, objectRef: next }));
      });

      root.render(createElement(App, { directRef: first, objectRef: previous }));
      root.render(createElement(App, { directRef: null, objectRef: null }));

      const nextName = sameCallback ? 'previous' : 'next';
      expect(calls).toEqual(['previous:attach', 'first:cleanup', 'previous:null', `${nextName}:attach`]);
      root.render(null);
      expect(calls).toEqual([
        'previous:attach',
        'first:cleanup',
        'previous:null',
        `${nextName}:attach`,
        `${nextName}:null`,
      ]);
    },
  );

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
    flushAndClearUpdateEvents();

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
    flushAndClearUpdateEvents();

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
    flushAndClearUpdateEvents();

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

  it('hydrates and updates compiled direct MTRefs while dropping unsupported worklet refs', async () => {
    const { backgroundModule, mainModule } = await loadCompiledFixture<CompiledAppModule<UnsupportedFixtureProps>>(
      NAMESPACED_REF_FIXTURE,
    );
    const mainThreadRef = { _wvid: 7 };
    const workletRef = vi.fn();

    const props = { mainThreadRef, workletRef };
    const host = renderOnBackground(backgroundModule, props);
    expect(host.attributeSlots).toEqual([{ type: 'main-thread-ref', value: mainThreadRef }, null]);

    hydrateFromMainThread(mainModule, props);

    expect(host.attributeSlots).toEqual([{ type: 'main-thread-ref', value: mainThreadRef }, null]);
    expect(workletRef).not.toHaveBeenCalled();

    flushAndClearUpdateEvents();
    const nextMainThreadRef = { _wvid: 8 };
    renderOnBackground(backgroundModule, {
      mainThreadRef: nextMainThreadRef,
      workletRef,
    });

    envManager.switchToMainThread();
    expect(updateEvents.at(-1)?.ops).toEqual([
      ElementTemplateUpdateOps.setMainThreadRef,
      host.instanceId,
      0,
      { type: 'main-thread-ref', value: nextMainThreadRef },
    ]);
    envManager.switchToBackground();
    expect(host.attributeSlots).toEqual([{ type: 'main-thread-ref', value: nextMainThreadRef }, null]);
  });
});
