// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
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

interface ReleaseWorkletRefData {
  id: number;
}

export { WorkletEvents, type RunWorkletCtxData, type RunWorkletCtxRetData, type ReleaseWorkletRefData };
