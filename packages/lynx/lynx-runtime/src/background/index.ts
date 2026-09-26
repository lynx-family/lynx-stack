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
  LocalEvents extends object = Record<string, unknown>,
>(
  options: BackgroundThreadRuntimeOptions = {},
): BackgroundThreadRuntime<
  EventsToMain,
  EventsFromMain,
  LocalEvents
> {
  const mainThread = lynx.getCoreContext();
  const mainThreadChannel = createEventChannel<
    EventsFromMain,
    EventsToMain
  >(mainThread);
  const localChannel = createEventChannel<LocalEvents, LocalEvents>(
    lynx.getJSContext(),
  );
  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;

    mainThread.removeEventListener(destroyLifetimeEventName, destroy);
    mainThreadChannel.destroy();
    localChannel.destroy();
    options.onDestroy?.();
  };

  mainThread.addEventListener(destroyLifetimeEventName, destroy);

  return {
    destroy,
    dispatchLocally: localChannel.dispatch,
    dispatchToMainThread: mainThreadChannel.dispatch,
    onLocalEvent: localChannel.on,
    onMainThreadEvent: mainThreadChannel.on,
  };
}
