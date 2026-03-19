// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';
import webpack from 'webpack';

import { createLynxCacheEventsSetupListRuntimeModule } from '../src/LynxCacheEventsSetupListRuntimeModule.js';

interface CachedAction {
  type: string;
  data: {
    type: string;
    args: unknown[];
  };
}

interface SetupItem {
  name: string;
  setup: () => () => void;
}

interface RuntimeCache {
  loaded: boolean;
  cachedActions: CachedAction[];
  setupList: SetupItem[];
}

interface TtMethods {
  publishEvent?: (...args: unknown[]) => unknown;
  GlobalEventEmitter?: {
    addListener: (
      eventName: string,
      listener: (...args: unknown[]) => void,
    ) => void;
    removeListener: (
      eventName: string,
      listener: (...args: unknown[]) => void,
    ) => void;
    emit: (eventName: string, args: unknown[]) => void;
  };
}

interface RuntimeSandbox {
  __webpack_require__: {
    lynx_ce?: RuntimeCache;
  };
  lynxCoreInject: {
    tt: TtMethods;
  };
  loadDynamicComponent?: (...args: unknown[]) => unknown;
}

function createRuntimeSandbox(options: {
  tt?: TtMethods;
  loadDynamicComponent?: (...args: unknown[]) => unknown;
} = {}): {
  runtimeCache: RuntimeCache;
  sandbox: RuntimeSandbox;
} {
  const SetupListRuntimeModule = createLynxCacheEventsSetupListRuntimeModule(
    webpack,
  );
  const module = new SetupListRuntimeModule((setupList) => setupList);

  module.compilation = {
    compiler: {
      webpack,
    },
  } as webpack.Compilation;

  const generatedCode = module.generate();
  if (generatedCode === null) {
    throw new Error('Expected generated runtime code');
  }

  const sandbox: RuntimeSandbox = {
    __webpack_require__: {},
    lynxCoreInject: {
      tt: options.tt ?? {},
    },
  };
  if (options.loadDynamicComponent) {
    sandbox.loadDynamicComponent = options.loadDynamicComponent;
  }

  const context = vm.createContext(sandbox);
  new vm.Script(generatedCode).runInContext(context);

  const runtimeCache = sandbox.__webpack_require__.lynx_ce;
  if (!runtimeCache) {
    throw new Error('Expected lynx cache events runtime to be initialized');
  }

  return {
    runtimeCache,
    sandbox,
  };
}

function getSetupItem(runtimeCache: RuntimeCache, name: string): SetupItem {
  const setupItem = runtimeCache.setupList.find(item => item.name === name);
  if (!setupItem) {
    throw new Error(`Expected setup item "${name}"`);
  }
  return setupItem;
}

describe('LynxCacheEventsSetupListRuntimeModule', () => {
  it('caches and replays tt method calls', () => {
    const originalPublishEvent = vi.fn();
    const { runtimeCache, sandbox } = createRuntimeSandbox({
      tt: {
        publishEvent: originalPublishEvent,
      },
    });

    expect(runtimeCache.setupList.map(item => item.name)).toEqual([
      'ttMethod',
      'performanceEvent',
      'globalThis',
    ]);

    runtimeCache.loaded = false;
    runtimeCache.cachedActions = [];

    const cleanup = getSetupItem(runtimeCache, 'ttMethod').setup();
    sandbox.lynxCoreInject.tt.publishEvent?.('event-name', { foo: 'bar' });

    expect(originalPublishEvent).not.toHaveBeenCalled();
    expect(runtimeCache.cachedActions).toEqual([
      {
        type: 'ttMethod',
        data: {
          type: 'publishEvent',
          args: ['event-name', { foo: 'bar' }],
        },
      },
    ]);

    runtimeCache.loaded = true;
    cleanup();

    expect(originalPublishEvent).toHaveBeenCalledTimes(1);
    expect(originalPublishEvent).toHaveBeenCalledWith('event-name', {
      foo: 'bar',
    });

    sandbox.lynxCoreInject.tt.publishEvent?.('event-name-2');

    expect(originalPublishEvent).toHaveBeenCalledTimes(2);
    expect(originalPublishEvent).toHaveBeenLastCalledWith('event-name-2');
  });

  it('caches and replays performance events', () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const addListener = vi.fn(
      (eventName: string, listener: (...args: unknown[]) => void) => {
        listeners.set(eventName, listener);
      },
    );
    const removeListener = vi.fn(
      (eventName: string, listener: (...args: unknown[]) => void) => {
        if (listeners.get(eventName) === listener) {
          listeners.delete(eventName);
        }
      },
    );
    const emit = vi.fn((eventName: string, args: unknown[]) => {
      void eventName;
      void args;
    });

    const { runtimeCache } = createRuntimeSandbox({
      tt: {
        GlobalEventEmitter: {
          addListener,
          removeListener,
          emit,
        },
      },
    });

    runtimeCache.loaded = false;
    runtimeCache.cachedActions = [];

    const cleanup = getSetupItem(runtimeCache, 'performanceEvent').setup();
    const performanceListener = listeners.get(
      'lynx.performance.onPerformanceEvent',
    );
    if (!performanceListener) {
      throw new Error('Expected performance listener to be registered');
    }

    performanceListener('metric-name', 100);

    expect(runtimeCache.cachedActions).toEqual([
      {
        type: 'performanceEvent',
        data: {
          type: 'onPerformance',
          args: ['metric-name', 100],
        },
      },
    ]);

    runtimeCache.loaded = true;
    cleanup();

    expect(removeListener).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'lynx.performance.onPerformanceEvent',
      ['metric-name', 100],
    );
    expect(listeners.size).toBe(0);
  });

  it('caches and replays globalThis.loadDynamicComponent calls', () => {
    const originalLoadDynamicComponent = vi.fn();
    const { runtimeCache, sandbox } = createRuntimeSandbox({
      loadDynamicComponent: originalLoadDynamicComponent,
    });

    runtimeCache.loaded = false;
    runtimeCache.cachedActions = [];

    const cleanup = getSetupItem(runtimeCache, 'globalThis').setup();
    sandbox.loadDynamicComponent?.('card-a', { foo: 'bar' });

    expect(originalLoadDynamicComponent).not.toHaveBeenCalled();
    expect(runtimeCache.cachedActions).toEqual([
      {
        type: 'globalThisMethod',
        data: {
          type: 'loadDynamicComponent',
          args: ['card-a', { foo: 'bar' }],
        },
      },
    ]);

    runtimeCache.loaded = true;
    cleanup();

    expect(originalLoadDynamicComponent).toHaveBeenCalledTimes(1);
    expect(originalLoadDynamicComponent).toHaveBeenCalledWith('card-a', {
      foo: 'bar',
    });

    sandbox.loadDynamicComponent?.('card-b');

    expect(originalLoadDynamicComponent).toHaveBeenCalledTimes(2);
    expect(originalLoadDynamicComponent).toHaveBeenLastCalledWith('card-b');
  });
});
