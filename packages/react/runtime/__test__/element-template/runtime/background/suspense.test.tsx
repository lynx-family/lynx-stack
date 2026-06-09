import { Component, Fragment, createElement, options } from 'preact';
import type { ComponentChildren, ComponentType } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { root, Suspense, lazy } from '../../../../src/element-template/index.js';
import { loadLazyBundle } from '../../../../src/core/lynx/lazy-bundle.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
  SerializableValue,
} from '../../../../src/element-template/protocol/types.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { clearEtAttrPlanMap } from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

const MARKER_TYPE = '_et_suspense_marker';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

type QueryComponentResult = { code: number; detail: { schema: string } };
type QueryComponentCallback = (result: QueryComponentResult) => void;

interface ParsedCreateTemplateOp {
  op: 'createTemplate';
  handleId: number;
  templateKey: string;
  bundleUrl: string | null | undefined;
  attributeSlots: SerializableValue[] | null | undefined;
  elementSlots: number[][] | null | undefined;
}

interface ParsedInsertNodeOp {
  op: 'insertNode';
  targetId: number;
  elementSlotIndex: number;
  childId: number;
  referenceId: number;
}

interface ParsedRemoveNodeOp {
  op: 'removeNode';
  targetId: number;
  elementSlotIndex: number;
  childId: number;
  removedSubtreeHandleIds: number[];
}

type ParsedOp = ParsedCreateTemplateOp | ParsedInsertNodeOp | ParsedRemoveNodeOp | {
  op: 'setAttribute';
  targetId: number;
  attrSlotIndex: number;
  value: SerializableValue | null;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'];
  let reject: Deferred<T>['reject'];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

function createLazy(
  componentName: string,
): {
  LazyComponent: ComponentType<Record<string, never>>;
  deferred: Deferred<{ default: ComponentType<Record<string, never>> }>;
} {
  const deferred = createDeferred<{ default: ComponentType<Record<string, never>> }>();
  const LazyComponent = lazy(() => deferred.promise) as ComponentType<Record<string, never>>;
  Object.defineProperty(LazyComponent, 'name', { value: componentName });
  return { LazyComponent, deferred };
}

function getBackgroundRoot(): BackgroundElementTemplateInstance {
  return __root as BackgroundElementTemplateInstance;
}

function getRenderedHost(): BackgroundElementTemplateInstance {
  const host = getBackgroundRoot().firstChild;
  if (!host) {
    throw new Error('Missing rendered host.');
  }
  return host;
}

function Marker({ value }: { value: string }): JSX.Element {
  return createElement(MARKER_TYPE, { attributeSlots: [value] });
}

function collectMarkerValues(instance: BackgroundElementTemplateInstance = getBackgroundRoot()): string[] {
  const markers: string[] = [];
  let child = instance.firstChild;
  while (child) {
    if (child.type === MARKER_TYPE) {
      markers.push(String(child.attributeSlots[0]));
    }
    markers.push(...collectMarkerValues(child));
    child = child.nextSibling;
  }
  return markers;
}

function getMarkerElementByValue(
  rootInstance: BackgroundElementTemplateInstance,
  value: string,
): BackgroundElementTemplateInstance {
  const marker = findMarkerElementByValue(rootInstance, value);
  if (!marker) {
    throw new Error(`Missing marker element: ${value}`);
  }
  return marker;
}

function findMarkerElementByValue(
  rootInstance: BackgroundElementTemplateInstance,
  value: string,
): BackgroundElementTemplateInstance | null {
  let child = rootInstance.firstChild;
  while (child) {
    if (child.type === MARKER_TYPE && child.attributeSlots[0] === value) {
      return child;
    }
    const nested = findMarkerElementByValue(child, value);
    if (nested) {
      return nested;
    }
    child = child.nextSibling;
  }
  return null;
}

function getSlotChildren(host: BackgroundElementTemplateInstance): BackgroundElementTemplateInstance[] {
  return host.elementSlots[0] ?? [];
}

function markTreeMaterializedByHydration(instance: BackgroundElementTemplateInstance): void {
  instance.markMaterializedByHydration();
  let child = instance.firstChild;
  while (child) {
    markTreeMaterializedByHydration(child);
    child = child.nextSibling;
  }
}

function markRenderedTreeHydrated(): void {
  markTreeMaterializedByHydration(getBackgroundRoot());
  markElementTemplateHydrated();
}

function parseUpdateOps(stream: ElementTemplateUpdateCommandStream): ParsedOp[] {
  const parsed: ParsedOp[] = [];
  let i = 0;
  while (i < stream.length) {
    const op = stream[i++] as number;
    switch (op) {
      case ElementTemplateUpdateOps.createTemplate:
        parsed.push({
          op: 'createTemplate',
          handleId: stream[i++] as number,
          templateKey: stream[i++] as string,
          bundleUrl: stream[i++] as string | null | undefined,
          attributeSlots: stream[i++] as SerializableValue[] | null | undefined,
          elementSlots: stream[i++] as number[][] | null | undefined,
        });
        break;
      case ElementTemplateUpdateOps.setAttribute:
        parsed.push({
          op: 'setAttribute',
          targetId: stream[i++] as number,
          attrSlotIndex: stream[i++] as number,
          value: stream[i++] as SerializableValue | null,
        });
        break;
      case ElementTemplateUpdateOps.insertNode:
        parsed.push({
          op: 'insertNode',
          targetId: stream[i++] as number,
          elementSlotIndex: stream[i++] as number,
          childId: stream[i++] as number,
          referenceId: stream[i++] as number,
        });
        break;
      case ElementTemplateUpdateOps.removeNode:
        parsed.push({
          op: 'removeNode',
          targetId: stream[i++] as number,
          elementSlotIndex: stream[i++] as number,
          childId: stream[i++] as number,
          removedSubtreeHandleIds: stream[i++] as number[],
        });
        break;
      default:
        throw new Error(`Unsupported test opcode: ${String(op)}`);
    }
  }
  return parsed;
}

async function flushSuspenseRenders(scheduledRenders: Array<() => void>): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
    const callbacks = scheduledRenders.splice(0);
    if (callbacks.length === 0) {
      await Promise.resolve();
      if (scheduledRenders.length === 0) {
        return;
      }
      continue;
    }
    for (const callback of callbacks) {
      callback();
    }
  }
  throw new Error('Suspense render queue did not settle.');
}

