import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('root-instance', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes the root as an element node for Preact debug', async () => {
    const { __root } = await import('../../../../src/element-template/runtime/page/root-instance.js');

    expect(__root).toEqual({ nodeType: 1 });
  });
});
