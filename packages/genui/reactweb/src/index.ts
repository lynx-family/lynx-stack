// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * React DOM source generation and compilation for GenUI.
 * @packageDocumentation
 */
export { buildReactWeb } from './build.js';
export type { ReactWebBuildStatus } from './build.js';
export { REACTWEB_SYSTEM_PROMPT } from './prompt.js';
export { normalizeReactWebSource, parseReactWebSource } from './source.js';
export type { ReactWebSource } from './source.js';
