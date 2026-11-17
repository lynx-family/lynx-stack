// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement, render } from 'preact';
import type { ComponentType, ContainerNode, VNode } from 'preact';

import { getReloadVersion } from '../core/reload-version.js';
import { __root, enableTransferMode, warnRootRenderOnTransferPage } from '../root.js';
import { CHILDREN, PARENT } from '../shared/render-constants.js';
import { genCommitTaskId, replaceCommitHook } from './lifecycle/patch/commit.js';
import type { PatchList, PatchOptions } from './lifecycle/patch/commit.js';
import { updateMainThread } from './lifecycle/patch/updateMainThread.js';
import { __pendingListUpdates } from './list/pendingListUpdates.js';
import { enablePublishEvent } from './lynx/tt.js';
import { hydrate as hydrateMainThread } from './renderToOpcodes/hydrate.js';
import { render as renderFirstFrame } from './renderToOpcodes/index.js';
import { BackgroundSnapshotInstance, hydrate } from './snapshot/backgroundSnapshot.js';
import { __page, __pageId, setupPage } from './snapshot/definition.js';
import { SnapshotInstance } from './snapshot/snapshot.js';
import { snapshotInstanceManager } from './snapshot/snapshotInstanceManager.js';
import type { SerializedSnapshotInstance } from './snapshot/types.js';

type TransferProps = Record<string, unknown>;
interface Scope {
  transferId: string;
}
type CreateTransferEvent = Scope & { componentName: string; initialProps: TransferProps };
type SetTransferPropsEvent = Scope & { props: TransferProps };
type TransferFirstFrame = Scope & { snapshot: string };
type TransferCommit = Scope & {
  version: number;
  seq: number;
  kind: 'hydrate' | 'update';
  patchList: PatchList;
  patchOptions: PatchOptions;
};
type TransferCommitResult = Scope & { version: number; seq: number; status: 'applied' | 'disposed' | 'failed' };
type ComponentProvider = (scope: Scope) => ComponentType<TransferProps>;

interface Pending {
  packet: TransferCommit;
  finish: () => void;
}
interface Instance {
  init: CreateTransferEvent;
  Component: ComponentType<TransferProps>;
  props: TransferProps;
  phase: 'waiting' | 'hydrating' | 'live' | 'disposed';
  /** Counts props updates; each one re-syncs the first frame and restarts `seq`. */
  version: number;
  seq: number;
  main?: SnapshotInstance;
  element?: FiberElement;
  background?: BackgroundSnapshotInstance;
  queue: Pending[];
  inFlight?: Pending | undefined;
}
interface EventTarget {
  addEventListener(type: string, listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { data: unknown }) => void): void;
}

function forgetIds(node: SnapshotInstance): void {
  snapshotInstanceManager.values.delete(node.__id);
  node.childNodes.forEach(child => forgetIds(child));
}

const providers = new Map<string, ComponentProvider>();
let initialized = false;

