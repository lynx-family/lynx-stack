import type { ComponentType } from 'preact';
import { afterEach, beforeEach, describe, expect, it, rstest as vi } from '@rstest/core';

import { loadLazyBundle } from '../../../src/core/lynx/lazy-bundle.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

interface LazyExports {
  default: ComponentType<Record<string, never>>;
  data?: string;
}

interface QueryComponentResult {
  code: number;
  detail: {
    schema: string;
    errMsg?: string;
  };
}

type QueryComponentCallback = (result: QueryComponentResult) => void;

type GlobalWithLazyBundleMocks = typeof globalThis & {
  __QueryComponent?: (source: string) => { evalResult: LazyExports } | undefined;
};

type LynxWithQuery = typeof lynx & {
  QueryComponent?: (source: string, callback: QueryComponentCallback) => void;
};

type DynamicExportsGetter = (schema: string) => LazyExports | undefined;

const envManager = new ElementTemplateEnvManager();
const g = globalThis as GlobalWithLazyBundleMocks;
const TestComponent = (() => null) as ComponentType<Record<string, never>>;

function makeExports(data: string): LazyExports {
  return {
    default: TestComponent,
    data,
  };
}

function restoreProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value === undefined) {
    delete target[key];
    return;
  }

  target[key] = value;
}

