import { beforeAll, describe, expect, test, rstest } from '@rstest/core';
// `rstest.resetModules()` must be a literal call (module-mock APIs are not
// aliasable through `vitest`).
import { rstest } from '@rstest/core';

describe('Destroy', () => {
  const addEventListener = rstest.fn();
  const removeEventListener = rstest.fn();

  beforeAll(() => {
    lynx.getCoreContext = rstest.fn(() => {
      return {
        addEventListener,
        removeEventListener,
      };
    });
  });

  test('should remove event listener when throw in cleanup', async function() {
    rstest.resetModules();
    await import('../../../src/lynx');

    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    const { h, render } = await import('preact');
    const { useEffect } = await import('../../../src/index');
    const { __root } = await import('../../../src/root');

    const callback = rstest.fn().mockImplementation(() => {
      throw '???';
    });

    function Comp() {
      useEffect(() => callback, []);
      return null;
    }

    render(h(Comp), __root);
    await Promise.resolve().then(() => {});

    expect(() => lynxCoreInject.tt.callDestroyLifetimeFun()).toThrow('???');

    await Promise.resolve().then(() => {});
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
