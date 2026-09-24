// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { EventDispatcher, EventSubscriber } from '../common/types.js';

export interface MainThreadRuntime<
  EventsToBackground extends object,
  EventsFromBackground extends object,
  CurrentThreadEvents extends object,
> {
  destroy(): void;
  dispatchToBackground: EventDispatcher<EventsToBackground>;
  dispatchToCurrentThread: EventDispatcher<CurrentThreadEvents>;
  onBackgroundEvent: EventSubscriber<EventsFromBackground>;
  onCurrentThreadEvent: EventSubscriber<CurrentThreadEvents>;
}

export interface MainThreadRuntimeOptions<RenderData = unknown> {
  onDestroy?: () => void;
  onRenderPage: (data: RenderData, renderOptions: unknown) => void;
  onUpdatePage?: (data: RenderData, updateOptions: unknown) => void;
}
