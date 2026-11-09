// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { delayedEvents } from '../lifecycle/event/delayEvents.js';
import { backgroundSnapshotInstanceManager } from '../snapshot/backgroundSnapshot.js';

/** Installs event dispatch for roots that hydrate independently of the page. */
export function installIndependentEventHandlers(): {
  flush(): void;
  dispose(): void;
} {
  const app = lynx.getApp();

  const previousPublish = app.publishEvent;

  const previousComponent = app.publicComponentEvent;
  const pending: [string, EventDataType][] = delayedEvents?.splice(0) ?? [];

  function dispatch(handlerName: string, data: EventDataType): boolean {
    const handler = backgroundSnapshotInstanceManager.getValueBySign(
      handlerName,
    ) as
      | ((event: EventDataType) => void)
      | undefined;
    if (!handler) return false;
    try {
      app.callBeforePublishEvent?.(data);
      handler(data);
    } catch (error) {
      lynx.reportError(error as Error);
    }
    return true;
  }
  function publish(handlerName: string, data: EventDataType): void {
    if (!dispatch(handlerName, data)) pending.push([handlerName, data]);
  }
  function component(
    _componentId: string,
    handlerName: string,
    data: EventDataType,
  ): void {
    publish(handlerName, data);
  }
  app.publishEvent = publish;
  app.publicComponentEvent = component;
  return {
    flush() {
      const events = pending.splice(0);
      events.forEach(([name, data]) => publish(name, data));
    },
    dispose() {
      pending.length = 0;
      if (app.publishEvent === publish) app.publishEvent = previousPublish;
      if (app.publicComponentEvent === component) {
        app.publicComponentEvent = previousComponent;
      }
    },
  };
}
