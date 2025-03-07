import type { Worklet } from './types.js';

const enum WorkletEvents {
  runWorkletCtx = 'Lynx.Worklet.runWorkletCtx',
  runOnBackground = 'Lynx.Worklet.runOnBackground',
  FunctionCallRet = 'Lynx.Worklet.FunctionCallRet',
  releaseBackgroundWorkletCtx = 'Lynx.Worklet.releaseBackgroundWorkletCtx',
  releaseWorkletRef = 'Lynx.Worklet.releaseWorkletRef',
}

interface RunWorkletCtxData {
  resolveId: number;
  worklet: Worklet;
  params: unknown[];
}

interface RunWorkletCtxRetData {
  resolveId: number;
  returnValue: unknown;
}

export { WorkletEvents, type RunWorkletCtxData, type RunWorkletCtxRetData };
