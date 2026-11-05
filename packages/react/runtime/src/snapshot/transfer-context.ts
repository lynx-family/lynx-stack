// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement, render } from 'preact';
import type { ComponentType, ContainerNode, VNode } from 'preact';

import { __root } from '../root.js';
import { CHILDREN, PARENT } from '../shared/render-constants.js';
import { genCommitTaskId, setTransferCommitTransport } from './lifecycle/patch/commit.js';
import type { PatchList, PatchOptions } from './lifecycle/patch/commit.js';
import { takeGlobalSnapshotPatch } from './lifecycle/patch/snapshotPatch.js';
import { updateMainThread } from './lifecycle/patch/updateMainThread.js';
import { render as renderFirstFrame } from './renderToOpcodes/index.js';
import { BackgroundSnapshotInstance, hydrate } from './snapshot/backgroundSnapshot.js';
import { __page, __pageId, setupPage } from './snapshot/definition.js';
import { SnapshotInstance } from './snapshot/snapshot.js';
import { snapshotInstanceManager } from './snapshot/snapshotInstanceManager.js';
import type { SerializedSnapshotInstance } from './snapshot/types.js';

type Props = Record<string, unknown>;
interface Key {
  transferId: string;
  generation: number;
}
interface Scope {
  key: Key;
  reloadVersion: number;
}
type Create = Scope & { componentName: string; initialProps: Props; propsVersion: number };
type Update = Scope & { props: Props; propsVersion: number };
type Frame = Scope & { propsVersion: number; snapshot: string };
type Commit = Scope & { seq: number; kind: 'hydrate' | 'update'; patchList: PatchList; patchOptions: PatchOptions };
type Result = Scope & { seq: number; status: 'applied' | 'disposed' | 'failed' };
interface RecordState {
  init: Create;
  Component: ComponentType<Props>;
  props: Props;
  version: number;
  phase: 'waiting' | 'hydrating' | 'live' | 'disposed';
  main?: SnapshotInstance;
  element?: FiberElement;
  background?: BackgroundSnapshotInstance;
  seq: number;
  queue: { packet: Commit; finish: () => void }[];
  inFlight?: { packet: Commit; finish: () => void } | undefined;
  renders: number;
}

interface TransferRenderContext {
  debug: { thread: string; records: Record<string, { renders: number; version: number; phase: string; seq: number }> };
  registerComponent(name: string, provider: () => ComponentType<Props>): void;
  recordRender(): void;
  dispose(): void;
}

const identity = (key: Key) => `${key.transferId}:${key.generation}`;
const decode = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;

/**
 * Experimental snapshot-only transfer registry for the native chat proof of concept.
 * Each transfer owns a first-frame snapshot, a background render container and a commit queue.
 * @internal
 */
