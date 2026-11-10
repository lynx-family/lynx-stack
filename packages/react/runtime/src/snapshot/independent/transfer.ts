// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement } from 'preact';
import type { ComponentType } from 'preact';

import { createBackgroundRenderer } from './background.js';
import { createMainThreadRenderer } from './main-thread.js';

type MainThreadRenderer = ReturnType<typeof createMainThreadRenderer>;
type MainThreadRoot = ReturnType<MainThreadRenderer['createRoot']>;
type BackgroundRenderer = ReturnType<typeof createBackgroundRenderer>;
type BackgroundRoot = ReturnType<BackgroundRenderer['createRoot']>;
type PatchList = ReturnType<BackgroundRoot['hydrate']>;
type PatchOptions = Parameters<
  MainThreadRenderer['applyCommit']
>[0]['patchOptions'];

type Props = Record<string, unknown>;
interface Scope {
  transferId: string;
}
type Create = Scope & { componentName: string; initialProps: Props };
type Update = Scope & { props: Props };
type Frame = Scope & { snapshot: string };
type Commit = Scope & {
  seq: number;
  kind: 'hydrate' | 'update';
  patchList: PatchList;
  patchOptions: PatchOptions;
};
type Result = Scope & {
  seq: number;
  status: 'applied' | 'disposed' | 'failed';
};
interface RecordState {
  init: Create;
  Component: ComponentType<Props>;
  props: Props;
  phase: 'waiting' | 'hydrating' | 'live' | 'disposed';
  main?: MainThreadRoot;
  element?: FiberElement;
  background?: BackgroundRoot;
  seq: number;
  queue: { packet: Commit; finish: () => void }[];
  inFlight?: { packet: Commit; finish: () => void } | undefined;
  renders: number;
}

interface TransferRenderContext {
  debug: {
    thread: string;
    records: Record<
      string,
      { renders: number; phase: string; seq: number }
    >;
  };
  registerComponent(name: string, provider: () => ComponentType<Props>): void;
  recordRender(): void;
  dispose(): void;
}

const decode = <T>(data: unknown): T => (typeof data === 'string' ? JSON.parse(data) : data) as T;

/**
 * Experimental snapshot-only transfer registry for the native chat proof of concept.
 * Each transfer owns a first-frame snapshot, a background render container and a commit queue.
 * @internal
 */
