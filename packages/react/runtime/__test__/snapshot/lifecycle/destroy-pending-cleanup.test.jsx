import { beforeAll, describe, expect, test, vi } from 'vitest';

describe('page destroy with queued unmount cleanups', () => {
  beforeAll(() => {
    lynx.getCoreContext = vi.fn(() => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  test('runs a cleanup deferred by an earlier unmount', async () => {
    vi.resetModules();
    await import('../../../src/lynx');

    const { h, render, Fragment } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const cleanup = vi.fn();
    function WithEffect() {
      useEffect(() => cleanup, []);
      return null;
    }
    function WithoutHooks() {
      return null;
    }

    render(h(Fragment, null, h(WithEffect, null), h(WithoutHooks, null)), __root);
    await Promise.resolve().then(() => {});

    // Removing it queues the cleanup for the after-paint flush.
    render(h(Fragment, null, h(WithoutHooks, null)), __root);
    expect(cleanup).toHaveBeenCalledTimes(0);

    // Destroy before that flush runs. Nothing left in the tree has a passive
    // effect, so no later `afterPaint` reschedules the queued flush.
    lynx.getApp().callDestroyLifetimeFun();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('still runs it when another effect component unmounts during destroy', async () => {
    vi.resetModules();
    await import('../../../src/lynx');

    const { h, render, Fragment } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const removedCleanup = vi.fn();
    const remainingCleanup = vi.fn();
    function Removed() {
      useEffect(() => removedCleanup, []);
      return null;
    }
    function Remaining() {
      useEffect(() => remainingCleanup, []);
      return null;
    }

    render(h(Fragment, null, h(Removed, null), h(Remaining, null)), __root);
    await Promise.resolve().then(() => {});

    render(h(Fragment, null, h(Remaining, null)), __root);
    expect(removedCleanup).toHaveBeenCalledTimes(0);

    lynx.getApp().callDestroyLifetimeFun();

    expect(remainingCleanup).toHaveBeenCalledTimes(1);
    expect(removedCleanup).toHaveBeenCalledTimes(1);
  });

  test('runs it on the reload path too', async () => {
    vi.resetModules();
    await import('../../../src/lynx');

    const { h, render, Fragment } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');
    const { reloadBackground } = await import('../../../src/snapshot/lifecycle/reload');

    const cleanup = vi.fn();
    function WithEffect() {
      useEffect(() => cleanup, []);
      return null;
    }
    function WithoutHooks() {
      return null;
    }

    render(h(Fragment, null, h(WithEffect, null), h(WithoutHooks, null)), __root);
    await Promise.resolve().then(() => {});

    render(h(Fragment, null, h(WithoutHooks, null)), __root);
    expect(cleanup).toHaveBeenCalledTimes(0);

    reloadBackground({});

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
