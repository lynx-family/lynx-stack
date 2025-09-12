// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { initWasm, wasm } from '../index.js';
import type { MainThreadLynx } from '@lynx-js/web-constants';

export type { MainThreadRuntimeConfig } from './createMainThreadGlobalThis.js';

export async function createMainThreadLynx(
  config: any,
  SystemInfo: Record<string, any>,
): Promise<MainThreadLynx> {
  // Initialize WASM if not already done
  if (!wasm) {
    await initWasm();
  }

  // Use the Rust implementation
  const rustLynx = wasm.create_main_thread_lynx(config, SystemInfo);

  // Return a compatible interface
  return {
    getJSContext() {
      return rustLynx.get_js_context();
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return rustLynx.request_animation_frame(cb);
    },
    cancelAnimationFrame(handler: number) {
      return rustLynx.cancel_animation_frame(handler);
    },
    __globalProps: rustLynx.get_global_props(),
    getCustomSectionSync(key: string) {
      return rustLynx.get_custom_section_sync(key);
    },
    markPipelineTiming: (timingKey: string, pipelineId?: string) => {
      return rustLynx.mark_pipeline_timing(timingKey, pipelineId);
    },
    SystemInfo: rustLynx.get_system_info(),
    setTimeout: (callback: any, delay: number) => {
      return rustLynx.set_timeout(callback, delay);
    },
    clearTimeout: (handle: number) => {
      return rustLynx.clear_timeout(handle);
    },
    setInterval: (callback: any, delay: number) => {
      return rustLynx.set_interval(callback, delay);
    },
    clearInterval: (handle: number) => {
      return rustLynx.clear_interval(handle);
    },
  };
}
