/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

// Ported from the vitest `transform-debug-wasm` Vite plugin.
// Redirects the runtime `fetch(new URL('client_bg.wasm', import.meta.url))` to
// the debug wasm binary that works under the test environment. Applied to
// `ts/client/wasm.ts` only. (The matching glue-JS swap is done via
// `resolve.alias` in rstest.config.ts.)
module.exports = function debugWasmLoader(source) {
  return source.replace('client/client_bg.wasm', 'client/client_debug_bg.wasm');
};