function initialize(): void {
  const mts = typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__;
  const instances = new Map<string, Instance>();
  const frames = new Map<string, TransferFirstFrame>();
  const disposed = new Set<string>();
  const owners = new WeakMap<object, Instance>();
  const removers: (() => void)[] = [];
  const pendingCreates: CreateTransferEvent[] = [];
  let pageReady = !mts;
  let active: Instance | undefined;

  function send(type: string, data: unknown) {
    const target = mts ? lynx.getJSContext() : lynx.getCoreContext();
    target.dispatchEvent({ type, data: JSON.stringify(data) });
  }
  function listen<T>(target: EventTarget, type: string, listener: (data: T) => void) {
    const callback = (event: { data: unknown }) => {
      try {
        listener((typeof event.data === 'string' ? JSON.parse(event.data) : event.data) as T);
      } catch (error) {
        lynx.reportError(error as Error);
      }
    };
    target.addEventListener(type, callback);
    removers.push(() => target.removeEventListener(type, callback));
  }
  function withInstance<T>(instance: Instance, fn: () => T): T {
    const previous = active;
    active = instance;
    try {
      return fn();
    } finally {
      active = previous;
    }
  }
  function findOwner(vnode: VNode): Instance | undefined {
    if (active) return active;
    for (let node: VNode | undefined = vnode; node; node = (node as unknown as Record<string, VNode>)[PARENT]) {
      const owner = owners.get(node);
      if (owner) return owner;
    }
    return undefined;
  }

  function renderBackground(instance: Instance) {
    const container = instance.background as unknown as ContainerNode;
    withInstance(instance, () => render(createElement(instance.Component, instance.props), container));
    const vnode = (container as unknown as Record<string, object | undefined>)[CHILDREN];
    if (vnode) owners.set(vnode, instance);
  }
  /** Renders the first frame; later frames take over the elements of the previous one, like a template reload. */
  function renderMain(instance: Instance) {
    const previous = instance.main;
    const root = new SnapshotInstance('root');
    if (!previous) {
      root.__elements = [instance.element!];
      root.__element_root = instance.element;
      instance.main = root;
    }
    try {
      withInstance(instance, () => {
        renderFirstFrame(createElement(instance.Component, instance.props), undefined, root);
      });
    } catch (error) {
      if (previous) forgetIds(root);
      dispose(instance.init);
      throw error;
    }
    if (previous) {
      hydrateMainThread(previous, root, { skipUnRef: true });
      forgetIds(previous);
      instance.main = root;
    }
    __pendingListUpdates.flush();
    __FlushElementTree(__page, {});
    send('__TransferFirstFrame', { transferId: instance.init.transferId, snapshot: JSON.stringify(root) });
  }
  /** Releases the commits of an instance that will never be applied. */
  function release(instance: Instance) {
    instance.inFlight?.finish();
    instance.inFlight = undefined;
    instance.queue.forEach(item => item.finish());
    instance.queue.length = 0;
  }
  function pump(instance: Instance) {
    if (instance.inFlight || instance.phase === 'disposed') return;
    instance.inFlight = instance.queue.shift();
    if (instance.inFlight) send('__TransferCommit', instance.inFlight.packet);
  }
  function enqueue(
    instance: Instance,
    kind: TransferCommit['kind'],
    patchList: PatchList,
    patchOptions: PatchOptions,
    finish: () => void,
  ) {
    const packet = {
      transferId: instance.init.transferId,
      version: instance.version,
      seq: ++instance.seq,
      kind,
      patchList,
      patchOptions,
    };
    instance.queue.push({ packet, finish });
    pump(instance);
  }
  function acceptFrame(frame: TransferFirstFrame) {
    if (disposed.has(frame.transferId)) return;
    const instance = instances.get(frame.transferId);
    if (!instance) {
      frames.set(frame.transferId, frame);
      return;
    }
    if (instance.phase !== 'waiting') return;
    instance.phase = 'hydrating';
    const serialized = JSON.parse(frame.snapshot) as SerializedSnapshotInstance;
    const snapshotPatch = withInstance(instance, () => hydrate(serialized, instance.background!));
    enqueue(
      instance,
      'hydrate',
      { patchList: [{ id: genCommitTaskId(), snapshotPatch }] },
      { reloadVersion: getReloadVersion(), isHydration: true },
      () => {
        if (instance.phase === 'hydrating') instance.phase = 'live';
      },
    );
  }

  function create(init: CreateTransferEvent) {
    if (disposed.has(init.transferId) || instances.has(init.transferId)) return;
    if (!pageReady) {
      pendingCreates.push(init);
      return;
    }
    const provider = providers.get(init.componentName);
    if (!provider) throw new Error(`Unknown transfer component: ${init.componentName}`);
    const instance: Instance = {
      init,
      Component: provider({ transferId: init.transferId }),
      props: init.initialProps,
      phase: 'waiting',
      version: 0,
      seq: 0,
      queue: [],
    };
    instances.set(init.transferId, instance);
    if (mts) {
      const element = instance.element = __CreateElement('transfer-view', __pageId);
      __SetAttribute(element, 'transfer-id', init.transferId);
      __AppendElement(__page, element);
      send('__CreateTransfer', init);
      renderMain(instance);
    } else {
      instance.background = new BackgroundSnapshotInstance('root');
      renderBackground(instance);
      const frame = frames.get(init.transferId);
      if (frame) {
        frames.delete(init.transferId);
        acceptFrame(frame);
      }
    }
  }
  /** Re-renders both threads with the new props and re-syncs the first frame, like a template reload. */
  function setProps(update: SetTransferPropsEvent) {
    const pending = pendingCreates.find(init => init.transferId === update.transferId);
    if (pending) {
      pending.initialProps = update.props;
      return;
    }
    const instance = instances.get(update.transferId);
    if (!instance) return;
    instance.props = update.props;
    instance.version++;
    instance.seq = 0;
    if (mts) {
      send('__SetTransferProps', update);
      renderMain(instance);
      return;
    }
    // Remount like a template reload: state resets and commits wait for the new first frame.
    instance.phase = 'waiting';
    release(instance);
    withInstance(instance, () => render(null, instance.background as unknown as ContainerNode));
    renderBackground(instance);
  }
  function dispose(scope: Scope, notify = true) {
    if (disposed.has(scope.transferId)) return;
    disposed.add(scope.transferId);
    frames.delete(scope.transferId);
    const instance = instances.get(scope.transferId);
    if (instance) {
      instance.phase = 'disposed';
      release(instance);
      if (instance.main) {
        forgetIds(instance.main);
        instance.main.removeChildren();
        __RemoveElement(__page, instance.element!);
        __FlushElementTree(__page, {});
      } else if (instance.background) {
        withInstance(instance, () => render(null, instance.background as unknown as ContainerNode));
        instance.background.tearDown();
      }
      instances.delete(scope.transferId);
    }
    if (notify) send(mts ? '__DestroyTransfer' : '__TransferDisposed', { transferId: scope.transferId });
  }

  // Business code may call `root.render` before registering; the page root never renders on transfer pages.
  if (__root.__jsx !== undefined) {
    warnRootRenderOnTransferPage();
    __root.__jsx = undefined;
    if (!mts) render(null, __root as unknown as ContainerNode);
  }
  enableTransferMode();

  if (mts) {
    listen<[Record<string, unknown>?]>(lynx.getEngine(), '__RenderPage', ([initData]) => {
      lynx.__initData = initData ?? {};
      setupPage(__CreatePage('0', 0));
      (__root as SnapshotInstance).ensureElements();
      __FlushElementTree(__page, {});
      pageReady = true;
      pendingCreates.splice(0).forEach(init => {
        try {
          create(init);
        } catch (error) {
          lynx.reportError(error as Error);
        }
      });
    });
    const native = lynx.getNative();
    listen(native, '__CreateTransfer', create);
    listen(native, '__SetTransferProps', setProps);
    listen<Scope>(native, '__DestroyTransfer', scope => dispose(scope));
    listen<TransferCommit>(lynx.getJSContext(), '__TransferCommit', packet => {
      const instance = instances.get(packet.transferId);
      // Commits rendered before a props update belong to a replaced first frame.
      if (instance && packet.version !== instance.version) return;
      let status: TransferCommitResult['status'] = 'disposed';
      if (instance && instance.phase !== 'disposed') {
        try {
          if (packet.seq !== instance.seq + 1) throw new Error('Transfer commit sequence mismatch');
          updateMainThread({ data: JSON.stringify(packet.patchList), patchOptions: packet.patchOptions });
          instance.seq = packet.seq;
          status = 'applied';
        } catch (error) {
          status = 'failed';
          lynx.reportError(error as Error);
        }
      }
      const { transferId, version, seq } = packet;
      send('__TransferCommitResult', { transferId, version, seq, status });
    });
    listen<Scope>(lynx.getJSContext(), '__TransferDisposed', scope => dispose(scope, false));
  } else {
    // Background commits belong to transfer instances and travel through scoped events.
    replaceCommitHook((vnode, patchList, patchOptions, finish) => {
      const instance = findOwner(vnode);
      if (!instance) {
        finish();
        lynx.reportError(new Error('Commit rendered outside a transfer instance'));
        return;
      }
      if (instance.phase === 'waiting' || instance.phase === 'disposed') {
        finish();
        return;
      }
      enqueue(instance, 'update', patchList, { ...patchOptions, reloadVersion: getReloadVersion() }, finish);
    });
    // Events of hydrated instances dispatch directly; earlier events have no handler and are dropped.
    enablePublishEvent();
    const core = lynx.getCoreContext();
    listen(core, '__CreateTransfer', create);
    listen(core, '__TransferFirstFrame', acceptFrame);
    listen(core, '__SetTransferProps', setProps);
    listen<Scope>(core, '__DestroyTransfer', scope => dispose(scope, false));
    listen<TransferCommitResult>(core, '__TransferCommitResult', result => {
      const instance = instances.get(result.transferId);
      const item = instance?.inFlight;
      if (!instance || !item || item.packet.version !== result.version || item.packet.seq !== result.seq) return;
      instance.inFlight = undefined;
      item.finish();
      if (result.status === 'applied') pump(instance);
      else dispose(instance.init);
    });
  }

  listen(lynx.getNative(), '__DestroyLifetime', () => {
    instances.forEach(instance => dispose(instance.init, false));
    removers.splice(0).forEach(remove => remove());
    if (!mts) replaceCommitHook();
  });
}

/**
 * Registers components that native hosts render as independent transfer instances.
 * Registering the first component turns the page into a transfer page, where `root.render` is ignored.
 * @experimental
 */
export const TransferRegistry = {
  registerComponent(componentName: string, provider: ComponentProvider): void {
    providers.set(componentName, provider);
    if (!initialized) {
      initialized = true;
      initialize();
    }
  },
};
