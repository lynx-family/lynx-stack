import { beforeEach, describe, expect, it, vi } from 'vitest';

import { root } from '../../../../src/element-template/index.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

describe('ElementTemplate root render timing', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
  });

  it('does not eagerly render on main thread and only caches jsx on root', () => {
    envManager.switchToMainThread();
    const oldJsx = (__root as { __jsx?: unknown }).__jsx;

    root.render(<view id='main-thread' />);

    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(lynx.performance.profileEnd).not.toHaveBeenCalled();
    expect((__root as { __jsx?: unknown }).__jsx ?? oldJsx).toBeDefined();
  });

  it('wraps background render with profile timing', () => {
    root.render(<view />);

    const { performance } = lynx;
    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::renderBackground');
    expect(performance.profileEnd).toHaveBeenCalled();
  });
});
