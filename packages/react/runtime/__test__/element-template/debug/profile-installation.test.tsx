import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

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

  it.each(['main', 'background'] as const)('preserves profiling callback contracts on %s', async target => {
    envManager.resetEnv(target);
    const { Component, createElement, options } = await import('preact');
    const { COMPONENT, DIFF2, DIFFED, RENDER } = await import('../../../src/shared/render-constants.js');
    const previousHooks = {
      [DIFF2]: options[DIFF2],
      [DIFFED]: options[DIFFED],
      [RENDER]: options[RENDER],
    };
    onTestFinished(() => Object.assign(options, previousHooks));
    const events: string[] = [];
    const performance = lynx.performance;
    const oldDiff2 = options[DIFF2] = vi.fn(() => {
      expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::diff::Example', {});
      events.push('old diff');
    });
    const oldDiffed = options[DIFFED] = vi.fn(() => {
      expect(performance.profileEnd).toHaveBeenCalledTimes(2);
      events.push('old diffed');
    });
    const oldRender = options[RENDER] = vi.fn(() => {
      expect(instance.render).not.toBe(originalRender);
      events.push('old render');
    });
    const { initProfileHook } = await import('../../../src/element-template/debug/profile.js');
    initProfileHook();

    const failure = new Error('render failed');
    class Example extends Component {
      override render() {
        expect(this).toBe(instance);
        expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::render::Example');
        events.push('render');
        throw failure;
      }
    }
    const vnode = createElement(Example, {});
    const oldVNode = createElement(Example, {});
    const instance = vnode[COMPONENT] = new Example({});
    const originalRender = instance.render;

    options[DIFF2]?.(vnode, oldVNode);
    options[RENDER]?.(vnode);
    expect(() => instance.render()).toThrow(failure);
    expect(instance.render).toBe(originalRender);
    options[DIFFED]?.(vnode);

    expect(oldDiff2.mock.calls).toEqual([[vnode, oldVNode]]);
    expect(oldRender.mock.calls).toEqual([[vnode]]);
    expect(oldDiffed.mock.calls).toEqual([[vnode]]);
    expect(oldDiff2.mock.contexts).toEqual([undefined]);
    expect(oldRender.mock.contexts).toEqual([undefined]);
    expect(oldDiffed.mock.contexts).toEqual([undefined]);
    expect(events).toEqual([
      'old diff',
      'old render',
      'render',
      'old diffed',
    ]);
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
