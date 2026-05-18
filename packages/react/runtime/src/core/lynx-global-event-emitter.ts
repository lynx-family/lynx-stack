// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type LynxGlobalEventListener = (...args: any[]) => void;

export function addLynxGlobalEventListener(
  eventName: string,
  listener: LynxGlobalEventListener,
): void {
  lynx.getJSModule('GlobalEventEmitter').addListener(eventName, listener);
}

export function removeLynxGlobalEventListener(
  eventName: string,
  listener: LynxGlobalEventListener,
): void {
  lynx.getJSModule('GlobalEventEmitter').removeListener(eventName, listener);
}
