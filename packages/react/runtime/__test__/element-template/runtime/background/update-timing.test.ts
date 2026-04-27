import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { options } from 'preact';

import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { GlobalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  beginPipeline,
  markTimingLegacy,
  PipelineOrigins,
  setPipeline,
} from '../../../../src/element-template/lynx/performance.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

interface UpdateEvent {
  flushOptions?: Record<string, unknown>;
}

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

describe('ElementTemplate update timing (background commit)', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: UpdateEvent[] = [];
  let nativeMarkTiming: ReturnType<typeof vi.fn>;
  let originalLynx: typeof lynx;

  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as UpdateEvent);
  };

  beforeEach(() => {
    envManager.resetEnv('background');
    resetElementTemplateCommitState();
    installElementTemplateCommitHook();

    updateEvents = [];
    nativeMarkTiming = vi.fn();
    originalLynx = globalThis.lynx;
    globalThis.lynx = {
      ...(originalLynx as object),
      getNativeApp: () => ({ markTiming: nativeMarkTiming }),
    } as typeof lynx;

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();

    lynx.performance._markTiming.mockClear();
  });

  afterEach(() => {
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();

    resetElementTemplateCommitState();
    setPipeline(undefined);
    globalThis.lynx = originalLynx as typeof lynx;
  });

  it('marks diff/pack timings and forwards pipeline options', () => {
    markElementTemplateHydrated();
    beginPipeline(true, PipelineOrigins.updateTriggeredByBts);
    markTimingLegacy('updateSetStateTrigger', 'flag');

    GlobalCommitContext.ops = createRawTextOps(1, 'payload');
    GlobalCommitContext.flushOptions = { nativeUpdateDataOrder: 9 };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]?.flushOptions).toMatchObject({
      nativeUpdateDataOrder: 9,
      pipelineOptions: {
        pipelineID: 'pipelineID',
        needTimestamps: true,
        pipelineOrigin: PipelineOrigins.updateTriggeredByBts,
        dsl: 'reactLynx',
        stage: 'update',
      },
    });
    envManager.switchToBackground();

    expect(nativeMarkTiming.mock.calls).toEqual([
      ['flag', 'updateSetStateTrigger'],
      ['flag', 'updateDiffVdomEnd'],
    ]);

    expect(lynx.performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'diffVdomEnd'],
      ['pipelineID', 'packChangesStart'],
      ['pipelineID', 'packChangesEnd'],
    ]);
  });
});
