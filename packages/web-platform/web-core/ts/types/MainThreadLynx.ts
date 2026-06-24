/*
 * Copyright 2023 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Cloneable } from './Cloneable.js';
import type { ExternalBundleLynxAPIs } from './ExternalBundle.js';
import type { LynxContextEventTarget } from './LynxContextEventTarget.js';
import type { LynxPerformance } from './NativeApp.js';
export interface MainThreadLynx extends ExternalBundleLynxAPIs {
  performance: LynxPerformance;
  getJSContext: () => LynxContextEventTarget;
  requestAnimationFrame: (cb: () => void) => number;
  cancelAnimationFrame: (handler: number) => void;
  __globalProps: unknown;
  getCustomSectionSync: (key: string) => Cloneable;
  markPipelineTiming: (pipelineId: string, timingKey: string) => void;
  SystemInfo: Cloneable;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
}
