import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

describe('root-instance', () => {
  beforeEach(() => {
    rs.resetModules();
  });

  afterEach(() => {
    rs.unstubAllGlobals();
  });

  it('should initialize root with empty object when __BACKGROUND__ is true', async () => {
    rs.stubGlobal('__BACKGROUND__', true);
    const { __root } = await import('../../../../src/element-template/runtime/page/root-instance.js');

    expect(__root).toEqual({ nodeType: 1 });
  });

  it('should initialize root with empty object when __BACKGROUND__ is false', async () => {
    rs.stubGlobal('__BACKGROUND__', false);
    const { __root } = await import('../../../../src/element-template/runtime/page/root-instance.js');

    expect(__root).toEqual({ nodeType: 1 });
  });
});
