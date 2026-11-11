// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';

import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';

import * as bts from '../src/bts.js';
import type { HostGlobalScope } from '../src/common/types.js';
import type {
  BTSPageRuntime,
  BTSUpdateOptions,
  CreatedPipelineOptions,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSUpdateOptions,
  PipelineOptions,
} from '../src/index.js';
import * as mts from '../src/mts.js';

const host = globalThis as unknown as HostGlobalScope;

const mixedResult = () =>
  Math.random() ? { value: 1 } : Promise.resolve({ value: 1 });

afterEach(() => {
  vi.unstubAllGlobals();
});

it('is side-effect-free on import across root, /mts and /bts and declares sideEffects: false', async () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { sideEffects?: unknown };
  expect(pkg.sideEffects).toBe(false);
  vi.resetModules();
  const lynx = {
    SystemInfo: { platform: 'android', pixelRatio: 2 },
    getNative: vi.fn(),
    getEngine: vi.fn(),
  };
  vi.stubGlobal('lynx', lynx);
  vi.stubGlobal('SystemInfo', undefined);
  vi.stubGlobal('renderPage', undefined);
  vi.stubGlobal('updatePage', undefined);
  vi.stubGlobal('updateGlobalProps', undefined);
  vi.stubGlobal('processData', undefined);
  vi.stubGlobal('getPageData', undefined);
  vi.stubGlobal('removeComponents', undefined);
  const root = await import('../src/index.js');
  const freshMts = await import('../src/mts.js');
  const freshBts = await import('../src/bts.js');
  expect(Object.keys(root)).toEqual([]);
  expect(host.SystemInfo).toBeUndefined();
  expect(host.renderPage).toBeUndefined();
  expect(host.updatePage).toBeUndefined();
  expect(host.updateGlobalProps).toBeUndefined();
  expect(host.processData).toBeUndefined();
  expect(host.getPageData).toBeUndefined();
  expect(host.removeComponents).toBeUndefined();
  expect(lynx.getNative).not.toHaveBeenCalled();
  expect(lynx.getEngine).not.toHaveBeenCalled();
  expect(freshMts.isDestroyed()).toBe(false);
  expect(lynx.getNative).not.toHaveBeenCalled();
  expect(Object.keys(freshBts)).toEqual(['bindPage']);
  expect(Object.keys(bts)).toEqual(['bindPage']);
  expect('bridgeUpdateDataToBTS' in mts).toBe(false);
});

