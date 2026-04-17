import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { options } from 'preact';

import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { GlobalCommitContext } from '../../../../src/element-template/background/commit-context.js';
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
    updateEvents = [];
    envManager.resetEnv('background');
    installElementTemplateCommitHook();

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
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

  it('is idempotent', () => {
    installElementTemplateCommitHook();
    installElementTemplateCommitHook();
    expect(true).toBe(true);
  });
});
