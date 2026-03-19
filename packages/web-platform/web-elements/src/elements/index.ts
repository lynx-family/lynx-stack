// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements
 *
 * This module exports the common utilities and types for Lynx Web Elements.
 *
 * It acts as the shared foundation for all specific element implementations.
 * Note that it does NOT export the elements themselves; use `all.ts` or specific element paths for that.
 */

export * from '../element-reactive/index.js';
export * from './common/CommonEventsAndMethods.js';
export * from './common/commonEventInitConfiguration.js';
export * from './common/constants.js';
