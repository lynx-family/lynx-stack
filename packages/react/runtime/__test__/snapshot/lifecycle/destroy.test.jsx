import { act } from 'preact/test-utils';
import { beforeAll, describe, expect, test, vi } from 'vitest';

describe('Destroy', () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeAll(() => {
    lynx.getCoreContext = vi.fn(() => {
      return {
        addEventListener,
        removeEventListener,
      };
    });
  });

  test('should remove event listener when throw in cleanup', async function() {
    vi.resetModules();
    await import('../../../src/lynx');

    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    const { h, render } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const callback = vi.fn().mockImplementation(() => {
      throw '???';
    });

    function Comp() {
      useEffect(() => callback, []);
      return null;
    }

    render(h(Comp), __root);
    await Promise.resolve().then(() => {});

    // Preact 11 defers passive-effect cleanups of unmounted components to the
    // after-paint flush; act() drains that flush synchronously and rethrows
    // the cleanup's error, so the assertion stays synchronous.
    expect(() => act(() => lynxCoreInject.tt.callDestroyLifetimeFun())).toThrow('???');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
