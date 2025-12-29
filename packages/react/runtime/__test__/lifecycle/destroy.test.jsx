import { render } from 'preact';
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
    await import('../../src/lynx');

    expect(addEventListener).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    const { useEffect } = await import('../../src/index');
    const { __root } = await import('../../src/root');

    const callback = vi.fn().mockImplementation(() => {
      throw '???';
    });

    function Comp() {
      useEffect(() => callback, []);
      return null;
    }

    render(<Comp />, __root);
    await Promise.resolve().then(() => {});

    expect(() => lynxCoreInject.tt.callDestroyLifetimeFun()).toThrow('???');

    await Promise.resolve().then(() => {});
    expect(callback).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(addEventListener.mock.calls.length);
  });
});
