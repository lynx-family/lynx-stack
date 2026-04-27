import { describe, expect, it, vi } from 'vitest';

const resetElementTemplateHydrationListener = vi.fn();

vi.mock('../../../src/element-template/background/hydration-listener.js', () => ({
  resetElementTemplateHydrationListener,
}));

describe('callDestroyLifetimeFun', () => {
  it('resets the hydration listener', async () => {
    const { callDestroyLifetimeFun } = await import('../../../src/element-template/native/callDestroyLifetimeFun.js');

    callDestroyLifetimeFun();

    expect(resetElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
  });
});
