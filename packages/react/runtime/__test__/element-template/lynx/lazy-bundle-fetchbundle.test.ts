import type { ComponentType } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadLazyBundle } from '../../../src/element-template/lynx/lazy-bundle.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

interface LazyExports {
  default: ComponentType<Record<string, never>>;
  data?: string;
}

interface FetchResponse {
  code: number;
  url: string;
}

type FetchBundle = (url: string, options?: unknown) => {
  wait: (timeout: number) => FetchResponse | undefined;
  then: (onResolve: (response: FetchResponse | undefined) => void) => void;
};
type LoadScript = <T>(section: string, options: { bundleName: string }) => T;

type LynxWithFetch = typeof lynx & {
  fetchBundle?: FetchBundle;
  loadScript?: LoadScript;
};

const envManager = new ElementTemplateEnvManager();
const TestComponent = (() => null) as ComponentType<Record<string, never>>;

function makeExports(data: string): LazyExports {
  return { default: TestComponent, data };
}

// A `fetchBundle` whose handler resolves synchronously (the bundle is already
// in the native cache), mirroring the real FetchBundle behavior.
function syncFetch(response: FetchResponse | undefined): FetchBundle {
  return vi.fn(() => ({
    wait: () => response,
    then: (onResolve) => onResolve(response),
  }));
}

const l = () => lynx as LynxWithFetch;

