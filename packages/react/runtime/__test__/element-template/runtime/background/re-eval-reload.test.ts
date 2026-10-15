import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, render } from 'preact';
import { Component } from 'preact/compat';

import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  uninstallElementTemplateCommitHookForTesting,
} from '../../../../src/element-template/background/commit-hook.js';
import { callDestroyLifetimeFun } from '../../../../src/element-template/native/callDestroyLifetimeFun.js';
import { reloadBackgroundEntry } from '../../../../src/element-template/native/reload-background.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

describe('ElementTemplate entry reload', () => {
  const env = new ElementTemplateEnvManager();

  beforeEach(() => {
    env.resetEnv('background');
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    installElementTemplateCommitHook();
  });

  afterEach(() => {
    uninstallElementTemplateCommitHookForTesting();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('runs old component cleanup without sending removals to the new native tree', () => {
    const cleanup = vi.fn();
    class Probe extends Component {
      componentWillUnmount() {
        cleanup();
      }
      render() {
        return createElement('view', null, 'old page');
      }
    }
    __root.__jsx = createElement(Probe);
    render(__root.__jsx, __root as never);
    markElementTemplateHydrated();
    const dispatch = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    dispatch.mockClear();
    const oldRoot = __root;
    lynx.__initData = { retained: 'initial', count: 1 };
    const reloadCard = vi.fn(() => {
      expect(cleanup).toHaveBeenCalledOnce();
      expect(oldRoot.__jsx).toBeUndefined();
      expect(dispatch).not.toHaveBeenCalled();
      return true;
    });
    vi.spyOn(lynx, 'getApp').mockReturnValue({ callDestroyLifetimeFun, reloadCard } as never);
    const options = { processorName: 'reload' };

    reloadBackgroundEntry({ count: 2 }, options);

    expect(reloadCard).toHaveBeenCalledWith({ retained: 'initial', count: 2 }, options);
    // An already queued old globalProps rerender cannot remount its page.
    render(oldRoot.__jsx, oldRoot as never);
    expect(dispatch).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
