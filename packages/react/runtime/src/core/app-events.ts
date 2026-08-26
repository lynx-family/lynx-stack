// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * How the runtime receives lynx-core's app-level callbacks.
 *
 * Every one of them reaches the runtime as a method on the app object: the
 * engine and lynx-core each own a context-proxy listener for the events behind
 * them and look the method up on the app by name. The runtime therefore keeps
 * the handlers in a record on that app object, so a runtime shared by several
 * cards serves each of them with its own handlers instead of only whichever
 * card registered last.
 */

export interface AppEventHandlers {
  // A method rather than a property so a handler may narrow the lifecycle type.
  OnLifecycleEvent?(args: [string, unknown]): void;
  publishEvent?: (handlerName: string, data: any) => void;
  publicComponentEvent?: (componentId: string, handlerName: string, data: any) => void;
  updateGlobalProps?: (newData: Record<string, any>) => void;
  updateCardData?: (...args: any[]) => void;
  onAppReload?: (...args: any[]) => void;
  callDestroyLifetimeFun?: () => void;
  processCardConfig?: (...args: any[]) => void;
}

/**
 * Registers app-level callbacks on the app of `pageLynx`, or of the ambient
 * `lynx` when a page does not name one.
 *
 * Registering again replaces only the handlers passed in, which is how the
 * first-screen swap from the delayed handlers to the real ones works.
 */
export function registerAppEventHandlers(
  next: AppEventHandlers,
  pageLynx?: unknown,
): void {
  const app = ((pageLynx as typeof lynx | undefined) ?? lynx).getApp();
  const handlers: AppEventHandlers = (app.__reactHandlers ??= {});
  Object.assign(handlers, next);

  if (app.__reactRegistered) {
    return;
  }
  app.__reactRegistered = true;

  app.OnLifecycleEvent = (args: [string, unknown]) => handlers.OnLifecycleEvent?.(args);
  app.updateGlobalProps = (data: Record<string, unknown>) => handlers.updateGlobalProps?.(data);
  app.onAppReload = (...args: unknown[]) => handlers.onAppReload?.(...args);
  app.updateCardData = (...args: unknown[]) => handlers.updateCardData?.(...args);
  app.callDestroyLifetimeFun = () => handlers.callDestroyLifetimeFun?.();

  // Element events are produced by the main thread and arrive as message
  // events. `publishEvent` and `publicComponentEvent` are deliberately left off
  // the app object: the engine converts the same message event into a call on
  // it, so keeping both would deliver every event twice.
  const coreContext = (pageLynx as typeof lynx | undefined ?? lynx).getCoreContext?.();
  if (coreContext) {
    // Both carry [<page name or component id>, handler name, event data].
    console.info('[PROBE] bts subscribed');
    coreContext.addEventListener('__SendPageEvent', (event: { data: unknown }) => {
      console.info('[PROBE] bts recv');
      const [, handlerName, data] = event.data as [string, string, unknown];
      handlers.publishEvent?.(handlerName, data);
    });
    coreContext.addEventListener('__PublishComponentEvent', (event: { data: unknown }) => {
      const [componentId, handlerName, data] = event.data as [string, string, unknown];
      handlers.publicComponentEvent?.(componentId, handlerName, data);
    });
  }

  app.processCardConfig = () => {
    // used to updateTheme, no longer rely on this function
  };
}