describe('element-template loadLazyBundle', () => {
  let originalQueryComponent: typeof g.__QueryComponent;
  let originalLynxQueryComponent: LynxWithQuery['QueryComponent'];
  let originalGetNativeLynx: typeof lynx.getNativeLynx;
  let originalGetDynamicComponentExports: DynamicExportsGetter | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');

    originalQueryComponent = g.__QueryComponent;
    originalLynxQueryComponent = (lynx as LynxWithQuery).QueryComponent;
    originalGetNativeLynx = lynx.getNativeLynx;
    originalGetDynamicComponentExports = (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports;
  });

  afterEach(() => {
    restoreProperty(g, '__QueryComponent', originalQueryComponent);
    restoreProperty(lynx as LynxWithQuery, 'QueryComponent', originalLynxQueryComponent);
    lynx.getNativeLynx = originalGetNativeLynx;
    restoreProperty(
      lynxCoreInject.tt as typeof lynxCoreInject.tt & {
        getDynamicComponentExports?: DynamicExportsGetter;
      },
      'getDynamicComponentExports',
      originalGetDynamicComponentExports,
    );
    envManager.resetEnv('background');
  });

  it('returns main-thread query results with synchronous then semantics', () => {
    envManager.resetEnv('main');
    const __QueryComponent = vi.fn(() => ({ evalResult: makeExports('main') }));
    g.__QueryComponent = __QueryComponent;

    const promise = loadLazyBundle<LazyExports>('entry-main');

    expect(__QueryComponent).toHaveBeenCalledWith('entry-main');
    expect(promise.then()).toBe(promise);

    let fulfilled = false;
    const primitivePromise = promise.then((exports) => {
      expect(exports.data).toBe('main');
      fulfilled = true;
      return 'primitive';
    });
    expect(fulfilled).toBe(true);

    let primitiveChained = false;
    primitivePromise.then((value) => {
      expect(value).toBe('primitive');
      primitiveChained = true;
    });
    expect(primitiveChained).toBe(true);

    let voidFulfilled = false;
    const voidPromise = promise.then(() => {
      voidFulfilled = true;
    });
    expect(voidFulfilled).toBe(true);

    let voidChained = false;
    voidPromise.then((value) => {
      expect(value).toBeUndefined();
      voidChained = true;
    });
    expect(voidChained).toBe(true);
  });

  it('preserves thenable returns and rejected sync then callbacks', async () => {
    envManager.resetEnv('main');
    const __QueryComponent = vi.fn(() => ({ evalResult: makeExports('main') }));
    g.__QueryComponent = __QueryComponent;

    const promise = loadLazyBundle<LazyExports>('entry-main');
    const thenablePromise = promise.then(() => ({
      then(onFulfilled: (value: string) => Promise<string>) {
        return onFulfilled('thenable');
      },
    }));

    let thenableFulfilled = false;
    const asyncPromise = thenablePromise.then((value) => {
      expect(value).toBe('thenable');
      thenableFulfilled = true;
      return Promise.resolve('async');
    });
    expect(thenableFulfilled).toBe(true);
    await expect(asyncPromise).resolves.toBe('async');

    await expect(
      promise.then(() => {
        throw new Error('sync then failed');
      }),
    ).rejects.toThrow('sync then failed');
  });

  it('keeps main-thread failed query results pending forever', async () => {
    envManager.resetEnv('main');
    const query = {};
    Object.defineProperty(query, 'evalResult', {
      get() {
        throw new Error('not parsed yet');
      },
    });
    const __QueryComponent = vi.fn(() => query as { evalResult: LazyExports });
    g.__QueryComponent = __QueryComponent;

    const promise = loadLazyBundle<LazyExports>('entry-main');

    expect(__QueryComponent).toHaveBeenCalledWith('entry-main');
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it('returns synchronously resolved background QueryComponent exports', () => {
    envManager.resetEnv('background');
    const QueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      callback({ code: 0, detail: { schema: source } });
    });
    const getDynamicComponentExports = vi.fn((schema: string) => makeExports(schema));
    (lynx as LynxWithQuery).QueryComponent = QueryComponent;
    (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports = getDynamicComponentExports;

    const promise = loadLazyBundle<LazyExports>('entry-background');

    expect(QueryComponent).toHaveBeenCalledWith('entry-background', expect.any(Function));
    expect(getDynamicComponentExports).toHaveBeenCalledWith('entry-background');

    let fulfilled = false;
    promise.then((exports) => {
      expect(exports.data).toBe('entry-background');
      fulfilled = true;
    });
    expect(fulfilled).toBe(true);
  });

  it('resolves and rejects asynchronous background QueryComponent callbacks', async () => {
    envManager.resetEnv('background');
    const callbacks = new Map<string, QueryComponentCallback>();
    const QueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      callbacks.set(source, callback);
    });
    const getDynamicComponentExports = vi.fn((schema: string) => makeExports(schema));
    (lynx as LynxWithQuery).QueryComponent = QueryComponent;
    (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports = getDynamicComponentExports;

    const resolvedPromise = loadLazyBundle<LazyExports>('entry-async');
    let resolvedSynchronously = false;
    resolvedPromise.then(() => {
      resolvedSynchronously = true;
    });
    expect(resolvedSynchronously).toBe(false);

    callbacks.get('entry-async')?.({ code: 0, detail: { schema: 'entry-async' } });
    await expect(resolvedPromise).resolves.toMatchObject({ data: 'entry-async' });
    expect(resolvedSynchronously).toBe(true);

    const rejectedPromise = loadLazyBundle<LazyExports>('entry-reject');
    callbacks.get('entry-reject')?.({
      code: 1,
      detail: { schema: 'entry-reject', errMsg: 'failed' },
    });
    await expect(rejectedPromise.catch((error: Error & { cause?: unknown }) => {
      expect(error.cause).toBe(
        '{"code":1,"detail":{"schema":"entry-reject","errMsg":"failed"}}',
      );
      throw error;
    })).rejects.toThrow('Lazy bundle load failed, schema: entry-reject');
  });

  it('rejects synchronously when parsed background exports are unavailable', async () => {
    envManager.resetEnv('background');
    const QueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      callback({ code: 0, detail: { schema: source } });
    });
    const getDynamicComponentExports = vi.fn(() => undefined);
    (lynx as LynxWithQuery).QueryComponent = QueryComponent;
    (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports = getDynamicComponentExports;

    const promise = loadLazyBundle<LazyExports>('entry-missing');

    await expect(promise.catch((error: Error & { cause?: unknown }) => {
      expect(error.cause).toBe('{"code":0,"detail":{"schema":"entry-missing"}}');
      throw error;
    })).rejects.toThrow('Lazy bundle load failed, schema: entry-missing');
  });

  it('falls back to native QueryComponent when lynx.QueryComponent is unavailable', () => {
    envManager.resetEnv('background');
    const nativeQueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      callback({ code: 0, detail: { schema: source } });
    });
    const getDynamicComponentExports = vi.fn((schema: string) => makeExports(schema));
    delete (lynx as LynxWithQuery).QueryComponent;
    lynx.getNativeLynx = () =>
      ({
        QueryComponent: nativeQueryComponent,
      }) as ReturnType<typeof lynx.getNativeLynx>;
    (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports = getDynamicComponentExports;

    const promise = loadLazyBundle<LazyExports>('entry-native');

    expect(nativeQueryComponent).toHaveBeenCalledWith('entry-native', expect.any(Function));
    let fulfilled = false;
    promise.then((exports) => {
      expect(exports.data).toBe('entry-native');
      fulfilled = true;
    });
    expect(fulfilled).toBe(true);
  });

  it('throws in unsupported execution environments', () => {
    envManager.resetEnv('background');
    globalThis.__LEPUS__ = false;
    globalThis.__JS__ = false;

    expect(() => loadLazyBundle<LazyExports>('entry-unreachable')).toThrow('unreachable');
  });
});
