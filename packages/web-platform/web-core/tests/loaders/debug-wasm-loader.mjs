// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export default function debugWasmLoader(source) {
  return source
    .replaceAll('client/client.js', 'client/client_debug.js')
    .replaceAll('client/client_bg.wasm', 'client/client_debug_bg.wasm');
}
