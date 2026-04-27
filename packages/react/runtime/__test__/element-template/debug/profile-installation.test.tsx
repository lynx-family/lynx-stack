import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

describe('initProfileHook installation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    envManager.resetEnv('background');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('can retry installation after profiling apis become available', async () => {
    const performance = globalThis.lynx.performance;
    const originalProfileStart = performance.profileStart;
    const originalProfileEnd = performance.profileEnd;
    const originalProfileMark = performance.profileMark;
    const originalProfileFlowId = performance.profileFlowId;

    performance.profileStart = undefined;
    performance.profileEnd = undefined;
    performance.profileMark = undefined;
    performance.profileFlowId = undefined;

    const { initProfileHook } = await import('../../../src/element-template/debug/profile.js');
    initProfileHook();

    performance.profileStart = originalProfileStart;
    performance.profileEnd = originalProfileEnd;
    performance.profileMark = originalProfileMark;
    performance.profileFlowId = originalProfileFlowId;

    const { root } = await import('../../../src/element-template/client/root.js');

    function Foo() {
      return null;
    }

    initProfileHook();
    root.render(<Foo />);

    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::render::Foo');
  });
});