function createTransferRenderContext(): TransferRenderContext {
  const mts = typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__;
  const definitions = new Map<string, () => ComponentType<Props>>();
  const records = new Map<string, RecordState>();
  const frames = new Map<string, Frame>();
  const dead = new Set<string>();
  const owners = new WeakMap<BackgroundRoot, RecordState>();
  const removers: (() => void)[] = [];
  const mainRenderer = mts ? createMainThreadRenderer() : undefined;
  const backgroundRenderer = mts ? undefined : createBackgroundRenderer();
  if (backgroundRenderer) removers.push(() => backgroundRenderer.dispose());
  const debug = {
    thread: mts ? 'MTS' : 'BTS',
    records: {} as Record<
      string,
      { renders: number; phase: string; seq: number }
    >,
  };
  let active: RecordState | undefined;
  let pageReady = !mts;
  let page: FiberElement;
  let pageId: number;
  const pendingCreates: Create[] = [];

  function log(event: string, record?: RecordState, extra?: unknown) {
    if (record) {
      debug.records[record.init.transferId] = {
        renders: record.renders,
        phase: record.phase,
        seq: record.seq,
      };
    }
    console.info(
      '[TransferProtocol]',
      mts ? 'MTS' : 'BTS',
      event,
      record ? record.init.transferId : '',
      extra ?? '',
    );
  }
  function send(type: string, data: unknown) {
    const target = mts ? lynx.getJSContext() : lynx.getCoreContext();
    target.dispatchEvent({ type, data: JSON.stringify(data) });
  }
  function listen(
    target: {
      addEventListener(
        type: string,
        listener: (event: { data: unknown }) => void,
      ): void;
      removeEventListener(
        type: string,
        listener: (event: { data: unknown }) => void,
      ): void;
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
  function renderBackground(record: RecordState) {
    withRecord(
      record,
      () =>
        record.background!.render(
          createElement(record.Component, record.props),
        ),
    );
  }
  function pump(record: RecordState) {
    if (record.inFlight || record.phase === 'disposed') return;
    const next = record.queue.shift();
    if (!next) return;
    record.inFlight = next;
    log('commit-send', record, {
      seq: next.packet.seq,
      kind: next.packet.kind,
    });
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
      packet: {
        transferId: record.init.transferId,
        seq: ++record.seq,
        kind,
        patchList,
        patchOptions,
      },
      finish,
    });
    pump(record);
  }
  function acceptFrame(frame: Frame) {
    const id = frame.transferId;
    if (dead.has(id)) return;
    const record = records.get(id);
    if (!record || !record.background) {
      frames.set(id, frame);
      return;
    }
    if (record.phase !== 'waiting') return;
    record.phase = 'hydrating';
    log('hydrate', record);
    const patch = withRecord(
      record,
      () => record.background!.hydrate(frame.snapshot),
    );
    enqueue(record, patch, {
      reloadVersion: 0,
      isHydration: true,
    }, () => {
      if (record.phase !== 'disposed') record.phase = 'live';
      log('owned-by-background', record);
      if (record.phase === 'live') backgroundRenderer!.flushEvents();
    }, 'hydrate');
  }
  function create(init: Create) {
    const id = init.transferId;
    if (dead.has(id) || records.has(id)) return;
    if (mts && !pageReady) {
      pendingCreates.push(init);
      return;
    }
    const provider = definitions.get(init.componentName);
    if (!provider) {
      throw new Error(`Unknown transfer component: ${init.componentName}`);
    }
    const record: RecordState = {
      init,
      Component: provider(),
      props: init.initialProps,
      phase: 'waiting',
      seq: 0,
      queue: [],
      renders: 0,
    };
    records.set(id, record);
    if (mts) {
      const element = record.element = __CreateElement('transfer-view', pageId);
      __SetAttribute(element, 'transfer-id', init.transferId);
      __AppendElement(page, element);
      const root = record.main = mainRenderer!.createRoot(element);
      send('__CreateTransfer', init);
      const snapshot = withRecord(
        record,
        () => root.render(createElement(record.Component, record.props)),
      );
      __FlushElementTree(page, {});
      log('first-frame', record);
      send('__TransferFirstFrame', { transferId: init.transferId, snapshot });
    } else {
      record.background = backgroundRenderer!.createRoot(
        (patchList, patchOptions, finish) => {
          if (record.phase === 'waiting' || record.phase === 'disposed') {
            finish();
            return;
          }
          enqueue(record, patchList, patchOptions, finish, 'update');
        },
      );
      owners.set(record.background, record);
      renderBackground(record);
      log('background-created', record);
      const frame = frames.get(id);
      if (frame) {
        frames.delete(id);
        acceptFrame(frame);
      }
    }
  }
  function setProps(update: Update) {
    if (mts) {
      send('__SetTransferProps', update);
      return;
    }
    const record = records.get(update.transferId);
    if (!record || record.phase === 'disposed') return;
    record.props = update.props;
    log('set-props', record);
    renderBackground(record);
  }
  function dispose(scope: Scope, notify = true) {
    const id = scope.transferId;
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
        record.main!.destroy();
        __RemoveElement(page, record.element);
        __FlushElementTree(page, {});
      } else if (record.background) {
        withRecord(record, () => record.background!.destroy());
        owners.delete(record.background);
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
      const initialized = mainRenderer!.initialize(args[0] ?? {});
      page = initialized.element;
      pageId = initialized.id;
      pageReady = true;
      pendingCreates.splice(0).forEach(init => create(init));
      log('page-ready');
    });
    const native = lynx.getNative();
    listen(native, '__CreateTransfer', data => create(data as Create));
    listen(native, '__SetTransferProps', data => setProps(data as Update));
    listen(native, '__DestroyTransfer', data => dispose(data as Scope));
    listen(lynx.getJSContext(), '__TransferCommit', data => {
      const packet = data as Commit;
      const record = records.get(packet.transferId);
      let status: Result['status'] = 'disposed';
      if (record && record.phase !== 'disposed') {
        try {
          if (packet.seq !== record.seq + 1) {
            throw new Error('Transfer commit sequence mismatch');
          }
          mainRenderer!.applyCommit({
            data: JSON.stringify(packet.patchList),
            patchOptions: packet.patchOptions,
          });
          record.seq = packet.seq;
          if (packet.kind === 'hydrate') record.phase = 'live';
          status = 'applied';
          log('patch-applied', record, { seq: packet.seq, kind: packet.kind });
        } catch (error) {
          status = 'failed';
          lynx.reportError(error as Error);
        }
      }
      send('__TransferCommitResult', {
        transferId: packet.transferId,
        seq: packet.seq,
        status,
      });
    });
    listen(lynx.getJSContext(), '__TransferDisposed', data => {
      const scope = data as Scope;
      log('background-disposed', records.get(scope.transferId));
      dispose(scope);
    });
  } else {
    const core = lynx.getCoreContext();
    listen(core, '__CreateTransfer', data => create(data as Create));
    listen(core, '__TransferFirstFrame', data => acceptFrame(data as Frame));
    listen(core, '__SetTransferProps', data => setProps(data as Update));
    listen(core, '__DestroyTransfer', data => dispose(data as Scope));
    listen(core, '__TransferCommitResult', data => {
      const result = data as Result;
      const record = records.get(result.transferId);
      if (!record?.inFlight || record.inFlight.packet.seq !== result.seq) {
        return;
      }
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
    removers.forEach(remove => remove());
  }
  listen(lynx.getNative(), '__DestroyLifetime', disposeContext);

  return {
    debug,
    registerComponent(name: string, provider: () => ComponentType<Props>) {
      definitions.set(name, provider);
    },
    /** Records actual component execution for cross-root isolation checks. @internal */
    recordRender() {
      const root = backgroundRenderer?.getCurrentRoot();
      const record = active ?? (root && owners.get(root));
      if (!record) {
        throw new Error('Transfer component rendered without its context');
      }
      log('component-render', record, ++record.renders);
    },
    dispose: disposeContext,
  };
}

let context: TransferRenderContext | undefined;

/**
 * Registers transfer component types for the current page.
 * The first registration initializes transfer rendering on the current thread.
 * Used by the package registry and optional diagnostics entry.
 */
export const registry = {
  registerComponent(name: string, provider: () => ComponentType<Props>): void {
    context ??= createTransferRenderContext();
    context.registerComponent(name, provider);
  },
};

/** Experimental read-only counters and render instrumentation for the chat fixture. */
export const diagnostics = {
  get debug(): TransferRenderContext['debug'] | undefined {
    return context?.debug;
  },
  recordRender(): void {
    if (!context) {
      throw new Error('Transfer rendering has not been initialized');
    }
    context.recordRender();
  },
};
