// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { EventDispatcher, EventSubscriber } from '../common/types.js';

export interface BackgroundThreadRuntime<
  EventsToMain extends object,
  EventsFromMain extends object,
  CurrentThreadEvents extends object,
> {
  destroy(): void;
  dispatchToCurrentThread: EventDispatcher<CurrentThreadEvents>;
  dispatchToMainThread: EventDispatcher<EventsToMain>;
  onCurrentThreadEvent: EventSubscriber<CurrentThreadEvents>;
  onMainThreadEvent: EventSubscriber<EventsFromMain>;
}

export interface BackgroundThreadRuntimeOptions {
  onDestroy?: () => void;
}
