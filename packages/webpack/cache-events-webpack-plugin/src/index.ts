// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack plugin that cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready.
 */

export { LynxCacheEventsPlugin } from './LynxCacheEventsPlugin.js';
export type { LynxCacheEventsPluginOptions } from './LynxCacheEventsPlugin.js';
