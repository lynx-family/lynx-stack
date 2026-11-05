// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Unsubscribe } from '@lynx-js/lynx-runtime';

import { getReloadVersion } from './reload-version.js';

interface ReloadScope {
  reloadVersion?: number | undefined;
}

export function sendReloadScopedMessage(
  send: (type: string, data: string) => void,
  type: string,
  data: object,
): void {
  send(type, JSON.stringify({ ...data, reloadVersion: getReloadVersion() }));
}

// Deliver parsed payloads only while their page is current. Return cleanup for
// the actual registered wrapper, so callers need no listener identity registry.
export function onReloadScopedMessage<T>(
  subscribe: (type: string, listener: (raw: string) => void) => Unsubscribe,
  type: string,
  listener: (data: T) => void,
): Unsubscribe {
  return subscribe(type, (raw: string): void => {
    const data = JSON.parse(raw) as T & ReloadScope;
    // Unversioned events belong to the initial page only.
    if ((data.reloadVersion ?? 0) !== getReloadVersion()) return;
    listener(data);
  });
}
