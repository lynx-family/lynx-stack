import { afterEach, describe, expect, it, vi } from 'vitest';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('ElementTemplate native init', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    vi.resetModules();
    vi.doUnmock('../../../src/element-template/lynx/performance.js');
  });

  it('initializes timing api outside test env', async () => {
    process.env['NODE_ENV'] = 'production';
    envManager.resetEnv('background');

    const initTimingAPI = vi.fn();
    vi.doMock('../../../src/element-template/lynx/performance.js', () => ({
      initTimingAPI,
    }));

    await import('../../../src/element-template/native/index.js');

    expect(initTimingAPI).toHaveBeenCalledTimes(1);
  });
});
