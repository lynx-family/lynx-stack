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
    // after-paint flush: the cleanup's throw no longer propagates out of
    // `callDestroyLifetimeFun` but is routed to `options._catchError`
    // asynchronously.
    const { options } = await import('preact');
    const { CATCH_ERROR } = await import('../../../src/shared/render-constants');
    const caught = [];
    const prevCatchError = options[CATCH_ERROR];
    options[CATCH_ERROR] = (e) => {
      caught.push(e);
    };

    // act() drains the deferred cleanups synchronously; the throwing cleanup
    // is routed to options._catchError inside the flush.
    expect(() => act(() => lynx.getApp().callDestroyLifetimeFun())).not.toThrow();

    options[CATCH_ERROR] = prevCatchError;

    expect(caught).toEqual(['???']);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
