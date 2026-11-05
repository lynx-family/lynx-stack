// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, it, vi } from 'vitest';

import { bindPage } from '../src/bts.js';
import { copyHostData } from '../src/common/protocol.js';
import type {
  HostBTSApp,
  HostGlobalScope,
  HostMessageEvent,
} from '../src/common/types.js';
import * as mts from '../src/mts.js';

const host = globalThis as unknown as HostGlobalScope;
function proxy() {
  const listeners = new Map<string, Set<(event: HostMessageEvent) => void>>();
  return {
    listeners,
    addEventListener: vi.fn(
      (type: string, fn: (event: HostMessageEvent) => void) => {
        let set = listeners.get(type);
        if (!set) listeners.set(type, set = new Set());
        set.add(fn);
      },
    ),
    removeEventListener: vi.fn(
      (type: string, fn: (event: HostMessageEvent) => void) => {
        listeners.get(type)?.delete(fn);
      },
    ),
    dispatchEvent(event: HostMessageEvent) {
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
    },
  };
}
function setup() {
  const engine = proxy();
  const native = proxy();
  const peer = proxy();
  vi.stubGlobal('lynx', {
    getEngine: () => engine,
    getNative: () => native,
    getJSContext: () => peer,
    __globalProps: { theme: { color: 'red' } },
  });
  mts.getInitData();
  return { engine, native, peer };
}

afterEach(() => vi.unstubAllGlobals());

it.each(
  [
    ['__RenderPage', {}, mts.onRenderPage],
    ['__UpdatePage', {}, mts.onUpdateData],
    ['__UpdatePage', { reloadTemplate: true }, mts.onReload],
    ['__UpdateGlobalProps', {}, mts.onGlobalPropsChanged],
  ] as const,
)(
  'protects registration identity and immediate cancellation for %s (%j)',
  (type, options, subscribe) => {
    const { engine } = setup();
    const fn = vi.fn();
    const old = subscribe(fn);
    expect(subscribe(fn)).toBe(old);
    old();
    subscribe(fn);
    old();
    engine.dispatchEvent({ type, data: [{}, options] });
    expect(fn).toHaveBeenCalledOnce();

    subscribe(() => stop());
    const removed = vi.fn();
    const stop = subscribe(removed);
    engine.dispatchEvent({ type, data: [{}, options] });
    expect(removed).not.toHaveBeenCalled();
  },
);

it('runs all live destroy callbacks before internal cleanup, even when a callback throws', () => {
  const { engine, native } = setup();
  const removed = vi.fn();
  const reused = vi.fn();
  const old = mts.onDestroy(reused);
  old();
  mts.onDestroy(reused);
  old();
  const input = host.updatePage;
  mts.setDataProcessor(() => ({ processed: true }));
  mts.setPageDataGetter(() => ({ current: true }));
  mts.onDestroy(() => {
    expect(mts.isDestroyed()).toBe(true);
    expect(host.updatePage).toBe(input);
    expect(engine.listeners.get('__UpdatePage')?.size).toBe(1);
    expect(host.processData?.({})).toEqual({ processed: true });
    expect(host.getPageData?.()).toEqual({ current: true });
    stop();
    throw new Error('teardown failure');
  });
  const stop = mts.onDestroy(removed);
  const last = vi.fn();
  mts.onDestroy(last);
  expect(() =>
    native.dispatchEvent({ type: '__DestroyLifetime', data: undefined })
  ).toThrow('teardown failure');
  expect(reused).toHaveBeenCalledOnce();
  expect(removed).not.toHaveBeenCalled();
  expect(last).toHaveBeenCalledOnce();
  expect(engine.listeners.get('__UpdatePage')?.size).toBe(0);
  expect(host.processData?.({ value: 1 })).toEqual({ value: 1 });
  expect(host.getPageData?.()).toBeNull();
});

