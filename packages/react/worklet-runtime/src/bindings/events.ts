import type { Worklet } from './types.js';

const enum WorkletEvents {
  runWorkletCtx = 'Lynx.Worklet.runWorkletCtx',
  runOnBackground = 'Lynx.Worklet.runOnBackground',
  releaseBackgroundWorkletCtx = 'Lynx.Worklet.releaseBackgroundWorkletCtx',
  releaseWorkletRef = 'Lynx.Worklet.releaseWorkletRef',
}

interface RunWorkletCtxData {
  worklet: Worklet;
  params: unknown[];
}

export { WorkletEvents, type RunWorkletCtxData };
