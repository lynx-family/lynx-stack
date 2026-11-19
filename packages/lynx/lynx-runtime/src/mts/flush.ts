// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getAliveMTSState } from './host.js';
import type { HostGlobalScope } from '../common/host-types.js';
import { isPlainRecord } from '../common/protocol.js';
import type { MTSFlushOptions } from '../common/types.js';

/**
 * Submit the page root element tree (`__FlushElementTree`); returning does not imply layout or paint completion.
 * Unlike the 2-arg PAPI `__FlushElementTree(target, options)`, `flushElementTree(options)`
 * flushes the page root only and accepts `MTSFlushOptions` as its first argument.
 * Preserve the originating update/reload/GlobalProps options, even for an empty
 * update. First-screen render is submitted by the host when its callback returns.
 * Requires a live MTS host with __FlushElementTree; throws if unavailable, destroyed,
 * or passed options that are not a plain object. There is no completion Promise.
 */
export function flushElementTree(options?: Readonly<MTSFlushOptions>): void {
  const host = globalThis as unknown as HostGlobalScope;
  getAliveMTSState(host);
  const flush = host.__FlushElementTree;
  if (!flush) {
    throw new Error(
      '[@lynx-js/lynx-runtime/mts] Page flush requires __FlushElementTree(). Ensure flushElementTree() is called on the main thread (MTS).',
    );
  }
  if (options === undefined) {
    // Call 0-arg __FlushElementTree() directly when no options are provided.
    flush();
    return;
  }
  if (!isPlainRecord(options as unknown)) {
    throw new TypeError(
      '[@lynx-js/lynx-runtime/mts] Flush options must be a plain object (flushElementTree(options) flushes the page root and does not take an element target).',
    );
  }
  const rawOptions = options as Readonly<
    MTSFlushOptions & {
      __lynx_timing_flag?: string | undefined;
    }
  >;
  flush(
    undefined,
    rawOptions.timingFlag !== undefined
      && rawOptions.__lynx_timing_flag === undefined
      ? { ...rawOptions, __lynx_timing_flag: rawOptions.timingFlag }
      : rawOptions,
  );
}