it('associates late and replaced lynx facades with an observed host lifetime without reactivation', () => {
  vi.stubGlobal('lynx', undefined);
  const stop = mts.onRenderPage(vi.fn());
  const { native, engine } = setup();
  host.renderPage?.({ seed: 1 });
  const getNative = host.lynx!.getNative;
  mts.onDestroy(() => {
    host.lynx = { getNative };
    expect(mts.isDestroyed()).toBe(true);
    expect(mts.getInitData()).toEqual({ seed: 1 });
    expect(() => mts.onUpdateData(vi.fn())).toThrow(/destroy/);
  });
  native.dispatchEvent({ type: '__DestroyLifetime', data: undefined });
  host.lynx = { getNative };
  expect(mts.isDestroyed()).toBe(true);
  const calls = native.addEventListener.mock.calls.length;
  expect(() => mts.setPageDataGetter(() => ({}))).toThrow(/destroy/);
  expect(native.addEventListener).toHaveBeenCalledTimes(calls);
  expect(mts.getInitData()).toEqual({ seed: 1 });
  expect(engine.addEventListener).toHaveBeenCalledTimes(2);
  stop();
});

it('isolates MTS initial data and borrows live GlobalProps until destruction', () => {
  const { engine, native } = setup();
  const input = { nested: { value: 1 }, list: [{ value: 2 }] };
  engine.dispatchEvent({ type: '__RenderPage', data: [input] });
  input.nested.value = 7;
  const first = mts.getInitData<typeof input>();
  first.nested.value = 8;
  first.list[0]!.value = 9;
  expect(mts.getInitData()).toEqual({
    nested: { value: 1 },
    list: [{ value: 2 }],
  });
  const props = mts.getGlobalProps();
  expect(mts.getGlobalProps()).toBe(props);
  expect(props).toBe(host.lynx!.__globalProps);
  expect(props).toEqual({ theme: { color: 'red' } });
  native.dispatchEvent({ type: '__DestroyLifetime', data: undefined });
  (host.lynx!.__globalProps!['theme'] as { color: string }).color = 'green';
  expect(mts.getGlobalProps()).toEqual({ theme: { color: 'red' } });
});

it('isolates BTS initial, reload and global-props snapshots including original handler mutations', () => {
  const data = { nested: { value: 1 } };
  const app: HostBTSApp = {
    _params: { initData: data },
    lynx: { __globalProps: data },
    updateGlobalProps: value => {
      if (value && typeof value === 'object' && 'nested' in value) {
        (value['nested'] as { value: number }).value = 99;
      }
    },
  };
  vi.stubGlobal('lynx', undefined);
  vi.stubGlobal('tt', app);
  const card = bindPage();
  card.getGlobalProps();
  const seenProps: unknown[] = [];
  card.onGlobalPropsChanged((next) => {
    seenProps.push(next);
    expect(next).toBe(card.getGlobalProps());
  });
  data.nested.value = 2;
  card.getInitData<typeof data>().nested.value = 3;
  const props = card.getGlobalProps<typeof data>();
  expect(card.getGlobalProps()).toBe(props);
  expect(props).not.toBe(data);
  expect(card.getInitData()).toEqual({ nested: { value: 1 } });
  expect(card.getGlobalProps()).toEqual({ nested: { value: 1 } });
  app.updateGlobalProps!({ nested: { value: 5 } });
  expect(card.getGlobalProps()).toEqual({ nested: { value: 5 } });
  expect(seenProps).toEqual([{ nested: { value: 5 } }]);
  expect(seenProps[0]).toBe(card.getGlobalProps());
  expect(card.getGlobalProps()).not.toBe(props);
  expect(props).toEqual({ nested: { value: 1 } });
  app.updateGlobalProps!(null as unknown as Record<string, unknown>);
  expect(card.getGlobalProps()).toEqual({});
  expect(seenProps[1]).toEqual({});
  expect(seenProps[1]).toBe(card.getGlobalProps());
  const reload = { nested: { value: 6 } };
  app.onAppReload!(reload);
  reload.nested.value = 7;
  expect(card.getInitData()).toEqual({ nested: { value: 6 } });
});

