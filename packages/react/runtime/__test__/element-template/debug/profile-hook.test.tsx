import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { options } from 'preact';

import { root } from '../../../src/element-template/index.js';
import { initProfileHook } from '../../../src/element-template/debug/profile.js';
import { GlobalCommitContext } from '../../../src/element-template/background/commit-context.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';
import { COMMIT } from '../../../src/shared/render-constants.js';

describe('element-template initProfileHook', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeAll(() => {
    initProfileHook();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
  });

  it('profiles diff and render using displayName', () => {
    class ClassComponent {
      render() {
        return null;
      }

      static displayName = 'Clazz';
    }

    function Bar() {
      return <ClassComponent />;
    }
    Bar.displayName = 'Baz';

    function Foo() {
      return <Bar />;
    }

    root.render(<Foo />);

    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::render::Foo');
    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::render::Bar');
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::render::Baz');
    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::render::ClassComponent');
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::render::Clazz');

    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::diff::Foo', {});
    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::diff::Bar');
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::diff::Baz', {});
    expect(lynx.performance.profileStart).not.toHaveBeenCalledWith('ReactLynx::diff::ClassComponent');
    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::diff::Clazz', {});
  });

  it('profiles commit with flowIds from commit context', () => {
    const flowIds = [101, 202];
    GlobalCommitContext.flowIds = flowIds;
    options[COMMIT]?.({} as unknown, []);

    expect(lynx.performance.profileStart).toHaveBeenCalledWith('ReactLynx::commit', {
      flowId: 101,
      flowIds,
    });
    expect(lynx.performance.profileEnd).toHaveBeenCalled();
    expect(GlobalCommitContext.flowIds).toBeUndefined();
  });
});
