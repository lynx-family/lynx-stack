// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IslandReference } from './types.js';
import { islandSections } from '../shared/index.js';

const loaded = new Map<string, Promise<void>>();

/**
 * Load the background section and send readiness back to the main thread.
 *
 * Call on the background thread. Concurrent requests for the same expose
 * share initialization in the current host bundle. A new request can retry after a failure.
 * @internal
 */
export function prepareIslandBackground(
  source: IslandReference,
  replyEvent: string,
): void {
  'background only';
  void initialize(source).then(
    () =>
      lynx.getCoreContext().dispatchEvent({
        type: replyEvent,
        data: { ok: true },
      }),
    error =>
      lynx.getCoreContext().dispatchEvent({
        type: replyEvent,
        data: { ok: false, error: String(error) },
      }),
  );
}

function initialize(source: IslandReference): Promise<void> {
  const key = source.expose;
  const cached = loaded.get(key);
  if (cached) return cached;

  const request = Promise.resolve().then(() => {
    lynx.loadScript(islandSections(source.expose).background, {
      bundleName: '__Card__',
    });
  }).catch(error => {
    loaded.delete(key);
    throw error;
  });
  loaded.set(key, request);
  return request;
}
