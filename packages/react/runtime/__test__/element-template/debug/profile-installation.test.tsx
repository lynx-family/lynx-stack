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
    const { COMMIT, COMPONENT, DIFF, DIFF2, DIFFED, RENDER } = await import('../../../src/shared/render-constants.js');
    const previousHooks = {
      [COMMIT]: options[COMMIT],
      [DIFF]: options[DIFF],
      [DIFF2]: options[DIFF2],
      [DIFFED]: options[DIFFED],
      [RENDER]: options[RENDER],
    };
    const previousSetState = Component.prototype.setState;
    onTestFinished(() => {
      Object.assign(options, previousHooks);
      Component.prototype.setState = previousSetState;
    });
    const events: string[] = [];
    const performance = lynx.performance;
    const oldSetState = Component.prototype.setState = vi.fn(function(state, callback) {
      expect(this).toBe(instance);
      expect(state).toBe(nextState);
      expect(callback).toBe(setStateCallback);
      events.push('old setState');
    });
    const oldDiff = options[DIFF] = vi.fn(() => events.push('old before diff'));
    const oldCommit = options[COMMIT] = vi.fn(() => {
      expect(performance.profileStart).toHaveBeenLastCalledWith('ReactLynx::commit', {});
      events.push('old commit');
    });
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

    const nextState = { count: 1 };
    const setStateCallback = () => {};
    const commitQueue = [instance];
    instance.setState(nextState, setStateCallback);
    options[DIFF]?.(vnode);
    options[DIFF2]?.(vnode, oldVNode);
    options[RENDER]?.(vnode);
    expect(() => instance.render()).toThrow(failure);
    expect(instance.render).toBe(originalRender);
    options[DIFFED]?.(vnode);

    if (target === 'background') {
      options[COMMIT]?.(vnode, commitQueue);
      expect(oldCommit.mock.calls).toEqual([[vnode, commitQueue]]);
      expect(oldCommit.mock.contexts).toEqual([undefined]);
      expect(performance.profileEnd).toHaveBeenCalledTimes(3);
      expect(oldDiff.mock.contexts).toEqual([undefined]);
    }
    expect(oldSetState.mock.calls).toEqual([[nextState, setStateCallback]]);
    expect(oldSetState.mock.contexts).toEqual([instance]);
    expect(oldDiff.mock.calls).toEqual([[vnode]]);
    expect(oldDiff2.mock.calls).toEqual([[vnode, oldVNode]]);
    expect(oldRender.mock.calls).toEqual([[vnode]]);
    expect(oldDiffed.mock.calls).toEqual([[vnode]]);
    expect(oldDiff2.mock.contexts).toEqual([undefined]);
    expect(oldRender.mock.contexts).toEqual([undefined]);
    expect(oldDiffed.mock.contexts).toEqual([undefined]);
    expect(events).toEqual([
      'old setState',
      'old before diff',
      'old diff',
      'old render',
      'render',
      'old diffed',
      ...(target === 'background' ? ['old commit'] : []),
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
