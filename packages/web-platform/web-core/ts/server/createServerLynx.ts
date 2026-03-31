/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MainThreadLynx } from '../types/MainThreadLynx.js';
import type { Cloneable } from '../types/index.js';

export function createServerLynx(
  globalProps: Cloneable,
  customSections: Record<string, Cloneable>,
): MainThreadLynx {
  return {
    getJSContext() {
      // Return a basic mock for SSR
      return {} as any;
    },
    requestAnimationFrame(cb: () => void) {
      // Invoke immediately or ignore in SSR
      // Since it's often used for animations, we might just ignore or run once.
      // Running using setImmediate or setTimeout(0) is closest to behavior if we want async execution.
      // But for simple SSR generation effectively being synchronous, calling immediately might be dangerous if recursive.
      // Let's rely on standard timer mocks or just return a dummy id.
      const id = setTimeout(cb, 0);
      return id as unknown as number;
    },
    cancelAnimationFrame(handler: number) {
      clearTimeout(handler);
    },
    __globalProps: globalProps ?? {},
    getCustomSectionSync(key: string) {
      return customSections?.[key];
    },
    markPipelineTiming(_pipelineId: string, _timingKey: string) {
      // skip
    },
    SystemInfo: {
      platform: 'web-ssr',
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
  };
}