describe('element-template loadLazyBundle (FetchBundle)', () => {
  let originalFetchBundle: FetchBundle | undefined;
  let originalLoadScript: LoadScript | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
    originalFetchBundle = l().fetchBundle;
    originalLoadScript = l().loadScript;
  });

  afterEach(() => {
    l().fetchBundle = originalFetchBundle;
    l().loadScript = originalLoadScript;
    envManager.resetEnv('background');
  });

  // --- main thread ---

  it('main thread async mode stays pending (background-driven)', async () => {
    envManager.resetEnv('main');
    const fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().fetchBundle = fetchBundle;

    const promise = loadLazyBundle<LazyExports>('entry', 'async');
    let settled = false;
    void promise.then(() => (settled = true), () => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(fetchBundle).not.toHaveBeenCalled();
  });

  it('main thread sync mode loads the main-thread section synchronously', () => {
    envManager.resetEnv('main');
    l().fetchBundle = syncFetch({ code: 0, url: 'resolved-url' });
    const loadScript = vi.fn(() => makeExports('mt')) as unknown as LoadScript;
    l().loadScript = loadScript;

    const promise = loadLazyBundle<LazyExports>('entry', 'sync');

    expect(loadScript).toHaveBeenCalledWith('main-thread', {
      bundleName: 'resolved-url',
    });
    let fulfilled = false;
    void promise.then((exports) => {
      expect(exports.data).toBe('mt');
      fulfilled = true;
    });
    expect(fulfilled).toBe(true);
  });

  it('main thread sync mode stays pending when fetchBundle throws', async () => {
    envManager.resetEnv('main');
    l().fetchBundle = vi.fn(() => {
      throw new Error('fetch failed');
    }) as unknown as FetchBundle;

    await expectPending(loadLazyBundle<LazyExports>('entry', 'sync'));
  });

  it('main thread sync mode stays pending on a failed response', async () => {
    envManager.resetEnv('main');
    l().fetchBundle = syncFetch({ code: 1, url: 'u' });
    await expectPending(loadLazyBundle<LazyExports>('entry', 'sync'));
  });

  it('main thread sync mode stays pending when the response is missing', async () => {
    envManager.resetEnv('main');
    l().fetchBundle = syncFetch(undefined);
    await expectPending(loadLazyBundle<LazyExports>('entry', 'sync'));
  });

  it('main thread sync mode stays pending when loadScript throws', async () => {
    envManager.resetEnv('main');
    l().fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().loadScript = (() => {
      throw new Error('eval failed');
    }) as unknown as LoadScript;
    await expectPending(loadLazyBundle<LazyExports>('entry', 'sync'));
  });

  // --- background, sync mode ---

  it('background sync mode loads the background section synchronously', () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'bg-url' });
    const loadScript = vi.fn(() => makeExports('bg')) as unknown as LoadScript;
    l().loadScript = loadScript;

    const promise = loadLazyBundle<LazyExports>('entry', 'sync');
    expect(loadScript).toHaveBeenCalledWith('background', { bundleName: 'bg-url' });
    let fulfilled = false;
    void promise.then((exports) => {
      expect(exports.data).toBe('bg');
      fulfilled = true;
    });
    expect(fulfilled).toBe(true);
  });

  it('background sync mode rejects when fetchBundle throws (Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = vi.fn(() => {
      throw new Error('boom');
    }) as unknown as FetchBundle;
    await expect(loadLazyBundle<LazyExports>('entry', 'sync')).rejects.toThrow('boom');
  });

  it('background sync mode rejects when fetchBundle throws (non-Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string failure';
    }) as unknown as FetchBundle;
    await expect(loadLazyBundle<LazyExports>('entry', 'sync')).rejects.toThrow(
      'string failure',
    );
  });

  it('background sync mode rejects with cause on a failed response', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 1, url: 'u' });
    await expect(
      loadLazyBundle<LazyExports>('entry', 'sync').catch(
        (error: Error & { cause?: unknown }) => {
          expect(error.cause).toBe('{"code":1,"url":"u"}');
          throw error;
        },
      ),
    ).rejects.toThrow('Lazy bundle load failed, schema: entry');
  });

  it('background sync mode rejects when loadScript throws (Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().loadScript = (() => {
      throw new Error('eval failed');
    }) as unknown as LoadScript;
    await expect(loadLazyBundle<LazyExports>('entry', 'sync')).rejects.toThrow(
      'eval failed',
    );
  });

  it('background sync mode rejects when loadScript throws (non-Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().loadScript = (() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'sync eval string';
    }) as unknown as LoadScript;
    await expect(loadLazyBundle<LazyExports>('entry', 'sync')).rejects.toThrow(
      'sync eval string',
    );
  });

  // --- background, async mode (default) ---

  it('background async mode resolves the background section', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'bg-url' });
    l().loadScript = vi.fn(() => makeExports('async')) as unknown as LoadScript;

    await expect(loadLazyBundle<LazyExports>('entry')).resolves.toMatchObject({
      data: 'async',
    });
  });

  it('background async mode rejects when fetchBundle throws (non-Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'async string failure';
    }) as unknown as FetchBundle;
    await expect(loadLazyBundle<LazyExports>('entry', 'async')).rejects.toThrow(
      'async string failure',
    );
  });

  it('background async mode rejects when fetchBundle throws (Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = vi.fn(() => {
      throw new Error('async boom');
    }) as unknown as FetchBundle;
    await expect(loadLazyBundle<LazyExports>('entry', 'async')).rejects.toThrow(
      'async boom',
    );
  });

  it('background async mode rejects with cause on a failed response', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 1, url: 'u' });
    await expect(
      loadLazyBundle<LazyExports>('entry', 'async').catch(
        (error: Error & { cause?: unknown }) => {
          expect(error.cause).toBe('{"code":1,"url":"u"}');
          throw error;
        },
      ),
    ).rejects.toThrow('Lazy bundle load failed, schema: entry');
  });

  it('background async mode rejects when loadScript throws (Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().loadScript = (() => {
      throw new Error('async eval failed');
    }) as unknown as LoadScript;
    await expect(loadLazyBundle<LazyExports>('entry', 'async')).rejects.toThrow(
      'async eval failed',
    );
  });

  it('background async mode rejects when loadScript throws (non-Error)', async () => {
    envManager.resetEnv('background');
    l().fetchBundle = syncFetch({ code: 0, url: 'u' });
    l().loadScript = (() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'async eval string';
    }) as unknown as LoadScript;
    await expect(loadLazyBundle<LazyExports>('entry', 'async')).rejects.toThrow(
      'async eval string',
    );
  });

  it('throws in unsupported execution environments', () => {
    envManager.resetEnv('background');
    globalThis.__JS__ = false;
    globalThis.__MAIN_THREAD__ = false;
    expect(() => loadLazyBundle<LazyExports>('entry', 'sync')).toThrow('unreachable');
  });
});

async function expectPending(promise: Promise<unknown>): Promise<void> {
  let settled = false;
  void promise.then(() => (settled = true), () => (settled = true));
  await Promise.resolve();
  expect(settled).toBe(false);
}
