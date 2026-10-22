// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getReloadVersion } from './reload-version.js';

interface ReloadScope {
  reloadVersion?: number | undefined;
}

export function dispatchReloadScopedEvent(context: RuntimeProxy, event: { type: string; data: object }): void {
  context.dispatchEvent({
    type: event.type,
    data: JSON.stringify({ ...event.data, reloadVersion: getReloadVersion() }),
  });
}

// Deliver parsed payloads only while their page is current. Return cleanup for
// the actual registered wrapper, so callers need no listener identity registry.
export function addReloadScopedEventListener<T>(
  context: RuntimeProxy,
  type: string,
  listener: (data: T) => void,
): () => void {
  const handle = (event: RuntimeProxy.Event): void => {
    const data = JSON.parse(event.data as string) as T & ReloadScope;
    // Unversioned events belong to the initial page only.
    if ((data.reloadVersion ?? 0) !== getReloadVersion()) return;
    listener(data);
  };
  context.addEventListener(type, handle);
  return () => {
    context.removeEventListener(type, handle);
  };
}