it('queries MTS destruction without installing host hooks and sees destroying before any callbacks', () => {
  const listeners = new Map<string, () => void>();
  const native = {
    addEventListener: vi.fn((type: string, callback: () => void) =>
      listeners.set(type, callback)
    ),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal('lynx', { getNative: () => native });
  expect(mts.isDestroyed()).toBe(false);
  expect(native.addEventListener).not.toHaveBeenCalled();
  mts.onDestroy(() => {
    expect(mts.isDestroyed()).toBe(true);
    expect(() => mts.sendMessage('late')).toThrow(/destroy/);
  });
  listeners.get('__DestroyLifetime')!();
  const calls = native.addEventListener.mock.calls.length;
  expect(mts.isDestroyed()).toBe(true);
  expect(native.addEventListener).toHaveBeenCalledTimes(calls);
});

it('caches each card handle and reports destruction before the original host callback', () => {
  const app = {
    callDestroyLifetimeFun: () => expect(card.isDestroyed()).toBe(true),
  };
  vi.stubGlobal('lynx', undefined);
  vi.stubGlobal('tt', app);
  const card = bts.bindPage();
  expect(bts.bindPage()).toBe(card);
  for (
    const method of [
      'getId',
      'onReload',
      'onConfigChanged',
      'onEnterForeground',
      'onEnterBackground',
      'onGlobalEvent',
    ] as const
  ) {
    expect(typeof card[method]).toBe('function');
  }
  for (
    const oldName of [
      'getAppId',
      'onAppReload',
      'onCardConfigChanged',
      'onAppEnterForeground',
      'onAppEnterBackground',
    ]
  ) {
    expect(card).not.toHaveProperty(oldName);
  }
  expect(card.isDestroyed()).toBe(false);
  card.onDestroy(() => expect(card.isDestroyed()).toBe(true));
  app.callDestroyLifetimeFun();
  expect(card.isDestroyed()).toBe(true);
  expect(bts.bindPage()).toBe(card);
});

it('maps timingFlag without mutating caller options and preserves explicit native flags', () => {
  vi.stubGlobal('lynx', {});
  const flush = vi.fn();
  vi.stubGlobal('__FlushElementTree', flush);
  const options = Object.freeze({ timingFlag: 'public', triggerLayout: false });
  mts.flushElementTree(options);
  expect(flush).toHaveBeenLastCalledWith(undefined, {
    ...options,
    __lynx_timing_flag: 'public',
  });
  expect(flush.mock.calls[0]![1]).not.toBe(options);
  expect(options).not.toHaveProperty('__lynx_timing_flag');
  const explicit = Object.freeze({
    timingFlag: 'public',
    __lynx_timing_flag: 'native',
  });
  mts.flushElementTree(explicit as MTSFlushOptions);
  expect(flush.mock.calls[1]![1]).toBe(explicit);
  const empty = Object.freeze({ timingFlag: '' });
  mts.flushElementTree(empty);
  expect(flush).toHaveBeenLastCalledWith(undefined, {
    timingFlag: '',
    __lynx_timing_flag: '',
  });
});

it('requires typed message payloads and exposes semantic update, flush and pipeline types', () => {
  const checkTypes = (card: BTSPageRuntime) => {
    mts.sendMessage('notification');
    card.sendMessage('notification');
    mts.sendMessage('inferred', { value: 1 });
    card.sendMessage('inferred', { value: 1 });
    mts.sendMessage<{ value: number } | undefined>('optional');
    card.sendMessage<{ value: number } | undefined>('optional');
    mts.sendMessage<{ value: number }>('required', { value: 1 });
    card.sendMessage<{ value: number }>('required', { value: 1 });
    // @ts-expect-error A declared non-optional payload must be provided.
    mts.sendMessage<{ value: number }>('missing');
    // @ts-expect-error Bound-card messaging has the same requirement.
    card.sendMessage<{ value: number }>('missing');
    // @ts-expect-error SystemInfo is a host schema, not an unchecked cast.
    mts.getSystemInfo<{ madeUp: string }>();
    // @ts-expect-error SystemInfo is a host schema on BTS as well.
    card.getSystemInfo<{ madeUp: string }>();
    // @ts-expect-error Reset is input metadata, not a page flush option.
    mts.flushElementTree({ resetPageData: true });
    mts.flushElementTree({ reloadTemplate: true, nativeUpdateDataOrder: 1 });
    // @ts-expect-error Native consumes processor results synchronously.
    mts.setDataProcessor(async (data: object) => data);
    // @ts-expect-error Native consumes getter results synchronously.
    mts.setPageDataGetter(async () => ({}));
    // @ts-expect-error A synchronous-looking union must not admit promises.
    mts.setDataProcessor(mixedResult);
    // @ts-expect-error PromiseLike objects also require asynchronous consumption.
    mts.setPageDataGetter(() => null as unknown as PromiseLike<object>);
    const registerTypedProcessor = <T extends Record<string, unknown>>(
      fn: (data: T, processorName?: string) => T,
    ) => mts.setDataProcessor(fn);
    const registerTypedGetter = <T extends Record<string, unknown>>(
      fn: (keys?: string[]) => T | null,
    ) => mts.setPageDataGetter(fn);
    expectTypeOf(registerTypedProcessor).toBeFunction();
    expectTypeOf(registerTypedGetter).toBeFunction();
    expectTypeOf(mts.createPipeline()).toEqualTypeOf<
      CreatedPipelineOptions | undefined
    >();
    expectTypeOf(card.createPipeline()).toEqualTypeOf<
      CreatedPipelineOptions | undefined
    >();
    expectTypeOf(mts.getSystemInfo()).toEqualTypeOf<Readonly<LynxSystemInfo>>();
    expectTypeOf(card.getSystemInfo()).toEqualTypeOf<
      Readonly<LynxSystemInfo>
    >();
    expectTypeOf<CreatedPipelineOptions>().toMatchTypeOf<PipelineOptions>();
    expectTypeOf<CreatedPipelineOptions['pipelineID']>().toEqualTypeOf<
      string
    >();
    expectTypeOf<BTSUpdateOptions>().not.toHaveProperty('type');
    expectTypeOf<BTSUpdateOptions['resetPageData']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<MTSUpdateOptions['resetPageData']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf(mts.getGlobalProps<{ theme: string }>()).toEqualTypeOf<
      Readonly<{ theme: string }>
    >();
    expectTypeOf(card.getGlobalProps<{ theme: string }>()).toEqualTypeOf<
      Readonly<{ theme: string }>
    >();
    mts.onRenderPage<{ title: string }>((data, options) => {
      expectTypeOf(data).toEqualTypeOf<Readonly<{ title: string }>>();
      expectTypeOf(options.processorName).toEqualTypeOf<string | undefined>();
    });
    mts.onUpdateData<{ title: string }>((data, options) => {
      expectTypeOf(data).toEqualTypeOf<Readonly<{ title: string }>>();
      expectTypeOf(options).toEqualTypeOf<Readonly<MTSUpdateOptions>>();
    });
    mts.onReload<{ title: string }>((data, options) => {
      expectTypeOf(data).toEqualTypeOf<Readonly<{ title: string }>>();
      expectTypeOf(options).toEqualTypeOf<
        Readonly<import('../src/index.js').MTSReloadOptions>
      >();
    });
    mts.onGlobalPropsChanged<{ theme: string }>((props, options) => {
      expectTypeOf(props).toEqualTypeOf<Readonly<{ theme: string }>>();
      expectTypeOf(options).toEqualTypeOf<
        Readonly<MTSFlushContext> | undefined
      >();
    });
    card.onGlobalPropsChanged<{ theme: string }>((props) => {
      expectTypeOf(props).toEqualTypeOf<Readonly<{ theme: string }>>();
    });
    card.onUpdateData<{ count: number }>((data, options) => {
      expectTypeOf(data).toEqualTypeOf<Readonly<{ count: number }>>();
      expectTypeOf(options).toEqualTypeOf<Readonly<BTSUpdateOptions>>();
    });
    card.onReload<{ count: number }>((data, options) => {
      expectTypeOf(data).toEqualTypeOf<Readonly<{ count: number }>>();
      expectTypeOf(options).toEqualTypeOf<
        Readonly<import('../src/index.js').BTSReloadOptions>
      >();
    });
    card.onConfigChanged<{ mode: string }>((config) => {
      expectTypeOf(config).toEqualTypeOf<Readonly<{ mode: string }>>();
    });
    card.onGlobalEvent('untyped', (...args) => {
      expectTypeOf(args).toEqualTypeOf<unknown[]>();
    });
    card.onGlobalEvent<[{ visible: boolean }]>('visibility', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ visible: boolean }>();
    });
    card.onGlobalEvent<
      [status: 'on' | 'off', height: number, compatHeight: number]
    >('keyboardstatuschanged', (status, height, compatHeight) => {
      expectTypeOf(status).toEqualTypeOf<'on' | 'off'>();
      expectTypeOf(height).toEqualTypeOf<number>();
      expectTypeOf(compatHeight).toEqualTypeOf<number>();
    });
    card.onGlobalEvent(
      'exposure',
      (entries: Array<{ 'exposure-id': string }>) => {
        expectTypeOf(entries).toEqualTypeOf<Array<{ 'exposure-id': string }>>();
      },
    );
    // @ts-expect-error Explicit type argument must be a positional argument tuple.
    card.onGlobalEvent<{ visible: boolean }>('visibility', () => undefined);
    expectTypeOf<MTSFlushOptions>().toMatchTypeOf<MTSFlushContext>();
  };
  expectTypeOf(checkTypes).returns.toBeVoid();
});
