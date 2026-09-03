import { afterEach, describe, expect, it, rs } from '@rstest/core';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('ElementTemplate native init', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    rs.resetModules();
    rs.doUnmock('../../../src/element-template/lynx/performance.js');
  });

  it('initializes timing api outside test env', async () => {
    process.env['NODE_ENV'] = 'production';
    envManager.resetEnv('background');

    const initTimingAPI = rs.fn();
    rs.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(initTimingAPI).toHaveBeenCalledTimes(1);
  });
});
