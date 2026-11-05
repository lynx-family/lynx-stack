// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { startIndependentDSL } from './fixtures/independent-dsl.js';
import * as bts from '../src/bts.js';
import type { HostBTSApp, HostGlobalScope } from '../src/common/types.js';
import type {
  MTSFlushOptions as RootMTSFlushOptions,
  MTSReloadOptions as RootMTSReloadOptions,
} from '../src/index.js';
import {
  flushElementTree,
  onGlobalPropsChanged,
  onReload,
  onUpdateData,
} from '../src/mts.js';
import type {
  MTSFlushOptions,
  MTSReloadOptions,
  MTSUpdateOptions,
} from '../src/mts.js';

const host = globalThis as unknown as HostGlobalScope;

afterEach(() => {
  for (const app of Object.values(host.multiApps ?? {})) {
    app?.callDestroyLifetimeFun?.();
  }
  delete host.multiApps;
  delete host.currentAppId;
  delete host.SystemInfo;
  delete host.lynx;
  delete host.__FlushElementTree;
  delete host.renderPage;
  delete host.updatePage;
  delete host.updateGlobalProps;
  delete host.processData;
  delete host.getPageData;
  delete host.removeComponents;
});

function attachCard(id: string, cardType = 'independent'): HostBTSApp {
  const app: HostBTSApp = {
    nativeAppId: id,
    _params: {
      cardType,
      initData: { template: id, count: 0 },
      updateData: { count: 1 },
    },
    lynx: { __globalProps: { theme: 'light' } },
  };
  host.multiApps ??= {};
  host.multiApps[id] = app;
  host.currentAppId = id;
  return app;
}

describe('independent DSL adopter', () => {
  it.each([
    { platform: 'android', cardType: 'independent' },
    { platform: 'web', cardType: 'react' },
  ])(
    'owns state and rendering through the same API on $platform',
    ({ platform, cardType }) => {
      // Only the host harness knows delivery mode and private bootstrap fields.
      host.SystemInfo = { platform };
      const app = attachCard('a', cardType);
      const sink = { render: vi.fn(), destroy: vi.fn() };
      startIndependentDSL(sink);

      expect(sink.render).toHaveBeenLastCalledWith(
        { template: 'a', count: 1 },
        { theme: 'light' },
      );

      app.updateCardData?.({ count: 2, incremental: true });
      expect(sink.render).toHaveBeenLastCalledWith(
        { template: 'a', count: 2, incremental: true },
        { theme: 'light' },
      );
      app.updateCardData?.({ count: 3 }, { type: 1 });
      expect(sink.render).toHaveBeenLastCalledWith(
        { count: 3 },
        { theme: 'light' },
      );

      app.onAppReload?.({ count: 4, reloaded: true });
      expect(sink.render).toHaveBeenLastCalledWith(
        { template: 'a', count: 4, reloaded: true },
        { theme: 'light' },
      );
      app.updateGlobalProps?.({ theme: 'dark' });
      expect(sink.render).toHaveBeenLastCalledWith(
        { template: 'a', count: 4, reloaded: true },
        { theme: 'dark' },
      );

      // Existing sink inputs stay stable while the DSL replaces its own snapshots.
      expect(sink.render.mock.calls[0]).toEqual([
        { template: 'a', count: 1 },
        { theme: 'light' },
      ]);
      const update = app.updateCardData;
      const reload = app.onAppReload;
      const updateGlobalProps = app.updateGlobalProps;
      const destroy = app.callDestroyLifetimeFun;
      destroy?.();
      destroy?.();
      expect(sink.destroy).toHaveBeenCalledTimes(1);
      expect(app.updateCardData).toBeUndefined();
      expect(app.onAppReload).toBeUndefined();
      expect(app.updateGlobalProps).toBeUndefined();

      update?.({ count: 99 });
      reload?.({ count: 99 });
      updateGlobalProps?.({ theme: 'ignored' });
      expect(sink.render).toHaveBeenCalledTimes(5);
    },
  );

  it('keeps each adopter bound to its card after another card starts or is destroyed', () => {
    const first = attachCard('first');
    const firstSink = { render: vi.fn(), destroy: vi.fn() };
    startIndependentDSL(firstSink);
    const second = attachCard('second');
    const secondSink = { render: vi.fn(), destroy: vi.fn() };
    startIndependentDSL(secondSink);

    first.updateCardData?.({ firstOnly: true });
    first.updateGlobalProps?.({ theme: 'first-theme' });
    first.onAppReload?.({ count: 10 });
    expect(firstSink.render).toHaveBeenLastCalledWith(
      { template: 'first', count: 10 },
      { theme: 'first-theme' },
    );
    expect(secondSink.render).toHaveBeenCalledExactlyOnceWith(
      { template: 'second', count: 1 },
      { theme: 'light' },
    );

    first.callDestroyLifetimeFun?.();
    expect(firstSink.destroy).toHaveBeenCalledTimes(1);
    expect(secondSink.destroy).not.toHaveBeenCalled();
    second.updateCardData?.({ count: 20 });
    second.updateGlobalProps?.({ theme: 'second-theme' });
    expect(secondSink.render).toHaveBeenLastCalledWith(
      { template: 'second', count: 20 },
      { theme: 'second-theme' },
    );
    expect(firstSink.render).toHaveBeenCalledTimes(4);
  });
});