function assertNoWrapperChildren(host: BackgroundElementTemplateInstance): void {
  expect(getSlotChildren(host).map(child => child.type)).not.toContain('wrapper');
}

class ErrorBoundary extends Component<
  { children: ComponentChildren },
  { error: unknown }
> {
  override state = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override render(): ComponentChildren {
    return this.state.error ? <Marker value='error' /> : this.props.children;
  }
}

describe('ElementTemplate Suspense background lifecycle', () => {
  const envManager = new ElementTemplateEnvManager();
  let scheduledRenders: Array<() => void> = [];
  let previousDebounceRendering: typeof options.debounceRendering;
  let updateEvents: ElementTemplateUpdateCommitContext[] = [];
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };

  beforeEach(() => {
    previousDebounceRendering = options.debounceRendering;
    scheduledRenders = [];
    options.debounceRendering = (callback) => {
      scheduledRenders.push(callback);
    };

    vi.clearAllMocks();
    clearEtAttrPlanMap();
    resetElementTemplateCommitState();
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    updateEvents = [];
    envManager.resetEnv('background');
    installElementTemplateCommitHook();

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
    options.debounceRendering = previousDebounceRendering;
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
    resetElementTemplateCommitState();
  });

  it('inserts resolved content between stable siblings when fallback is null', async () => {
    const { LazyComponent, deferred } = createLazy('LazyMiddle');

    root.render(
      <view>
        <Marker value='before' />
        <Suspense fallback={null}>
          <LazyComponent />
        </Suspense>
        <Marker value='after' />
      </view>,
    );
    await flushSuspenseRenders(scheduledRenders);

    const host = getRenderedHost();
    const before = getMarkerElementByValue(host, 'before');
    const after = getMarkerElementByValue(host, 'after');
    expect(collectMarkerValues(host)).toEqual(['before', 'after']);
    assertNoWrapperChildren(host);
    markRenderedTreeHydrated();
    updateEvents = [];

    deferred.resolve({ default: () => <Marker value='loaded' /> });
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['before', 'loaded', 'after']);
    assertNoWrapperChildren(host);
    expect(getSlotChildren(host)[0]).toBe(before);
    expect(getSlotChildren(host)[2]).toBe(after);

    envManager.switchToMainThread();
    const ops = parseUpdateOps(updateEvents.at(-1)?.ops ?? []);
    const loaded = getMarkerElementByValue(host, 'loaded');
    expect(ops).toContainEqual({
      op: 'insertNode',
      targetId: host.instanceId,
      elementSlotIndex: 0,
      childId: loaded.instanceId,
      referenceId: after.instanceId,
    });
    expect(ops.filter(op => op.op === 'removeNode')).toEqual([]);
    envManager.switchToBackground();
  });

  it('replaces multiple fallback children with multiple content children without a wrapper', async () => {
    const { LazyComponent, deferred } = createLazy('LazyMulti');

    root.render(
      <view>
        <Marker value='before' />
        <Suspense
          fallback={
            <>
              <Marker value='loading 1' />
              <Marker value='loading 2' />
            </>
          }
        >
          <LazyComponent />
        </Suspense>
        <Marker value='after' />
      </view>,
    );
    await flushSuspenseRenders(scheduledRenders);

    const host = getRenderedHost();
    const fallbackOne = getMarkerElementByValue(host, 'loading 1');
    const fallbackTwo = getMarkerElementByValue(host, 'loading 2');
    const after = getMarkerElementByValue(host, 'after');
    expect(collectMarkerValues(host)).toEqual(['before', 'loading 1', 'loading 2', 'after']);
    assertNoWrapperChildren(host);
    markRenderedTreeHydrated();
    updateEvents = [];

    vi.useFakeTimers();
    try {
      deferred.resolve({
        default: () => (
          <Fragment>
            <Marker value='loaded 1' />
            <Marker value='loaded 2' />
          </Fragment>
        ),
      });
      await flushSuspenseRenders(scheduledRenders);

      expect(collectMarkerValues(host)).toEqual(['before', 'loaded 1', 'loaded 2', 'after']);
      assertNoWrapperChildren(host);

      envManager.switchToMainThread();
      const ops = parseUpdateOps(updateEvents.at(-1)?.ops ?? []);
      const loadedOne = getMarkerElementByValue(host, 'loaded 1');
      const loadedTwo = getMarkerElementByValue(host, 'loaded 2');
      expect(ops.filter(op => op.op === 'removeNode')).toEqual([
        expect.objectContaining({ childId: fallbackOne.instanceId }),
        expect.objectContaining({ childId: fallbackTwo.instanceId }),
      ]);
      expect(ops).toContainEqual(expect.objectContaining({
        op: 'insertNode',
        targetId: host.instanceId,
        childId: loadedOne.instanceId,
        referenceId: after.instanceId,
      }));
      expect(ops).toContainEqual(expect.objectContaining({
        op: 'insertNode',
        targetId: host.instanceId,
        childId: loadedTwo.instanceId,
        referenceId: after.instanceId,
      }));
      envManager.switchToBackground();

      expect(backgroundElementTemplateInstanceManager.get(fallbackOne.instanceId)).toBe(fallbackOne);
      vi.advanceTimersByTime(9999);
      expect(backgroundElementTemplateInstanceManager.get(fallbackOne.instanceId)).toBe(fallbackOne);
      vi.advanceTimersByTime(1);
      expect(backgroundElementTemplateInstanceManager.get(fallbackOne.instanceId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(fallbackTwo.instanceId)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves parallel Suspense boundaries independently', async () => {
    const first = createLazy('FirstLazy');
    const second = createLazy('SecondLazy');

    root.render(
      <view>
        <Suspense fallback={<Marker value='loading 1' />}>
          <first.LazyComponent />
        </Suspense>
        <Suspense fallback={<Marker value='loading 2' />}>
          <second.LazyComponent />
        </Suspense>
      </view>,
    );
    await flushSuspenseRenders(scheduledRenders);

    const host = getRenderedHost();
    expect(collectMarkerValues(host)).toEqual(['loading 1', 'loading 2']);
    markRenderedTreeHydrated();
    updateEvents = [];

    first.deferred.resolve({ default: () => <Marker value='ready 1' /> });
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['ready 1', 'loading 2']);
    const secondFallback = getMarkerElementByValue(host, 'loading 2');
    envManager.switchToMainThread();
    let ops = parseUpdateOps(updateEvents.at(-1)?.ops ?? []);
    expect(ops.filter(op => op.op === 'removeNode')).toHaveLength(1);
    expect(ops).not.toContainEqual(expect.objectContaining({
      op: 'removeNode',
      childId: secondFallback.instanceId,
    }));
    envManager.switchToBackground();

    updateEvents = [];
    second.deferred.resolve({ default: () => <Marker value='ready 2' /> });
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['ready 1', 'ready 2']);
    envManager.switchToMainThread();
    ops = parseUpdateOps(updateEvents.at(-1)?.ops ?? []);
    expect(ops.filter(op => op.op === 'removeNode')).toHaveLength(1);
    expect(ops).toContainEqual(expect.objectContaining({
      op: 'removeNode',
      childId: secondFallback.instanceId,
    }));
    envManager.switchToBackground();
  });

  it('uses the nearest nested Suspense fallback without replacing the outer boundary', async () => {
    const inner = createLazy('InnerLazy');

    root.render(
      <view>
        <Suspense fallback={<Marker value='loading outer' />}>
          <Marker value='outer stable' />
          <Suspense fallback={<Marker value='loading inner' />}>
            <inner.LazyComponent />
          </Suspense>
        </Suspense>
      </view>,
    );
    await flushSuspenseRenders(scheduledRenders);

    const host = getRenderedHost();
    expect(collectMarkerValues(host)).toEqual(['outer stable', 'loading inner']);
    markRenderedTreeHydrated();
    updateEvents = [];

    inner.deferred.resolve({ default: () => <Marker value='inner ready' /> });
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['outer stable', 'inner ready']);
    envManager.switchToMainThread();
    const ops = parseUpdateOps(updateEvents.at(-1)?.ops ?? []);
    expect(ops).not.toContainEqual(expect.objectContaining({
      op: 'createTemplate',
      attributeSlots: ['loading outer'],
    }));
    expect(ops.filter(op => op.op === 'insertNode')).toHaveLength(1);
    envManager.switchToBackground();
  });

  it('routes lazy rejects to ErrorBoundary without an ET-specific error channel', async () => {
    const { LazyComponent, deferred } = createLazy('RejectingLazy');

    root.render(
      <view>
        <ErrorBoundary>
          <Suspense fallback={<Marker value='loading' />}>
            <LazyComponent />
          </Suspense>
        </ErrorBoundary>
      </view>,
    );
    await flushSuspenseRenders(scheduledRenders);

    const host = getRenderedHost();
    const fallback = getMarkerElementByValue(host, 'loading');
    expect(collectMarkerValues(host)).toEqual(['loading']);
    markRenderedTreeHydrated();
    updateEvents = [];

    deferred.reject(new Error('lazy failed'));
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['error']);
    envManager.switchToMainThread();
    const ops = parseUpdateOps(updateEvents.flatMap(event => event.ops));
    expect(ops).toContainEqual(expect.objectContaining({
      op: 'removeNode',
      childId: fallback.instanceId,
    }));
    expect(ops.filter(op => op.op === 'insertNode')).toHaveLength(1);
    envManager.switchToBackground();
  });

  it('does not resurrect a Suspense subtree when lazy resolves after parent unmount', async () => {
    const { LazyComponent, deferred } = createLazy('LateLazy');

    function App({ show }: { show: boolean }): JSX.Element {
      return (
        <view>
          {show
            ? (
              <Suspense fallback={<Marker value='loading' />}>
                <LazyComponent />
              </Suspense>
            )
            : <Marker value='gone' />}
        </view>
      );
    }

    root.render(<App show />);
    await flushSuspenseRenders(scheduledRenders);
    const host = getRenderedHost();
    expect(collectMarkerValues(host)).toEqual(['loading']);
    markRenderedTreeHydrated();

    root.render(<App show={false} />);
    await flushSuspenseRenders(scheduledRenders);
    expect(collectMarkerValues(host)).toEqual(['gone']);
    envManager.switchToMainThread();
    updateEvents = [];
    envManager.switchToBackground();

    deferred.resolve({ default: () => <Marker value='late' /> });
    await flushSuspenseRenders(scheduledRenders);

    expect(collectMarkerValues(host)).toEqual(['gone']);
    envManager.switchToMainThread();
    expect(updateEvents).toEqual([]);
    envManager.switchToBackground();
  });

  it('keeps lazy dynamic bundle create payloads split by bundleUrl and local template id', async () => {
    const lynxWithQuery = lynx as typeof lynx & {
      QueryComponent?: (source: string, callback: QueryComponentCallback) => void;
    };
    const ttWithDynamic = lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: (schema: string) => { default: ComponentType<Record<string, never>> } | undefined;
    };
    const originalQueryComponent = lynxWithQuery.QueryComponent;
    const originalGetDynamicComponentExports = ttWithDynamic.getDynamicComponentExports;
    const queryCallbacks = new Map<string, QueryComponentCallback>();
    const QueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      queryCallbacks.set(source, callback);
    });
    const getDynamicComponentExports = vi.fn((schema: string) => ({
      default: () =>
        createElement(`${schema}:_et_same`, {
          attributeSlots: [schema === 'entry-a' ? 'A' : 'B'],
        }),
    }));
    lynxWithQuery.QueryComponent = QueryComponent;
    ttWithDynamic.getDynamicComponentExports = getDynamicComponentExports;

    try {
      const EntryA = lazy(() => loadLazyBundle('entry-a')) as ComponentType<Record<string, never>>;
      const EntryB = lazy(() => loadLazyBundle('entry-b')) as ComponentType<Record<string, never>>;

      root.render(
        <view>
          <Suspense fallback={<Marker value='loading a' />}>
            <EntryA />
          </Suspense>
          <Suspense fallback={<Marker value='loading b' />}>
            <EntryB />
          </Suspense>
        </view>,
      );
      await flushSuspenseRenders(scheduledRenders);

      const host = getRenderedHost();
      expect(collectMarkerValues(host)).toEqual(['loading a', 'loading b']);
      expect(QueryComponent).toHaveBeenCalledWith('entry-a', expect.any(Function));
      expect(QueryComponent).toHaveBeenCalledWith('entry-b', expect.any(Function));
      markRenderedTreeHydrated();
      updateEvents = [];

      queryCallbacks.get('entry-a')?.({ code: 0, detail: { schema: 'entry-a' } });
      queryCallbacks.get('entry-b')?.({ code: 0, detail: { schema: 'entry-b' } });
      await flushSuspenseRenders(scheduledRenders);

      expect(getDynamicComponentExports).toHaveBeenCalledWith('entry-a');
      expect(getDynamicComponentExports).toHaveBeenCalledWith('entry-b');
      expect(getSlotChildren(host).map(child => child.type)).toEqual(['entry-a:_et_same', 'entry-b:_et_same']);
      envManager.switchToMainThread();
      const creates = parseUpdateOps(updateEvents.flatMap(event => event.ops))
        .filter((op): op is ParsedCreateTemplateOp => op.op === 'createTemplate');
      expect(creates).toEqual(expect.arrayContaining([
        expect.objectContaining({
          templateKey: '_et_same',
          bundleUrl: 'entry-a',
          attributeSlots: ['A'],
        }),
        expect.objectContaining({
          templateKey: '_et_same',
          bundleUrl: 'entry-b',
          attributeSlots: ['B'],
        }),
      ]));
      envManager.switchToBackground();
    } finally {
      if (originalQueryComponent) {
        lynxWithQuery.QueryComponent = originalQueryComponent;
      } else {
        delete lynxWithQuery.QueryComponent;
      }
      if (originalGetDynamicComponentExports) {
        ttWithDynamic.getDynamicComponentExports = originalGetDynamicComponentExports;
      } else {
        delete ttWithDynamic.getDynamicComponentExports;
      }
    }
  });
});
