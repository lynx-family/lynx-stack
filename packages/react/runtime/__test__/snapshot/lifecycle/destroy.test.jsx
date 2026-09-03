import { act } from 'preact/test-utils';
import { beforeAll, describe, expect, test, rs } from '@rstest/core';

describe('Destroy', () => {
  const addEventListener = rs.fn();
  const removeEventListener = rs.fn();

  beforeAll(() => {
    lynx.getCoreContext = rs.fn(() => {
      return {
        addEventListener,
        removeEventListener,
      };
    });
  });

  test('should remove event listener when throw in cleanup', async function() {
    rs.resetModules();
    await import('../../../src/lynx');

    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    const { h, render } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const callback = rs.fn().mockImplementation(() => {
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
    expect(() => act(() => lynx.getApp().callDestroyLifetimeFun())).toThrow('???');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
