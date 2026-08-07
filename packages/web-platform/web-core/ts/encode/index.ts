/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
export { encode, type TasmJSONInfo } from './webEncoder.js';
export { encodeLynxXML } from './encodeLynxXML.js';
// Re-exported from their new home in `ts/common/xml/`: the conversion moved so
// that the browser markup path could import it without reaching this entry's
// Node-only wasm glue. The public surface of `@lynx-js/web-core/encode` is
// unchanged.
export {
  diagnoseDiscardedAtRules,
  type DiscardedAtRule,
  xmlToTasmJSON,
  type XMLToTasmJSONResult,
} from '../common/xml/xmlToTasmJSON.js';
