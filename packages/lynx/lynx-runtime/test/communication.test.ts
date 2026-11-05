// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as bts from '../src/bts.js';
import { NATIVE_EVENT_DESTROY_LIFETIME } from '../src/common/protocol.js';
import type {
  HostBTSApp,
  HostGlobalScope,
  HostMessageEvent,
} from '../src/common/types.js';
import * as mts from '../src/mts.js';

const host = globalThis as unknown as HostGlobalScope;

function contextProxy() {
  const listeners = new Map<string, Set<(event: HostMessageEvent) => void>>();
  const proxy = {
    dispatchEvent: vi.fn((_event: { type: string; data: unknown }): unknown =>
      undefined
    ),
    addEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        let set = listeners.get(type);
        if (!set) listeners.set(type, set = new Set());
        set.add(listener as (event: HostMessageEvent) => void);
      },
    ),
    removeEventListener: vi.fn(
      <T = unknown>(
        type: string,
        listener: (event: HostMessageEvent<T>) => void,
      ) => {
        listeners.get(type)?.delete(
          listener as (event: HostMessageEvent) => void,
        );
      },
    ),
  };
  return {
    ...proxy,
    emit(type: string, data: unknown) {
      for (const listener of [...listeners.get(type) ?? []]) {
        listener({ type, data, origin: 'host' });
      }
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function attachCard(id: string) {
  const core = contextProxy();
  const app: HostBTSApp = {
    nativeAppId: id,
    lynx: {
      getCoreContext: () => core,
    },
  };
  host.multiApps ??= {};
  host.multiApps[id] = app;
  host.currentAppId = id;
  return { app, core, card: bts.bindPage() };
}

function attachMainThread() {
  const native = contextProxy();
  const js = contextProxy();
  host.lynx = {
    getNative: () => native,
    getJSContext: () => js,
  };
  return { native, js };
}

beforeEach(() => {
  delete host.lynx;
});

afterEach(() => {
  for (const app of Object.values(host.multiApps ?? {})) {
    app?.callDestroyLifetimeFun?.();
  }
  delete host.multiApps;
  delete host.currentAppId;
  delete host.lynx;
  delete host.renderPage;
  delete host.updatePage;
  delete host.updateGlobalProps;
  delete host.processData;
  delete host.getPageData;
  delete host.removeComponents;
});

describe('R4 peer messages', () => {
  it.each(['mts', 'bts'] as const)(
    'passes %s wire types and payloads unchanged and ignores host dispatch results',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      proxy.dispatchEvent.mockReturnValue(3);
      const payload = {
        patchOptions: { pipelineOptions: { pipelineID: 'pipe-1' } },
      };
      for (const data of [payload, null, undefined, 3, false, 'plain']) {
        expect(api.sendMessage('r4:raw', data)).toBeUndefined();
        expect(proxy.dispatchEvent).toHaveBeenLastCalledWith({
          type: 'r4:raw',
          data,
        });
        expect(vi.mocked(proxy.dispatchEvent).mock.calls.at(-1)?.[0].data).toBe(
          data,
        );
      }
      expect(api.sendMessage('r4:empty')).toBeUndefined();
      expect(proxy.dispatchEvent).toHaveBeenLastCalledWith({
        type: 'r4:empty',
        data: undefined,
      });
    },
  );

  it.each(['mts', 'bts'] as const)(
    'owns one host listener per %s message type, supports resubscription, and preserves listener data/this',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      const calls: unknown[] = [];
      let receiver: unknown = 'unset';
      const listener = function(this: void, data: unknown) {
        receiver = this;
        calls.push(data);
      };
      const stop = api.onMessage('r4:raw', listener);
      const duplicateStop = api.onMessage('r4:raw', listener);
      const second = vi.fn();
      const stopSecond = api.onMessage('r4:raw', second);
      expect(proxy.count('r4:raw')).toBe(1);
      const payload = { retained: true };
      for (const data of [payload, null, undefined, 4]) {
        proxy.emit('r4:raw', data);
      }
      expect(calls).toEqual([payload, null, undefined, 4]);
      expect(receiver).toBeUndefined();
      expect(second).toHaveBeenCalledTimes(4);
      expect(second.mock.calls[0]?.[0]).toBe(payload);
      duplicateStop();
      stop();
      stop();
      proxy.emit('r4:raw', 'after removal');
      expect(calls).toHaveLength(4);
      expect(second).toHaveBeenCalledTimes(5);
      stopSecond();
      expect(proxy.count('r4:raw')).toBe(0);
      const resumed = vi.fn();
      api.onMessage('r4:raw', resumed);
      proxy.emit('r4:raw', false);
      expect(resumed).toHaveBeenCalledExactlyOnceWith(false);
    },
  );

  it.each(['mts', 'bts'] as const)(
    'propagates %s listener exceptions without wrapping or swallowing them',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      const failure = new Error('DSL message failed');
      api.onMessage('r4:failure', () => {
        throw failure;
      });
      expect(() => proxy.emit('r4:failure', {})).toThrow(failure);
    },
  );

  it.each(['mts', 'bts'] as const)(
    'applies %s listener mutations to the current dispatch and rethrows after notifying remaining listeners',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      const calls: string[] = [];
      const failure = new Error('first failure');
      const late = () => {
        calls.push('late');
      };
      let stopRemoved: () => void = vi.fn();
      api.onMessage('r4:mutate', () => {
        calls.push('first');
        stopRemoved();
        api.onMessage('r4:mutate', late);
        throw failure;
      });
      stopRemoved = api.onMessage('r4:mutate', () => {
        calls.push('removed');
      });
      api.onMessage('r4:mutate', () => {
        calls.push('remaining');
        throw new Error('second failure');
      });
      expect(() => proxy.emit('r4:mutate', {})).toThrow(failure);
      expect(calls).toEqual(['first', 'remaining']);
      expect(() => proxy.emit('r4:mutate', {})).toThrow(failure);
      expect(calls).toEqual([
        'first',
        'remaining',
        'first',
        'remaining',
        'late',
      ]);

      const old = api.onMessage('r4:recreate', vi.fn());
      old();
      const current = vi.fn();
      api.onMessage('r4:recreate', current);
      old();
      proxy.emit('r4:recreate', 5);
      expect(current).toHaveBeenCalledExactlyOnceWith(5);
      expect(proxy.count('r4:recreate')).toBe(1);
    },
  );

  it.each(['mts', 'bts'] as const)(
    'keeps %s subscription generations distinct while the same host entry remains alive',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      const listener = vi.fn();
      const stopOld = api.onMessage('r4:generation', listener);
      const stopDuplicate = api.onMessage('r4:generation', listener);
      const other = vi.fn();
      api.onMessage('r4:generation', other);
      stopOld();
      api.onMessage('r4:generation', listener);
      stopOld();
      stopDuplicate();
      proxy.emit('r4:generation', 'new generation');
      expect(listener).toHaveBeenCalledExactlyOnceWith('new generation');
      expect(other).toHaveBeenCalledExactlyOnceWith('new generation');
      expect(proxy.count('r4:generation')).toBe(1);

      const calls: string[] = [];
      const later = () => {
        calls.push('later');
      };
      let stopLater: () => void = vi.fn();
      let replace = true;
      api.onMessage('r4:replace-during-dispatch', () => {
        calls.push('first');
        if (replace) {
          replace = false;
          stopLater();
          stopLater = api.onMessage('r4:replace-during-dispatch', later);
        }
      });
      stopLater = api.onMessage('r4:replace-during-dispatch', later);
      proxy.emit('r4:replace-during-dispatch', {});
      expect(calls).toEqual(['first']);
      proxy.emit('r4:replace-during-dispatch', {});
      expect(calls).toEqual(['first', 'first', 'later']);
    },
  );

  it('keeps two BTS cards isolated after default context changes and releases only the destroyed card', () => {
    const first = attachCard('first');
    const firstListener = vi.fn();
    first.card.onMessage('same:type', firstListener);
    const second = attachCard('second');
    const secondListener = vi.fn();
    second.card.onMessage('same:type', secondListener);
    first.card.sendMessage('same:type', 'first outbound');
    expect(first.core.dispatchEvent).toHaveBeenLastCalledWith({
      type: 'same:type',
      data: 'first outbound',
    });
    expect(second.core.dispatchEvent).not.toHaveBeenCalled();
    first.core.emit('same:type', 'first');
    second.core.emit('same:type', 'second');
    first.app.callDestroyLifetimeFun?.();
    first.core.emit('same:type', 'stale');
    second.core.emit('same:type', 'still live');
    expect(firstListener.mock.calls).toEqual([['first']]);
    expect(secondListener.mock.calls).toEqual([['second'], ['still live']]);
    expect(first.core.count('same:type')).toBe(0);
    expect(second.core.count('same:type')).toBe(1);
  });

  it.each(['mts', 'bts'] as const)(
    'closes %s messages before DSL destruction and stops an active broadcast immediately',
    side => {
      const main = attachMainThread();
      const background = attachCard('a');
      const api = side === 'mts' ? mts : background.card;
      const proxy = side === 'mts' ? main.js : background.core;
      const destroy = () => {
        if (side === 'mts') {
          main.native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
        } else {
          background.app.callDestroyLifetimeFun?.();
        }
      };
      const calls: string[] = [];
      // Register DSL cleanup first: Runtime teardown must not depend on order.
      api.onDestroy(() => {
        expect(proxy.count('r4:destroy-reentry')).toBe(0);
        proxy.emit('r4:destroy-reentry', 'late');
        calls.push('destroy');
      });
      const stop = api.onMessage('r4:destroy-reentry', () => {
        calls.push('first');
        destroy();
      });
      api.onMessage('r4:destroy-reentry', () => {
        calls.push('remaining');
      });
      proxy.emit('r4:destroy-reentry', 'start');
      expect(calls).toEqual(['first', 'destroy']);
      stop();
      stop();
    },
  );

  it('rejects every R4 operation during and after destruction and makes captured listeners/disposers inert', () => {
    const { native, js } = attachMainThread();
    const { app, core, card } = attachCard('a');
    const mainListener = vi.fn();
    const backgroundListener = vi.fn();
    const stopMain = mts.onMessage('r4:raw', mainListener);
    const stopBackground = card.onMessage('r4:raw', backgroundListener);
    const capturedMain =
      vi.mocked(js.addEventListener).mock.calls.find(([type]) =>
        type === 'r4:raw'
      )![1];
    const capturedBackground =
      vi.mocked(core.addEventListener).mock.calls.find(([type]) =>
        type === 'r4:raw'
      )![1];
    const checkBTS = () => {
      for (
        const operation of [
          () => card.sendMessage('r4:raw'),
          () => card.onMessage('r4:raw', vi.fn()),
        ]
      ) expect(operation).toThrow(/destroying or destroyed/);
      stopBackground();
      stopBackground();
    };
    const checkMTS = () => {
      for (
        const operation of [
          () => mts.sendMessage('r4:raw'),
          () => mts.onMessage('r4:raw', vi.fn()),
        ]
      ) expect(operation).toThrow(/destroying or destroyed/);
      stopMain();
      stopMain();
    };
    card.onDestroy(checkBTS);
    mts.onDestroy(checkMTS);
    app.callDestroyLifetimeFun?.();
    native.emit(NATIVE_EVENT_DESTROY_LIFETIME, undefined);
    checkBTS();
    checkMTS();
    capturedMain({ type: 'r4:raw', data: 'stale' });
    capturedBackground({ type: 'r4:raw', data: 'stale' });
    expect(mainListener).not.toHaveBeenCalled();
    expect(backgroundListener).not.toHaveBeenCalled();
    expect(js.count('r4:raw')).toBe(0);
    expect(core.count('r4:raw')).toBe(0);
  });
});