describe('independent DSL page flush', () => {
  it('passes update, reload, and global-props metadata directly to the page submission capability', () => {
    host.lynx = {};
    const flush = vi.fn();
    host.__FlushElementTree = flush;
    const render = vi.fn();
    const reload = vi.fn();
    const stopUpdate = onUpdateData((data, options) => {
      render(data);
      flushElementTree(options);
    });
    const stopReload = onReload((data, options) => {
      reload(data);
      flushElementTree(options);
    });
    const stopProps = onGlobalPropsChanged((_data, options) =>
      flushElementTree(options)
    );
    const updateOptions = Object.freeze({
      resetPageData: true,
      nativeUpdateDataOrder: 3,
      pipelineOptions: { pipelineID: 'host-update' },
    });
    const reloadOptions = Object.freeze({
      reloadTemplate: true,
      nativeUpdateDataOrder: 4,
      pipelineOptions: { pipelineID: 'host-reload' },
    });
    host.updatePage?.({ count: 2 }, updateOptions);
    expect(render).toHaveBeenCalledExactlyOnceWith({ count: 2 });
    expect(reload).not.toHaveBeenCalled();
    expect(flush.mock.calls[0]).toEqual([undefined, updateOptions]);
    expect(flush.mock.calls[0]?.[1]).toBe(updateOptions);
    host.updatePage?.({ count: 3 }, reloadOptions);
    expect(reload).toHaveBeenCalledExactlyOnceWith({ count: 3 });
    expect(flush.mock.calls[1]).toEqual([undefined, reloadOptions]);
    expect(flush.mock.calls[1]?.[1]).toBe(reloadOptions);
    host.updateGlobalProps?.({ theme: 'dark' }, updateOptions);
    expect(flush.mock.calls[2]?.[1]).toBe(updateOptions);
    host.updateGlobalProps?.({ theme: 'light' });
    expect(flush.mock.calls[3]).toEqual([]);
    stopUpdate();
    stopReload();
    stopProps();
    expect('flushElementTree' in bts).toBe(false);
  });

  it('exports page-only options without List, node or layout-callback parameters', () => {
    expectTypeOf<MTSFlushOptions>().toEqualTypeOf<RootMTSFlushOptions>();
    expectTypeOf<MTSReloadOptions>().toEqualTypeOf<RootMTSReloadOptions>();
    expectTypeOf<MTSUpdateOptions>().toExtend<MTSFlushOptions>();
    expectTypeOf<MTSReloadOptions>().toExtend<MTSFlushOptions>();
    // Match the opaque handle brands without depending on a DSL's ambient types.
    const elementTemplateHandleBrand: unique symbol = Symbol('element');
    interface FiberElement {
      readonly [elementTemplateHandleBrand]?: never;
    }
    interface ElementTemplateHandle {
      readonly [elementTemplateHandleBrand]: true;
    }
    const checkTypes = (
      element: FiberElement,
      handle: ElementTemplateHandle,
    ): void => {
      // @ts-expect-error Page submission does not accept a FiberElement.
      flushElementTree(element);
      // @ts-expect-error Page submission does not accept an ElementTemplateHandle.
      flushElementTree(handle);
      // @ts-expect-error List subtree options belong to the DSL's List adapter.
      flushElementTree({ listID: 1 });
      // @ts-expect-error List operation identity is not a page option.
      flushElementTree({ operationID: 1 });
      // @ts-expect-error asyncFlush requires a concrete subtree element.
      flushElementTree({ asyncFlush: true });
      // @ts-expect-error No asyncFlushRoot capability exists.
      flushElementTree({ asyncFlushRoot: true });
      // @ts-expect-error Experimental layout hooks are not public page options.
      flushElementTree({ onLayoutReady: () => undefined });
    };
    expectTypeOf(checkTypes).returns.toBeVoid();
  });
});
