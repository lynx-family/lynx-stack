// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * How the runtime receives lynx-core's app-level callbacks.
 *
 * The runtime used to assign each callback onto the app object, which a runtime
 * shared by several cards cannot do: the last card to register wins. It now
 * subscribes on the page's own context proxies instead, so each page receives
 * only its own events and no card overwrites another's handlers.
 *
 * `__OnLifecycleEvent` is subscribed through lynx-core rather than on a proxy:
 * a card's first lifecycle event is dispatched before the card's own bundle has
 * finished evaluating, so only a subscription that replays what it missed can
 * carry it. `addLifecycleEventListener` is that subscription; an engine without
 * it keeps the method it already calls.
 *
 * `updateCardData`, `onAppReload` and `updateGlobalProps` have no
 * background-bound event of their own; the main thread forwards them (see
 * `snapshot/lynx/calledByNative.ts` and `snapshot/lifecycle/reload.ts`).
 */

export const AppEvents = {
  pageEvent: '__SendPageEvent',
  componentEvent: '__PublishComponentEvent',
  cardData: '__UpdateCardData',
  appReload: '__OnAppReload',
  globalProps: '__UpdateGlobalProps',
  destroy: '__DestroyLifetime',
} as const;

export interface AppEventHandlers {
  // A method rather than a property so a handler may narrow the lifecycle type.
  OnLifecycleEvent?(args: [string, unknown]): void;
  publishEvent?: (handlerName: string, data: any) => void;
  publicComponentEvent?: (componentId: string, handlerName: string, data: any) => void;
  updateGlobalProps?: (newData: Record<string, any>) => void;
  updateCardData?: (...args: any[]) => void;
  onAppReload?: (...args: any[]) => void;
  callDestroyLifetimeFun?: () => void;
}

interface AppEventProxy {
  addEventListener(type: string, listener: (event: { data: any }) => void): void;
  removeEventListener(type: string, listener: (event: { data: any }) => void): void;
}

interface PageLynx {
  getApp(): {
    __reactHandlers?: AppEventHandlers;
    __reactUnsubscribe?: () => void;
    __reactFallback?: boolean;
    addLifecycleEventListener?: (listener: (args: unknown) => void) => () => void;
    OnLifecycleEvent?: (args: [string, unknown]) => void;
    publishEvent?: (name: string, data: unknown) => void;
    publicComponentEvent?: (id: string, name: string, data: unknown) => void;
    updateGlobalProps?: (props: Record<string, unknown>) => void;
    updateCardData?: (...args: unknown[]) => void;
    onAppReload?: (...args: unknown[]) => void;
    callDestroyLifetimeFun?: () => void;
    processCardConfig?: () => void;
    callBeforePublishEvent?: (data: unknown) => void;
  };
  getCoreContext(): AppEventProxy;
  getNative(): AppEventProxy;
}

/**
 * Registers app-level callbacks for the page of `pageLynx`, or of the ambient
 * `lynx` when a page does not name one.
 *
 * Registering again replaces only the handlers passed in, which is how the
 * first-screen swap from the delayed handlers to the real ones works. The
 * subscription itself is made once per page.
 */
