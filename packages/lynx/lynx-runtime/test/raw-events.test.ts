// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindPage } from '../src/bts.js';
import { startIndependentEventDSL } from './fixtures/independent-events.js';
import type { HostBTSApp, HostGlobalScope } from '../src/common/types.js';

const host = globalThis as unknown as HostGlobalScope;

function attachCard(id: string): HostBTSApp {
  const app: HostBTSApp = { nativeAppId: id };
  host.multiApps ??= {};
  host.multiApps[id] = app;
  host.currentAppId = id;
  return app;
}

afterEach(() => {
  for (const app of Object.values(host.multiApps ?? {})) {
    app?.callDestroyLifetimeFun?.();
  }
  delete host.multiApps;
  delete host.currentAppId;
});

describe('raw BTS event handler', () => {
  it('supports an independent DSL that owns event lookup, state and synchronous results', () => {
    const app = attachCard('independent');
    const render = vi.fn();
    const stop = startIndependentEventDSL(render);
    expect(app.publishEvent?.('increment', { amount: 2 })).toBe(2);
    expect(app.publicComponentEvent?.('button-7', 'increment', { amount: 3 }))
      .toBe(3);
    expect(app.publicComponentEvent?.('button-7', 'increment', { amount: 4 }))
      .toBe(7);
    expect(render.mock.calls).toEqual([['page', 2], ['button-7', 3], [
      'button-7',
      7,
    ]]);
    stop();
    expect(app.publishEvent?.('increment', { amount: 100 })).toBeUndefined();
    expect(app.publicComponentEvent?.('button-7', 'increment', { amount: 100 }))
      .toBeUndefined();
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('owns both entries together and preserves data, optional component identity, extra arguments and results', () => {
    const app = attachCard('a');
    const legacyPage = vi.fn(() => 'legacy-page');
    const legacyComponent = vi.fn(() => 'legacy-component');
    app.publishEvent = legacyPage;
    app.publicComponentEvent = legacyComponent;
    bindPage();
    expect(app.publishEvent).toBe(legacyPage);
    expect(app.publicComponentEvent).toBe(legacyComponent);

    const data = { type: 'tap' };
    const result = { handled: true };
    let handlerThis: unknown = app;
    const handler = vi.fn(
      function(
        this: void,
        _name: string,
        _data: unknown,
        componentId?: string,
      ) {
        handlerThis = this;
        return componentId === undefined ? result : false;
      },
    );
    bindPage().setEventHandler(handler);
    expect(app.publishEvent?.('opaque:handler', data, 0)).toBe(result);
    expect(handler).toHaveBeenLastCalledWith('opaque:handler', data, undefined);
    expect(handler.mock.calls[0]?.[1]).toBe(data);
    expect(handlerThis).toBeUndefined();
    expect(
      app.publicComponentEvent?.(
        'component-7',
        'opaque:handler',
        data,
        'extra',
      ),
    ).toBe(false);
    expect(handler).toHaveBeenLastCalledWith(
      'opaque:handler',
      data,
      'component-7',
    );
    // Empty Native IDs are still component-entry inputs, not page aliases.
    expect(app.publicComponentEvent?.('', 'opaque:handler', data)).toBe(false);
    expect(handler.mock.calls[2]?.[2]).toBe('');
    expect(legacyPage).not.toHaveBeenCalled();
    expect(legacyComponent).not.toHaveBeenCalled();
  });

  it.each(['page', 'component'] as const)(
    'replaces the shared owner from a %s call without reviving old handlers',
    (source) => {
      const app = attachCard('a');
      const card = bindPage();
      const invoke = (): unknown =>
        source === 'page'
          ? app.publishEvent?.('handler', {})
          : app.publicComponentEvent?.('component', 'handler', {});
      const a = vi.fn(() => 'a');
      const b = vi.fn(() => 'b');
      const stopA = card.setEventHandler(a);
      const pageEntry = app.publishEvent;
      const componentEntry = app.publicComponentEvent;
      const stopB = card.setEventHandler(b);
      stopA();
      expect(invoke()).toBe('b');
      expect(app.publishEvent?.('handler', {})).toBe('b');
      expect(app.publicComponentEvent?.('component', 'handler', {})).toBe('b');
      expect(app.publishEvent).toBe(pageEntry);
      expect(app.publicComponentEvent).toBe(componentEntry);
      expect(a).not.toHaveBeenCalled();
      stopB();
      stopB();
      expect(app.publishEvent?.('handler', {})).toBeUndefined();
      expect(app.publicComponentEvent?.('component', 'handler', {}))
        .toBeUndefined();
      expect(b).toHaveBeenCalledTimes(3);

      const stopFirst = card.setEventHandler(a);
      const stopSecond = card.setEventHandler(a);
      stopFirst();
      expect(invoke()).toBe('a');
      stopSecond();
      expect(invoke()).toBeUndefined();
    },
  );

  it('binds both entries to each card across asynchronous work, reload and destruction', async () => {
    const appA = attachCard('a');
    const legacyDestroy = vi.fn(() => {
      expect(appA.publishEvent?.('during-destroy', {})).toBeUndefined();
      expect(appA.publicComponentEvent?.('component', 'during-destroy', {}))
        .toBeUndefined();
    });
    appA.callDestroyLifetimeFun = legacyDestroy;
    const a = bindPage();
    const handlerA = vi.fn((
      _name: string,
      _data: unknown,
      componentId?: string,
    ) => componentId === undefined ? 'a' : 'component-a');
    const stopA = a.setEventHandler(handlerA);
    const cachedPage = appA.publishEvent!;
    const cachedComponent = appA.publicComponentEvent!;

    const appB = attachCard('b');
    const b = bindPage();
    b.setEventHandler((_name, _data, componentId) =>
      componentId === undefined ? 'b' : 'component-b'
    );
    await Promise.resolve();
    a.setEventHandler(handlerA);
    stopA();
    appA.onAppReload?.({ reloaded: true });
    expect(appA.publishEvent).toBe(cachedPage);
    expect(appA.publicComponentEvent).toBe(cachedComponent);
    expect(appA.publishEvent?.('handler', {})).toBe('a');
    expect(appA.publicComponentEvent?.('component', 'handler', {})).toBe(
      'component-a',
    );
    appA.callDestroyLifetimeFun?.();
    expect(legacyDestroy).toHaveBeenCalledTimes(1);
    expect(cachedPage('handler', {})).toBeUndefined();
    expect(cachedComponent('component', 'handler', {})).toBeUndefined();
    expect(appA.publishEvent?.('handler', {})).toBeUndefined();
    expect(appA.publicComponentEvent?.('component', 'handler', {}))
      .toBeUndefined();
    expect(() => a.setEventHandler(handlerA)).toThrow('destroyed page');
    expect(appB.publishEvent?.('handler', {})).toBe('b');
    expect(appB.publicComponentEvent?.('component', 'handler', {})).toBe(
      'component-b',
    );
    expect(handlerA).toHaveBeenCalledTimes(2);
  });

  it('preserves the current result when a page handler replaces itself before a nested component call', () => {
    const app = attachCard('a');
    const card = bindPage();
    const next = vi.fn(() => 'next');
    card.setEventHandler(() => {
      card.setEventHandler(next);
      expect(app.publicComponentEvent?.('component', 'nested', {})).toBe(
        'next',
      );
      return 'current';
    });
    expect(app.publishEvent?.('outer', {})).toBe('current');
    expect(app.publishEvent?.('later', {})).toBe('next');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('propagates errors and returns opaque results without creating an asynchronous response protocol', () => {
    const app = attachCard('a');
    const card = bindPage();
    const failure = new Error('handler failed');
    card.setEventHandler(() => {
      throw failure;
    });
    expect(() => app.publishEvent?.('handler', {})).toThrow(failure);
    expect(() => app.publicComponentEvent?.('component', 'handler', {}))
      .toThrow(failure);
    const promise = Promise.resolve(42);
    card.setEventHandler(() => promise);
    expect(app.publishEvent?.('handler', {})).toBe(promise);
    const readThen = vi.fn();
    const opaqueResult = {
      get then() {
        readThen();
        return () => 42;
      },
    };
    card.setEventHandler(() => opaqueResult);
    expect(app.publicComponentEvent?.('component', 'handler', {})).toBe(
      opaqueResult,
    );
    expect(readThen).not.toHaveBeenCalled();
    card.onDestroy(() => {
      expect(() => card.setEventHandler(() => 42)).toThrow('destroyed page');
    });
    app.callDestroyLifetimeFun?.();
  });
});
