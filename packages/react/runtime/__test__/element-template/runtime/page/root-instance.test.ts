import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('root-instance', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize root with empty object when __BACKGROUND__ is true', async () => {
    vi.stubGlobal('__BACKGROUND__', true);
    const { __root } = await import('../../../../src/element-template/runtime/page/root-instance.js');

    expect(__root).toEqual({ nodeType: 1 });
  });

  it('should initialize root with empty object when __BACKGROUND__ is false', async () => {
    vi.stubGlobal('__BACKGROUND__', false);
    const { __root } = await import('../../../../src/element-template/runtime/page/root-instance.js');

    expect(__root).toEqual({ nodeType: 1 });
  });
});
