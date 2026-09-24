// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BackgroundThreadRuntime,
  BackgroundThreadRuntimeOptions,
} from './types.js';
import { createEventChannel } from '../common/event-channel.js';
import { destroyLifetimeEventName } from '../common/types.js';
import type { LynxRuntimeHost } from '../common/types.js';

declare const lynx: LynxRuntimeHost;

export type {
  BackgroundThreadRuntime,
  BackgroundThreadRuntimeOptions,
} from './types.js';

export function initializeBackgroundThread<
  EventsToMain extends object = Record<string, unknown>,
  EventsFromMain extends object = Record<string, unknown>,
  CurrentThreadEvents extends object = Record<string, unknown>,
>(
  options: BackgroundThreadRuntimeOptions = {},
): BackgroundThreadRuntime<
  EventsToMain,
  EventsFromMain,
  CurrentThreadEvents
> {
  const mainThread = lynx.getCoreContext();
  const mainThreadChannel = createEventChannel<
    EventsFromMain,
    EventsToMain
  >(mainThread);
  const currentThreadChannel = createEventChannel<
    CurrentThreadEvents,
    CurrentThreadEvents
  >(lynx.getJSContext());
  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;

    mainThread.removeEventListener(destroyLifetimeEventName, destroy);
    mainThreadChannel.destroy();
    currentThreadChannel.destroy();
    options.onDestroy?.();
  };

  mainThread.addEventListener(destroyLifetimeEventName, destroy);

  return {
    destroy,
    dispatchToCurrentThread: currentThreadChannel.dispatch,
    dispatchToMainThread: mainThreadChannel.dispatch,
    onCurrentThreadEvent: currentThreadChannel.on,
    onMainThreadEvent: mainThreadChannel.on,
  };
}
