// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type {
  CreatedPipelineOptions,
  CreatePipelineOptions,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  PipelineOptions,
  Unsubscribe,
} from './common/types.js';

export {
  getGlobalProps,
  getInitData,
  onGlobalPropsChanged,
  onReload,
  onRenderPage,
  onUpdateData,
  setDataProcessor,
  setPageDataGetter,
} from './mts/data.js';
export { flushElementTree } from './mts/flush.js';
export { isDestroyed, onDestroy } from './mts/host.js';
export {
  createPipeline,
  getSystemInfo,
  markTiming,
  onMessage,
  sendMessage,
} from './mts/services.js';