it('delivers MTS inputs without installing a JSContext bridge or buffering updates', () => {
  const { engine, peer } = setup();
  const spy = vi.spyOn(peer, 'dispatchEvent');
  const seen: unknown[] = [];
  mts.onUpdateData((data, options) => {
    seen.push([data, options]);
  });
  engine.dispatchEvent({
    type: '__UpdatePage',
    data: [{ nested: { value: 1 } }, { resetPageData: false }],
  });
  engine.dispatchEvent({
    type: '__UpdatePage',
    data: [{ reloaded: true }, { reloadTemplate: true }],
  });
  expect(seen).toEqual([
    [{ nested: { value: 1 } }, { resetPageData: false }],
  ]);
  expect(peer.addEventListener).not.toHaveBeenCalled();
  expect(spy).not.toHaveBeenCalled();
});

it('cancels BTS notification callbacks immediately during dispatch', () => {
  vi.stubGlobal('lynx', undefined);
  const app: HostBTSApp = {};
  vi.stubGlobal('tt', app);
  const card = bindPage();
  card.onReload(() => stop());
  const removed = vi.fn();
  const stop = card.onReload(removed);
  app.onAppReload!({});
  expect(removed).not.toHaveBeenCalled();

  card.onUpdateData(() => stopUpdate());
  const removedUpdate = vi.fn();
  const stopUpdate = card.onUpdateData(removedUpdate);
  app.updateCardData!({});
  expect(removedUpdate).not.toHaveBeenCalled();
});

it('copies host record graphs without prototype setters and retains opaque objects', () => {
  const data = JSON.parse(
    '{"__proto__":{"polluted":true},"array":[null,1]}',
  ) as object;
  const copy = copyHostData(data);
  expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
  expect(Object.hasOwn(copy, '__proto__')).toBe(true);
  const sparse: unknown[] = [];
  sparse.length = 3;
  expect(copyHostData(sparse)).toHaveLength(3);
  expect(Object.hasOwn(copyHostData(sparse), 0)).toBe(false);
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  const cyclicCopy = copyHostData(cycle);
  expect(cyclicCopy.self).toBe(cyclicCopy);
  class CustomData {
    value = 1;
  }
  for (const opaque of [new Date(), new Uint8Array([1, 2]), new CustomData()]) {
    expect(copyHostData(opaque)).toBe(opaque);
    const input = { nested: [opaque] };
    const result = copyHostData(input);
    expect(result).not.toBe(input);
    expect(result.nested).not.toBe(input.nested);
    expect(result.nested[0]).toBe(opaque);
  }
});

it('preserves a host __proto__ data key across BTS static+dynamic merge and reload dynamic replacement', () => {
  const { engine } = setup();
  const data = JSON.parse(
    '{"__proto__":{"value":1},"staticKey":true}',
  ) as Record<
    string,
    unknown
  >;
  const app: HostBTSApp = {
    _params: { initData: data, updateData: { initial: 1 } },
  };
  vi.stubGlobal('tt', app);
  const card = bindPage();
  expect(card.getInitData()).toEqual({ ...data, initial: 1 });
  expect(Object.getPrototypeOf(card.getInitData())).toBe(Object.prototype);
  expect(Object.hasOwn(card.getInitData(), '__proto__')).toBe(true);

  const reloadData = JSON.parse(
    '{"__proto__":{"value":2},"title":"reload"}',
  ) as Record<string, unknown>;
  app.onAppReload!(reloadData);
  engine.dispatchEvent({
    type: '__UpdatePage',
    data: [reloadData, { reloadTemplate: true }],
  });
  expect(card.getInitData()).toEqual({ ...data, ...reloadData });
  expect('initial' in card.getInitData()).toBe(false);
  expect(mts.getInitData()).toEqual(reloadData);
  expect(Object.getPrototypeOf(card.getInitData())).toBe(Object.prototype);
  expect(Object.hasOwn(card.getInitData(), '__proto__')).toBe(true);
});