export function createTransferRenderContext(options: { hydrationDelayMs?: number } = {}): TransferRenderContext {
  const mts = typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__;
  const definitions = new Map<string, () => ComponentType<Props>>();
  const records = new Map<string, RecordState>();
  const frames = new Map<string, Frame>();
  const dead = new Set<string>();
  const owners = new WeakMap<object, RecordState>();
  const removers: (() => void)[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const debug = {
    thread: mts ? 'MTS' : 'BTS',
    records: {} as Record<string, { renders: number; version: number; phase: string; seq: number }>,
  };
  let active: RecordState | undefined;
  let pageReady = !mts;
  const pendingCreates: Create[] = [];

  function log(event: string, record?: RecordState, extra?: unknown) {
    if (record) {
      debug.records[identity(record.init.key)] = {
        renders: record.renders,
        version: record.version,
        phase: record.phase,
        seq: record.seq,
      };
    }
    console.log('[TransferProtocol]', mts ? 'MTS' : 'BTS', event, record ? identity(record.init.key) : '', extra ?? '');
  }
  function send(type: string, data: unknown) {
    const target = mts ? lynx.getJSContext() : lynx.getCoreContext();
    target.dispatchEvent({ type, data: JSON.stringify(data) });
  }
  function listen(
    target: {
      addEventListener(type: string, listener: (event: { data: unknown }) => void): void;
      removeEventListener(type: string, listener: (event: { data: unknown }) => void): void;
    },
    type: string,
    listener: (data: unknown) => void,
  ) {
    const callback = (event: { data: unknown }) => listener(decode(event.data));
    target.addEventListener(type, callback);
    removers.push(() => target.removeEventListener(type, callback));
  }
  function withRecord<T>(record: RecordState, fn: () => T): T {
    const previous = active;
    active = record;
    try {
      return fn();
    } finally {
      active = previous;
    }
  }
  function findOwner(vnode: unknown): RecordState | undefined {
    if (active) return active;
    let node = vnode as VNode | undefined;
    while (node) {
      const found = owners.get(node);
      if (found) return found;
      node = (node as unknown as Record<string, VNode>)[PARENT];
    }
    return undefined;
  }
  function renderBackground(record: RecordState) {
    withRecord(
      record,
      () => render(createElement(record.Component, record.props), record.background as unknown as ContainerNode),
    );
    const vnode = (record.background as unknown as Record<string, object>)[CHILDREN];
    if (vnode) owners.set(vnode, record);
  }
  function pump(record: RecordState) {
    if (record.inFlight || record.phase === 'disposed') return;
    const next = record.queue.shift();
    if (!next) return;
    record.inFlight = next;
    log('commit-send', record, { seq: next.packet.seq, kind: next.packet.kind });
    send('__TransferCommit', next.packet);
  }
  function enqueue(
    record: RecordState,
    patchList: PatchList,
    patchOptions: PatchOptions,
    finish: () => void,
    kind: Commit['kind'],
  ) {
    record.queue.push({
      packet: { key: record.init.key, reloadVersion: 0, seq: ++record.seq, kind, patchList, patchOptions },
      finish,
    });
    pump(record);
  }
  function acceptFrame(frame: Frame) {
    const id = identity(frame.key);
    if (dead.has(id)) return;
    const record = records.get(id);
    if (!record || !record.background) {
      frames.set(id, frame);
      return;
    }
    if (record.phase !== 'waiting') return;
    record.phase = 'hydrating';
    log('hydrate', record, { first: frame.propsVersion, latest: record.version });
    const patch = withRecord(
      record,
      () => hydrate(JSON.parse(frame.snapshot) as SerializedSnapshotInstance, record.background!),
    );
    takeGlobalSnapshotPatch();
    enqueue(record, { patchList: [{ id: genCommitTaskId(), snapshotPatch: patch }] }, {
      reloadVersion: 0,
      isHydration: true,
    }, () => {
      if (record.phase !== 'disposed') record.phase = 'live';
      log('owned-by-background', record);
    }, 'hydrate');
  }
  function scheduleFrame(frame: Frame) {
    if (!options.hydrationDelayMs) {
      acceptFrame(frame);
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      acceptFrame(frame);
    }, options.hydrationDelayMs);
    timers.add(timer);
  }
  function create(init: Create) {
    const id = identity(init.key);
    if (dead.has(id) || records.has(id)) return;
    if (mts && !pageReady) {
      pendingCreates.push(init);
      return;
    }
    const provider = definitions.get(init.componentName);
    if (!provider) throw new Error(`Unknown transfer component: ${init.componentName}`);
    const record: RecordState = {
      init,
      Component: provider(),
      props: init.initialProps,
      version: init.propsVersion,
      phase: 'waiting',
      seq: 0,
      queue: [],
      renders: 0,
    };
    records.set(id, record);
    if (mts) {
      const element = record.element = __CreateElement('transfer-view', __pageId);
      __SetAttribute(element, 'transfer-id', init.key.transferId);
      __SetDataset(element, { __transferMeta: { reloadVersion: 0, key: init.key } });
      __AppendElement(__page, element);
      const root = record.main = new SnapshotInstance('root');
      root.__elements = [element];
      root.__element_root = element;
      send('__CreateTransfer', init);
      withRecord(record, () => {
        renderFirstFrame(createElement(record.Component, record.props), undefined, root);
      });
      __FlushElementTree(__page, {});
      log('first-frame', record, init.propsVersion);
      send('__TransferFirstFrame', {
        key: init.key,
        reloadVersion: 0,
        propsVersion: init.propsVersion,
        snapshot: JSON.stringify(root),
      });
    } else {
      record.background = new BackgroundSnapshotInstance('root');
      renderBackground(record);
      log('background-created', record);
      const frame = frames.get(id);
      if (frame) {
        frames.delete(id);
        scheduleFrame(frame);
      }
    }
  }
  function setProps(update: Update) {
    if (mts) {
      send('__SetTransferProps', update);
      return;
    }
    const record = records.get(identity(update.key));
    if (!record || record.phase === 'disposed' || update.propsVersion <= record.version) return;
    record.props = update.props;
    record.version = update.propsVersion;
    log('set-props', record, update.propsVersion);
    renderBackground(record);
  }
  function dispose(scope: Scope, notify = true) {
    const id = identity(scope.key);
    if (dead.has(id)) return;
    dead.add(id);
    frames.delete(id);
    const record = records.get(id);
    if (record) {
      record.phase = 'disposed';
      record.inFlight?.finish();
      record.queue.forEach(item => item.finish());
      record.queue.length = 0;
      if (mts && record.element) {
        const ids: number[] = [];
        const visit = (node: SnapshotInstance) => {
          ids.push(node.__id);
          node.childNodes.forEach(child => visit(child));
        };
        visit(record.main!);
        record.main!.removeChildren();
        __RemoveElement(__page, record.element);
        ids.forEach(value => snapshotInstanceManager.values.delete(value));
        __FlushElementTree(__page, {});
      } else if (record.background) {
        withRecord(record, () => render(null, record.background as unknown as ContainerNode));
        record.background.tearDown();
      }
      records.delete(id);
      log('disposed', record);
    }
    if (notify) {
      if (mts) send('__DestroyTransfer', scope);
      else send('__TransferDisposed', scope);
    }
  }

  if (mts) {
    const engine = lynx.getEngine();
    listen(engine, '__RenderPage', data => {
      const args = data as [Record<string, unknown>];
      lynx.__initData = args[0] ?? {};
      setupPage(__CreatePage('0', 0));
      (__root as SnapshotInstance).ensureElements();
      pageReady = true;
      __FlushElementTree(__page, {});
      pendingCreates.splice(0).forEach(init => create(init));
      log('page-ready');
    });
    listen(engine, '__CreateTransfer', data => create((data as [Create])[0]));
    listen(engine, '__SetTransferProps', data => setProps((data as [Update])[0]));
    listen(engine, '__DestroyTransfer', data => dispose((data as [Scope])[0]));
    listen(lynx.getJSContext(), '__TransferCommit', data => {
      const packet = data as Commit;
      const record = records.get(identity(packet.key));
      let status: Result['status'] = 'disposed';
      if (record && record.phase !== 'disposed') {
        try {
          if (packet.seq !== record.seq + 1) throw new Error('Transfer commit sequence mismatch');
          updateMainThread({ data: JSON.stringify(packet.patchList), patchOptions: packet.patchOptions });
          record.seq = packet.seq;
          if (packet.kind === 'hydrate') record.phase = 'live';
          status = 'applied';
          log('patch-applied', record, { seq: packet.seq, kind: packet.kind });
        } catch (error) {
          status = 'failed';
          lynx.reportError(error as Error);
        }
      }
      send('__TransferCommitResult', { key: packet.key, reloadVersion: 0, seq: packet.seq, status });
    });
    listen(lynx.getJSContext(), '__TransferDisposed', data => {
      const scope = data as Scope;
      log('background-disposed', records.get(identity(scope.key)));
      dispose(scope);
    });
  } else {
    setTransferCommitTransport((vnode, patchList, patchOptions, finish) => {
      const record = findOwner(vnode);
      if (!record) return false;
      if (record.phase === 'waiting' || record.phase === 'disposed') {
        finish();
        return true;
      }
      enqueue(record, patchList, patchOptions, finish, 'update');
      return true;
    });
    const core = lynx.getCoreContext();
    listen(core, '__CreateTransfer', data => create(data as Create));
    listen(core, '__TransferFirstFrame', data => {
      const frame = data as Frame;
      const record = records.get(identity(frame.key));
      if (record) scheduleFrame(frame);
      else frames.set(identity(frame.key), frame);
    });
    listen(core, '__SetTransferProps', data => setProps(data as Update));
    listen(core, '__DestroyTransfer', data => dispose(data as Scope));
    listen(core, '__TransferCommitResult', data => {
      const result = data as Result;
      const record = records.get(identity(result.key));
      if (!record?.inFlight || record.inFlight.packet.seq !== result.seq) return;
      const item = record.inFlight;
      record.inFlight = undefined;
      log('commit-result', record, result.status);
      item.finish();
      if (result.status === 'applied') pump(record);
      else dispose(record.init);
    });
  }

  let contextDisposed = false;
  function disposeContext() {
    if (contextDisposed) return;
    contextDisposed = true;
    records.forEach(record => dispose(record.init, false));
    timers.forEach(timer => clearTimeout(timer));
    removers.forEach(remove => remove());
    if (!mts) setTransferCommitTransport(undefined);
  }
  listen(lynx.getNative(), '__DestroyLifetime', disposeContext);

  return {
    debug,
    registerComponent(name: string, provider: () => ComponentType<Props>) {
      definitions.set(name, provider);
    },
    /** Records actual component execution for cross-root isolation checks. @internal */
    recordRender() {
      if (!active) throw new Error('Transfer component rendered without its context');
      log('component-render', active, ++active.renders);
    },
    dispose: disposeContext,
  };
}
