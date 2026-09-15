// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack plugin that caches Lynx native calls that arrive before an entry finishes starting up — on the background thread, and on the main thread for entries that start up asynchronously — and replays them once startup settles.
 */

export { LynxCacheEventsPlugin } from './LynxCacheEventsPlugin.js';
export type { LynxCacheEventsPluginOptions } from './LynxCacheEventsPlugin.js';
