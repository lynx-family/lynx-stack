// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * SWC transform runner for `<script main-thread>` blocks.
 *
 * Called by vue-main-thread-pre-loader with the raw content of a
 * `<script main-thread>` block and a target mode:
 *
 *   - 'BG'  → produce worklet context object declarations (injected into
 *              <script setup> so the template can bind main-thread handlers).
 *   - 'MT'  → produce registerWorkletInternal(...) calls (run on the Lepus
 *              Main Thread to register handler closures).
 *
 * TODO: replace the passthrough stub with a real SWC plugin invocation once
 * packages/vue/transform has a compiled native/wasm SWC plugin.
 */
export function runSwcTransform(
  source: string,
  _filename: string,
  _target: 'BG' | 'MT',
  _options: Record<string, unknown>,
): Promise<string> {
  // Stub: return source unchanged until the SWC plugin is compiled.
  return Promise.resolve(source);
}