describe('R4 peer capability routing', () => {
  it('exposes bound BTS message methods and fails explicitly when a host channel is missing', () => {
    const { card, app, core } = attachCard('a');
    const listener = vi.fn();
    bts.bindPage().onMessage('r4:top', listener);
    core.emit('r4:top', 1);
    expect(listener).toHaveBeenCalledExactlyOnceWith(1);
    bts.bindPage().sendMessage('r4:top', 2);
    expect(core.dispatchEvent).toHaveBeenLastCalledWith({
      type: 'r4:top',
      data: 2,
    });
    delete app.lynx!.getCoreContext;
    expect(() => card.sendMessage('r4:missing')).toThrow(/getCoreContext/);
    expect(() => card.onMessage('r4:missing', vi.fn())).toThrow(
      /getCoreContext/,
    );
    const { js } = attachMainThread();
    mts.onMessage('r4:rebind', vi.fn());
    expect(js.count('r4:rebind')).toBe(1);
    const nextJs = contextProxy();
    host.lynx!.getJSContext = () => nextJs;
    const rebound = vi.fn();
    mts.onMessage('r4:rebind', rebound);
    expect(js.count('r4:rebind')).toBe(0);
    nextJs.emit('r4:rebind', 'fresh');
    expect(rebound).toHaveBeenCalledExactlyOnceWith('fresh');
    delete host.lynx!.getJSContext;
    expect(() => mts.sendMessage('r4:missing')).toThrow(/getJSContext/);
    expect(() => mts.onMessage('r4:missing', vi.fn())).toThrow(/getJSContext/);
  });
});

describe('independent communication adopter', () => {
  it('uses only public Runtime peer messages for independent state updates', async () => {
    const { js } = attachMainThread();
    const { core } = attachCard('independent');
    vi.mocked(js.dispatchEvent).mockImplementation(({ type, data }) =>
      core.emit(type, data)
    );
    vi.mocked(core.dispatchEvent).mockImplementation(({ type, data }) =>
      js.emit(type, data)
    );
    const { startCommunicationMainThread, startCommunicationBackground } =
      await import('./fixtures/independent-communication.js');
    const commit = vi.fn();
    const render = vi.fn();
    const stop = startCommunicationMainThread(commit);
    const dsl = startCommunicationBackground(render);
    dsl.add(2);
    dsl.add(3);
    expect(render.mock.calls).toEqual([[2], [5]]);
    dsl.replace(10);
    expect(commit).toHaveBeenCalledExactlyOnceWith(10);
    dsl.add(1);
    expect(render).toHaveBeenLastCalledWith(11);
    stop();
    dsl.add(100);
    expect(render).toHaveBeenCalledTimes(3);
  });
});