export function registerAppEventHandlers(
  next: AppEventHandlers,
  pageLynx?: unknown,
): void {
  const scope = (pageLynx as PageLynx | undefined) ?? (lynx as unknown as PageLynx);
  const app = scope.getApp();
  const handlers: AppEventHandlers = (app.__reactHandlers ??= {});
  Object.assign(handlers, next);

  const hasProxies = typeof scope.getCoreContext === 'function'
    && typeof scope.getNative === 'function';
  if (app.__reactUnsubscribe) {
    // The first registration can land before the page has its proxies, so a
    // later one that does see them upgrades from the methods to subscriptions.
    if (!app.__reactFallback || !hasProxies) {
      return;
    }
    app.__reactUnsubscribe();
  }

  // Lifecycle events do not ride a context proxy, so they are taken first: a
  // runtime with no proxies of its own still receives them.
  const onLifecycle = (args: [string, unknown]) => handlers.OnLifecycleEvent?.(args);
  // An engine without the replaying subscription still calls the method, so
  // fall back to it there. A card evaluated first then wins on a shared
  // runtime, which is what the method already did before.
  const dropLifecycle = app.addLifecycleEventListener?.(onLifecycle as (args: unknown) => void)
    ?? ((app.OnLifecycleEvent = onLifecycle), () => {
      delete app.OnLifecycleEvent;
    });

  // Without context proxies there is nothing to subscribe on, so take the
  // callbacks the host invokes by name instead. That covers a standalone group
  // runtime, an engine that predates the proxies, and a test environment that
  // drives the runtime through the app object.
  if (!hasProxies) {
    app.__reactFallback = true;
    app.publishEvent = (name, data) => handlers.publishEvent?.(name, data);
    app.publicComponentEvent = (id, name, data) => handlers.publicComponentEvent?.(id, name, data);
    app.updateGlobalProps = (props) => handlers.updateGlobalProps?.(props);
    app.updateCardData = (...args) => handlers.updateCardData?.(...args);
    app.onAppReload = (...args) => handlers.onAppReload?.(...args);
    app.callDestroyLifetimeFun = () => handlers.callDestroyLifetimeFun?.();
    app.processCardConfig = () => {};
    app.__reactUnsubscribe = () => {
      dropLifecycle();
      delete app.publishEvent;
      delete app.publicComponentEvent;
      delete app.updateGlobalProps;
      delete app.updateCardData;
      delete app.onAppReload;
      delete app.callDestroyLifetimeFun;
      delete app.processCardConfig;
      delete app.__reactFallback;
      delete app.__reactUnsubscribe;
    };
    return;
  }

  // Each proxy is taken on its own: a page may stub one of them.
  const core = scope.getCoreContext();
  const native = scope.getNative();
  const added: [AppEventProxy, string, (event: { data: any }) => void][] = [];
  const on = (
    proxy: AppEventProxy,
    type: string,
    listener: (event: { data: any }) => void,
  ) => {
    proxy.addEventListener(type, listener);
    added.push([proxy, type, listener]);
  };
  // Both element-event transports carry
  // [<page name or component id>, handler name, event data].
  on(core, AppEvents.pageEvent, (event) => {
    const [, handlerName, data] = event.data as [string, string, unknown];
    // A prototype method reading `this`, so it stays a method call, and it is
    // taken from this page's app rather than the ambient one.
    app.callBeforePublishEvent?.(data);
    handlers.publishEvent?.(handlerName, data);
  });
  on(core, AppEvents.componentEvent, (event) => {
    const [componentId, handlerName, data] = event.data as [string, string, unknown];
    handlers.publicComponentEvent?.(componentId, handlerName, data);
  });
  on(core, AppEvents.globalProps, (event) => {
    const [props] = event.data as [Record<string, unknown>];
    handlers.updateGlobalProps?.(props);
  });
  on(core, AppEvents.cardData, (event) => {
    const [newData, options] = event.data as [unknown, unknown];
    handlers.updateCardData?.(newData, options);
  });
  on(core, AppEvents.appReload, (event) => {
    const [updateData] = event.data as [unknown];
    handlers.onAppReload?.(updateData);
  });
  // Destruction comes from the host, not the engine, so it rides the native
  // proxy. The engine only takes this path while a listener is registered.
  on(native, AppEvents.destroy, () => {
    handlers.callDestroyLifetimeFun?.();
  });

  app.__reactUnsubscribe = () => {
    for (const [proxy, type, listener] of added) {
      proxy.removeEventListener(type, listener);
    }
    added.length = 0;
    dropLifecycle?.();
    delete app.__reactUnsubscribe;
  };
}

/**
 * Drops this page's subscriptions. A runtime shared by several cards outlives
 * any one of them, so a destroyed page must not leave its listeners behind.
 */
export function unregisterAppEventHandlers(pageLynx?: unknown): void {
  const scope = (pageLynx as PageLynx | undefined) ?? (lynx as unknown as PageLynx);
  scope.getApp().__reactUnsubscribe?.();
}
