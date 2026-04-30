import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { options } from 'preact';

import { GlobalCommitContext } from '../../../src/element-template/background/commit-context.js';
import {
  beginPipeline,
  initTimingAPI,
  markTiming,
  markTimingLegacy,
  PerformanceTimingFlags,
  PipelineOrigins,
  setPipeline,
} from '../../../src/element-template/lynx/performance.js';
import { ElementTemplateUpdateOps } from '../../../src/element-template/protocol/opcodes.js';
import { RENDER_COMPONENT } from '../../../src/shared/render-constants.js';
import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

const envManager = new ElementTemplateEnvManager();

let nativeMarkTiming: ReturnType<typeof vi.fn>;
let originalLynx: unknown;

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

beforeEach(() => {
  envManager.resetEnv('background');

  nativeMarkTiming = vi.fn();
  originalLynx = globalThis.lynx;
  globalThis.lynx = {
    ...(originalLynx as object),
    getNativeApp: () => ({ markTiming: nativeMarkTiming }),
  } as typeof lynx;

  globalThis.lynx.performance.__functionCallHistory = [];
  globalThis.lynx.performance._markTiming.mockClear();
  globalThis.lynx.performance._onPipelineStart.mockClear();
  globalThis.lynx.performance._bindPipelineIdWithTimingFlag.mockClear();
});

afterEach(() => {
  setPipeline(undefined);
  GlobalCommitContext.ops = [];
  globalThis.lynx = originalLynx as typeof lynx;
});

describe('ElementTemplate performance timing (current api)', () => {
  it('beginPipeline wires pipeline options and markTiming respects needTimestamps', () => {
    beginPipeline(true, PipelineOrigins.reactLynxHydrate, PerformanceTimingFlags.reactLynxHydrate);

    const onStartCalls = globalThis.lynx.performance._onPipelineStart.mock.calls;
    expect(onStartCalls).toHaveLength(1);
    expect(onStartCalls[0]?.[0]).toBe('pipelineID');
    expect(onStartCalls[0]?.[1]).toMatchObject({
      pipelineID: 'pipelineID',
      needTimestamps: true,
      pipelineOrigin: PipelineOrigins.reactLynxHydrate,
      dsl: 'reactLynx',
      stage: 'hydrate',
    });

    const bindCalls = globalThis.lynx.performance._bindPipelineIdWithTimingFlag.mock.calls;
    expect(bindCalls).toHaveLength(1);
    expect(bindCalls[0]).toEqual(['pipelineID', PerformanceTimingFlags.reactLynxHydrate]);

    markTiming('diffVdomStart');
    expect(globalThis.lynx.performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'diffVdomStart'],
    ]);
  });

  it('markTiming only emits when needTimestamps is true or forced', () => {
    beginPipeline(false, PipelineOrigins.updateTriggeredByBts);

    markTiming('diffVdomStart');
    expect(globalThis.lynx.performance._markTiming).not.toHaveBeenCalled();

    markTiming('diffVdomStart', true);
    expect(globalThis.lynx.performance._markTiming).toHaveBeenCalledWith(
      'pipelineID',
      'diffVdomStart',
    );
  });

  it('initTimingAPI hooks diff timing when updates are detected', () => {
    initTimingAPI();

    GlobalCommitContext.ops = createRawTextOps(1, 'payload');
    options[RENDER_COMPONENT]?.({} as unknown as object, null);

    expect(globalThis.lynx.performance._markTiming).toHaveBeenCalledWith(
      'pipelineID',
      'diffVdomStart',
    );
  });

  it('initTimingAPI triggers legacy diff start on ROOT hook', () => {
    initTimingAPI();

    markTimingLegacy('updateSetStateTrigger', 'flag');
    GlobalCommitContext.ops = createRawTextOps(1, 'payload');

    options.__?.({} as unknown as object, null);

    expect(nativeMarkTiming.mock.calls).toEqual([
      ['flag', 'updateSetStateTrigger'],
      ['flag', 'updateDiffVdomStart'],
    ]);
  });
});

describe('ElementTemplate performance timing (legacy api)', () => {
  it('markTimingLegacy follows update timing flag flow', () => {
    markTimingLegacy('updateSetStateTrigger', 'flag');
    expect(nativeMarkTiming).toHaveBeenCalledWith('flag', 'updateSetStateTrigger');

    markTimingLegacy('updateDiffVdomStart');
    markTimingLegacy('updateDiffVdomEnd');

    expect(nativeMarkTiming.mock.calls).toEqual([
      ['flag', 'updateSetStateTrigger'],
      ['flag', 'updateDiffVdomStart'],
      ['flag', 'updateDiffVdomEnd'],
    ]);
  });

  it('markTimingLegacy ignores diff end without trigger', () => {
    markTimingLegacy('updateDiffVdomEnd');
    expect(nativeMarkTiming).not.toHaveBeenCalled();
  });

  it('markTimingLegacy ignores diff start without trigger', () => {
    markTimingLegacy('updateDiffVdomStart');
    expect(nativeMarkTiming).not.toHaveBeenCalled();
  });
});
