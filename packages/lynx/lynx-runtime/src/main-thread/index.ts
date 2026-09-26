// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MainThreadRuntime, MainThreadRuntimeOptions } from './types.js';
import { createEventChannel } from '../common/event-channel.js';
import { destroyLifetimeEventName } from '../common/types.js';
import type { LynxRuntimeHost, RuntimeEvent } from '../common/types.js';

declare const lynx: LynxRuntimeHost;

export const renderPageEventName = '__RenderPage';
export const updatePageEventName = '__UpdatePage';

function getLifecycleArguments(event: RuntimeEvent): readonly unknown[] {
  return Array.isArray(event.data) ? event.data : [];
}

export function initializeMainThread<
  EventsToBackground extends object = Record<string, unknown>,
  EventsFromBackground extends object = Record<string, unknown>,
  LocalEvents extends object = Record<string, unknown>,
  RenderData = unknown,
>(
  options: MainThreadRuntimeOptions<RenderData>,
): MainThreadRuntime<
  EventsToBackground,
  EventsFromBackground,
  LocalEvents
> {
  const runtimeGlobal = globalThis as typeof globalThis & {
    processData?: (data: unknown) => unknown;
  };
  // TODO: Remove this fallback once Lynx clients no longer require processData.
  runtimeGlobal.processData ??= data => data;

  const engine = lynx.getEngine();
  const backgroundThread = lynx.getJSContext();
  const backgroundChannel = createEventChannel<
    EventsFromBackground,
    EventsToBackground
  >(backgroundThread);
  const localChannel = createEventChannel<LocalEvents, LocalEvents>(
    lynx.getCoreContext(),
  );
  let destroyed = false;

  const onRenderPage = (event: RuntimeEvent): void => {
    const [data, renderOptions] = getLifecycleArguments(event);
    options.onRenderPage(data as RenderData, renderOptions);
  };

  const onUpdatePage = (event: RuntimeEvent): void => {
    const [data, updateOptions] = getLifecycleArguments(event);
    options.onUpdatePage?.(data as RenderData, updateOptions);
  };

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;

    let destroyError: unknown;
    try {
      backgroundThread.dispatchEvent({
        type: destroyLifetimeEventName,
        data: undefined,
      });
    } catch (error) {
      destroyError = error;
    }

    backgroundChannel.destroy();
    localChannel.destroy();
    engine.removeEventListener(renderPageEventName, onRenderPage);
    engine.removeEventListener(updatePageEventName, onUpdatePage);
    engine.removeEventListener(destroyLifetimeEventName, destroy);

    try {
      options.onDestroy?.();
    } catch (error) {
      destroyError ??= error;
    }

    if (destroyError !== undefined) {
      throw destroyError;
    }
  };

  engine.addEventListener(renderPageEventName, onRenderPage);
  engine.addEventListener(updatePageEventName, onUpdatePage);
  engine.addEventListener(destroyLifetimeEventName, destroy);

  return {
    destroy,
    dispatchLocally: localChannel.dispatch,
    dispatchToBackground: backgroundChannel.dispatch,
    onBackgroundEvent: backgroundChannel.on,
    onLocalEvent: localChannel.on,
  };
}
