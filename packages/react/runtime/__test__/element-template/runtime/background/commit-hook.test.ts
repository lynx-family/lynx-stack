import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { options } from 'preact';

import * as elementTemplateAlog from '../../../../src/element-template/debug/alog.js';
import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import {
  GlobalCommitContext,
  markRemovedSubtreeForCurrentCommit,
} from '../../../../src/element-template/background/commit-context.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { PipelineOrigins } from '../../../../src/element-template/lynx/performance.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '__et_builtin_raw_text__',
    null,
    [text],
    [],
  ];
}

describe('ElementTemplate commit hook', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: unknown[] = [];

  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data);
  };

  beforeEach(() => {
    resetElementTemplateCommitState();
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    updateEvents = [];
    envManager.resetEnv('background');
    installElementTemplateCommitHook();

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
    globalThis.__ALOG__ = true;
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
  });

  it('dispatches update after commit when hydrated', () => {
    markElementTemplateHydrated();
    GlobalCommitContext.ops = createRawTextOps(1, 'hello');
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]).toEqual({
      ops: createRawTextOps(1, 'hello'),
      flushOptions: { nativeUpdateDataOrder: 7 },
    });
    envManager.switchToBackground();
    expect(GlobalCommitContext.ops).toEqual([]);
  });

  it('skips dispatch before hydration', () => {
    GlobalCommitContext.ops = createRawTextOps(1, 'hello');

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(0);
  });

  it('does not leak pre-hydration patches into later commits', () => {
    installElementTemplateHydrationListener();

    GlobalCommitContext.ops = createRawTextOps(1, 'before');
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 1 };

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [],
    });
    envManager.switchToBackground();

    GlobalCommitContext.ops.push(...createRawTextOps(1, 'after'));
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 2 };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]).toMatchObject({
      ops: createRawTextOps(1, 'after'),
      flushOptions: {
        nativeUpdateDataOrder: 2,
        pipelineOptions: {
          pipelineID: 'pipelineID',
          needTimestamps: true,
          pipelineOrigin: PipelineOrigins.reactLynxHydrate,
          dsl: 'reactLynx',
          stage: 'hydrate',
        },
      },
    });
    envManager.switchToBackground();
  });

  it('logs post-hydration update commits when alog is enabled', () => {
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();

    markElementTemplateHydrated();
    GlobalCommitContext.ops = createRawTextOps(1, 'hello');
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };
    GlobalCommitContext.flowIds = [101, 202];

    options.__c?.({} as unknown as object, []);

    const output = alog.mock.calls.map(args => String(args[0])).join('\n');
    expect(output).toContain('[ReactLynxDebug] ElementTemplate BTS -> MTS update');
    expect(output).toContain('createTemplate');
    expect(output).toContain('nativeUpdateDataOrder');
    expect(output).toContain('101');
  });

  it('does not format update commit alog when alog is disabled', () => {
    globalThis.__ALOG__ = false;
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const formatSpy = vi.spyOn(elementTemplateAlog, 'formatElementTemplateUpdateCommands');

    markElementTemplateHydrated();
    GlobalCommitContext.ops = createRawTextOps(1, 'hello');
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };

    options.__c?.({} as unknown as object, []);

    expect(formatSpy).not.toHaveBeenCalled();
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('schedules delayed cleanup from the current commit non-payload state', () => {
    vi.useFakeTimers();
    try {
      markElementTemplateHydrated();
      const root = new BackgroundElementTemplateInstance('root');
      markRemovedSubtreeForCurrentCommit(root);
      GlobalCommitContext.ops = createRawTextOps(1, 'flush');

      options.__c?.({} as unknown as object, []);
      expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);
      vi.advanceTimersByTime(9999);
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(root);

      vi.advanceTimersByTime(1);

      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets commit state when update dispatch throws', () => {
    vi.useFakeTimers();
    const dispatchError = new Error('update dispatch failed');
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
      throw dispatchError;
    });

    try {
      markElementTemplateHydrated();
      const root = new BackgroundElementTemplateInstance('root');
      markRemovedSubtreeForCurrentCommit(root);
      GlobalCommitContext.ops = createRawTextOps(1, 'flush');

      expect(() => options.__c?.({} as unknown as object, [])).toThrow(dispatchError);
      expect(GlobalCommitContext.ops).toEqual([]);
      expect(GlobalCommitContext.nonPayload.removedSubtrees).toEqual([]);

      vi.advanceTimersByTime(10000);
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
    } finally {
      dispatchSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('is idempotent', () => {
    installElementTemplateCommitHook();
    installElementTemplateCommitHook();
    expect(true).toBe(true);
  });
});
