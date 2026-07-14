// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import { createContext, createElement } from 'preact/compat';
import { useState } from 'preact/hooks';
import type { Consumer, FC, ReactNode } from 'react';

import { createGlobalProps } from './core/globalProps.js';
import type { GlobalProps } from './core/globalProps.js';
import { useLynxGlobalEventListener } from './core/hooks/useLynxGlobalEventListener.js';
import { getHydrationPromise } from './core/hydration.js';
import { factory, withInitDataInState } from './core/initData.js';
import { __root } from './root.js';
import { profileEnd, profileStart } from './shared/profile.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import {
  disableAutoHydrate,
  isHydrationHeld,
  onFirstScreenSyncReady,
} from './snapshot/lifecycle/event/firstScreenSync.js';
import { flushDelayedLifecycleEvents } from './snapshot/lynx/tt.js';

/**
 * Options of {@link Root.render}.
 *
 * @public
 */
export interface RootRenderOptions {
  /**
   * Whether the framework performs the hydration handover to the background
   * thread on its own.
   *
   * By default (`true`), the handover happens automatically following the
   * `firstScreenSyncTiming` preset. Pass `false` to split the two verbs: the
   * main thread keeps the UI (and keeps responding to data updates
   * synchronously) until you call {@link Root.hydrate}.
   *
   * @example
   *
   * ```ts
   * import { root } from '@lynx-js/react';
   *
   * root.render(<App />, { hydrate: false });
   *
   * const data = await fetchInitialData();
   * store.prime(data);
   * await root.hydrate();
   * ```
   *
   * @defaultValue `true`
   */
  hydrate?: boolean | undefined;
}

/**
 * The default root exported by `@lynx-js/react` for you to render a JSX
 * @public
 */
export interface Root {
  /**
   * Use this API to pass in your JSX to render
   *
   * @example
   *
   * ```ts
   * import { root } from "@lynx-js/react"
   *
   * function App() {
   *   // Your app
   *   return <view>...</view>
   * }
   *
   * root.render(<App/>);
   * ```
   *
   * @example
   *
   * ```tsx
   * import { root } from "@lynx-js/react"
   *
   * function App() {
   *   // Your app
   *   return <view>...</view>
   * }
   *
   * if (__MAIN_THREAD__) {
   *   root.render(
   *     <DataProvider data={DEFAULT_DATA}>
   *        <App/>
   *     </DataProvider>
   *   );
   * } else if (__BACKGROUND__) {
   *   fetchData().then((data) => {
   *     root.render(
   *       <DataProvider data={data}>
   *          <App/>
   *       </DataProvider>
   *     ); // You can render later after your data is ready
   *   })
   * }
   * ```
   *
   * @public
   */
  render: (jsx: ReactNode, options?: RootRenderOptions) => void;
  /**
   * Perform (or await) the hydration handover: the background thread
   * reconciles against the main-thread first-screen tree and takes the UI
   * ownership over.
   *
   * The returned promise resolves when the handover completes on the calling
   * thread — on the background thread, after the main thread has applied and
   * acknowledged the hydration patch; on the main thread, right after the
   * hydration patch is applied.
   *
   * When the handover is held — either through
   * `root.render(jsx, { hydrate: false })` or through the
   * `firstScreenSyncTiming: 'manual'` preset — calling this API also triggers
   * the handover. In the automatic presets it only awaits the completion.
   *
   * Note that until the handover completes, updates rendered by the background
   * thread are not visible and background event handlers are queued. Every
   * "wait" before `hydrate()` should therefore come with a timeout or another
   * bound:
   *
   * @example
   *
   * ```ts
   * import { root } from '@lynx-js/react';
   *
   * root.render(<App />, { hydrate: false });
   *
   * // Take over once the data is ready, but never wait longer than 300ms.
   * await Promise.race([dataReady, timeout(300)]);
   * await root.hydrate();
   * ```
   *
   * @public
   */
  hydrate: () => Promise<void>;
  /**
   * {@inheritDoc Lynx.registerDataProcessors}
   * @deprecated use {@link Lynx.registerDataProcessors | lynx.registerDataProcessors} instead
   * @public
   */
  registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition) => void;
}

/**
 * The default and only root of ReactLynx for you to render JSX
 * @example
 * ```ts
 * import { root } from "@lynx-js/react"
 * ```
 *
 * @public
 */
export const root: Root = {
  render: (jsx: ReactNode, options?: RootRenderOptions): void => {
    if (options?.hydrate === false) {
      // Runs on both threads before `renderPage`, so the main thread makes its
      // hold-or-sync decision with this flag already in place.
      disableAutoHydrate();
    }
    /* v8 ignore next 2 */
    if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
      __root.__jsx = jsx;
    } else {
      __root.__jsx = jsx;
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileStart('ReactLynx::renderBackground');
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      render(jsx, __root as any);
      if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
        profileEnd();
      }
      if (__FIRST_SCREEN_SYNC_TIMING__ === 'jsReady' && !isHydrationHeld()) {
        // `jsReady` is a special case of the `manual` first-screen sync: the
        // framework marks ready automatically once the background is ready.
        lynx.getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
      } else {
        // `immediately` or a held handover: the first screen is synced without
        // waiting for the background, so the `firstScreen` message might have
        // been reached when `root.render()` is called asynchronously.
        flushDelayedLifecycleEvents();
      }
    }
  },
  hydrate: (): Promise<void> => {
    if (isHydrationHeld()) {
      if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
        // The handover happens on the main thread, forward the request to it.
        lynx.getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
      } else {
        onFirstScreenSyncReady();
      }
    }
    return getHydrationPromise();
  },
  /* v8 ignore next 3 */
  registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
    lynx.registerDataProcessors(dataProcessorDefinition);
  },
};

/**
 * Mark the first screen as ready to sync when `firstScreenSyncTiming` is `'manual'`.
 *
 * The main thread holds the UI control until this is called, so the handover timing to
 * the background thread (for hydration) is fully controlled by the user. It can be called
 * from both threads (a background-thread call is forwarded to the main thread), is a no-op
 * unless `firstScreenSyncTiming` is `'manual'`, and has no further effect once called.
 *
 * @deprecated Use {@link Root.hydrate | root.hydrate()} instead — it triggers the same
 * handover, works together with `root.render(jsx, { hydrate: false })` without any build
 * configuration, and returns a promise that resolves when the handover completes.
 *
 * @example
 *
 * ```ts
 * import { markFirstScreenSyncReady } from "@lynx-js/react"
 *
 * markFirstScreenSyncReady();
 * ```
 *
 * @public
 */
export function markFirstScreenSyncReady(): void {
  if (__FIRST_SCREEN_SYNC_TIMING__ !== 'manual') {
    return;
  }
  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    // The sync happens on the main thread, forward the mark to it.
    lynx.getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
    return;
  }
  onFirstScreenSyncReady();
}

const _InitData = /* @__PURE__ */ factory<InitData>(
  {
    createContext,
    useState,
    createElement,
    useLynxGlobalEventListener,
  },
  '__initData',
  'onDataChanged',
);
/**
 * The {@link https://react.dev/reference/react/createContext#provider | Provider} Component that provide `initData`,
 * you must wrap your JSX inside it
 * @group Components
 *
 * @example
 *
 * ```ts
 * import { root } from "@lynx-js/react"
 *
 * function App() {
 *   return (
 *     <InitDataConsumer children={(initData) => <view>...</view>}/>
 *   )
 * }
 *
 * root.render(
 *   <InitDataProvider>
 *      <App/>
 *   </InitDataProvider>
 * );
 *
 * ```
 *
 * @public
 */
// @ts-expect-error make preact and react types work
export const InitDataProvider: FC<{ children?: ReactNode | undefined }> = /* @__PURE__ */ _InitData.Provider();
/**
 * The {@link https://react.dev/reference/react/createContext#consumer | Consumer} Component that provide `initData`.
 * This should be used with {@link InitDataProvider}
 * @group Components
 * @public
 */
// @ts-expect-error make preact and react types work
export const InitDataConsumer: Consumer<InitData> = /* @__PURE__ */ _InitData.Consumer();
/**
 * A React Hooks for you to get `initData`.
 * If `initData` is changed, a re-render will be triggered automatically.
 *
 * @example
 *
 * ```ts
 * function App() {
 *   const initData = useInitData();
 *
 *   initData.someProperty // use it
 * }
 * ```
 *
 * @public
 */
export const useInitData: () => InitData = /* @__PURE__ */ _InitData.use();
/**
 * A React Hooks for you to get notified when `initData` changed.
 *
 * @example
 * ```ts
 * function App() {
 *   useInitDataChanged((data) => {
 *     data.someProperty // can use it
 *   })
 * }
 * ```
 * @public
 */
export const useInitDataChanged: (callback: (data: InitData) => void) => void = /* @__PURE__ */ _InitData.useChanged();

export type { GlobalProps } from './core/globalProps.js';

const _GlobalProps = /* @__PURE__ */ createGlobalProps<GlobalProps>({
  createContext,
  useState,
  createElement,
  useLynxGlobalEventListener,
});

/**
 * The {@link https://react.dev/reference/react/createContext#provider | Provider} Component that provide `lynx.__globalProps`,
 * you must wrap your JSX inside it
 * @group Components
 *
 * @example
 *
 * ```ts
 * import { root } from "@lynx-js/react"
 *
 * function App() {
 *   return (
 *     <GlobalPropsConsumer children={(globalProps) => <view>...</view>}/>
 *   )
 * }
 *
 * root.render(
 *   <GlobalPropsProvider>
 *      <App/>
 *   </GlobalPropsProvider>
 * );
 *
 * ```
 *
 * @public
 */
// @ts-expect-error make preact and react types work
export const GlobalPropsProvider: FC<{ children?: ReactNode | undefined }> = /* @__PURE__ */ _GlobalProps.Provider();

/**
 * The {@link https://react.dev/reference/react/createContext#consumer | Consumer} Component that provide `lynx.__globalProps`.
 * This should be used with {@link GlobalPropsProvider}
 * @group Components
 * @public
 */
// @ts-expect-error make preact and react types work
export const GlobalPropsConsumer: Consumer<GlobalProps> = /* @__PURE__ */ _GlobalProps.Consumer();

/**
 * A React Hooks for you to get `lynx.__globalProps`.
 * If `lynx.__globalProps` is changed, a re-render will be triggered automatically.
 *
 * @example
 *
 * ```ts
 * function App() {
 *   const globalProps = useGlobalProps();
 *
 *   globalProps.someProperty // use it
 * }
 * ```
 *
 * @public
 */
export const useGlobalProps: () => GlobalProps = /* @__PURE__ */ _GlobalProps.use();

/**
 * A React Hooks for you to get notified when `__globalProps` changed.
 *
 * @example
 * ```ts
 * function App() {
 *   useGlobalPropsChanged((data) => {
 *     lynx.__globalProps.someProperty // can use lynx.__globalProps
 *     data.someProperty // can use data
 *   })
 * }
 * ```
 * @public
 */
export const useGlobalPropsChanged: (callback: (data: GlobalProps) => void) => void = /* @__PURE__ */ _GlobalProps
  .useChanged();

/**
 * The interface you can extends so that the `defaultDataProcessor` parameter can be customized
 *
 * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
 *
 * @public
 */
export interface InitDataRaw {}
/**
 * The interface you can extends so that the `defaultDataProcessor` returning value can be customized
 *
 * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
 *
 * @public
 */
export interface InitData {}

export { withInitDataInState };

/**
 * The data processors that registered with {@link Lynx.registerDataProcessors}.
 *
 * @example
 *
 * Extending `dataProcessors` interface
 *
 * ```ts
 * import type { DataProcessors as WellKnownDataProcessors } from '@lynx-js/react';
 *
 * declare module '@lynx-js/react' {
 *   interface DataProcessors extends WellKnownDataProcessors {
 *     foo(bar: string): number;
 *   }
 * }
 * ```
 *
 * Then you can use `lynx.registerDataProcessors` with types.
 *
 * ```js
 * lynx.registerDataProcessors({
 *   dataProcessors: {
 *     foo(bar) {
 *       return 1;
 *     }
 *   }
 * })
 * ```
 *
 * @public
 */
export interface DataProcessors {
  /**
   * Optional processor to override screen metrics used by the app
   *
   * @param metrics - The physical screen dimensions in pixels
   *
   * @returns New screen dimensions to be used by the app
   *
   * @example
   *
   * ```ts
   * lynx.registerDataProcessors({
   *   dataProcessors: {
   *     getScreenMetricsOverride: (metrics) => {
   *       // Force a specific aspect ratio
   *       return {
   *         width: metrics.width,
   *         height: metrics.width * (16/9)
   *       };
   *     }
   *   }
   * });
   * ```
   */
  getScreenMetricsOverride?(metrics: {
    /**
     * The physical pixel width of the screen
     */
    width: number;
    /**
     * The physical pixel height of the screen
     */
    height: number;
  }): { width: number; height: number };

  /**
   * Custom unknown data processors.
   *
   * @remarks
   *
   * You may extends the `DataProcessors` interface for better TypeScript types. See {@link DataProcessors}.
   */
  [processorName: string]: (...args: any[]) => any;
}

/**
 * Definition of DataProcessor(s)
 * @public
 */
export interface DataProcessorDefinition {
  /**
   * You can custom input and output type of `defaultDataProcessor` by extends {@link InitDataRaw} and {@link InitData}
   *
   * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
   *
   * @param rawInitData - initData passed from native code
   * @returns
   * @public
   */
  defaultDataProcessor?: (rawInitData: InitDataRaw) => InitData;
  /**
   * Should be used with `lynx.registerDataProcessors`. See more examples at {@link Lynx.registerDataProcessors}.
   *
   * @public
   */
  dataProcessors?: DataProcessors;
}

/**
 * APIs under `lynx` global variable that added by ReactLynx.
 *
 * @example
 *
 * ```ts
 * lynx.registerDataProcessors(...);
 * lynx.querySelector(...);
 * lynx.querySelectorAll(...);
 * ```
 *
 * @public
 */
export interface Lynx {
  /**
   * An alias of `lynx.getJSModule("GlobalEventEmitter").trigger(eventName, params)` only in Lepus
   *
   * @public
   */
  triggerGlobalEventFromLepus: (eventName: string, params: any) => void;

  /**
   * Register DataProcessors. You MUST call this before `root.render()`.
   *
   * @example
   *
   * You MUST call `lynx.registerDataProcessors` before calling `root.render()`.
   *
   * ```ts
   * import { root } from "@lynx-js/react"
   *
   * // You MUST call this before `root.render()`
   * lynx.registerDataProcessors({
   *   defaultDataProcessor: () => {...} // default DataProcessor
   *   dataProcessors: {
   *     getScreenMetricsOverride: () => {...} // named DataProcessor
   *   }
   * })
   *
   * root.render(<App/>);
   * ```
   *
   * @example
   *
   * If you have a class component with `static defaultDataProcessor`
   * or `static dataProcessors`, you can use it to register DataProcessors.
   *
   * ```ts
   * import { root, Component } from "@lynx-js/react"
   *
   * class App extends Component {
   *   static defaultDataProcessor() {
   *      ...
   *   }
   *
   *   static dataProcessors = {
   *     getScreenMetricsOverride() {
   *       ...
   *     }
   *   }
   * }
   *
   * lynx.registerDataProcessors(App); // You can pass `App` because it has the required shape
   * root.render(<App/>);
   * ```
   *
   * @example
   *
   * For developers who want fully typed `defaultDataProcessor`,
   * they can achieve it by extends interface `InitDataRaw` and `InitData`.
   *
   * ```ts
   * import { root } from "@lynx-js/react"
   *
   * interface ExistingInterface {
   *   somePropertyFromExistingInterface: number
   * }
   *
   * declare module '@lynx-js/react' {
   *   interface InitDataRaw extends ExistingInterface {
   *     someAnotherCustomProperty: string
   *   }
   * }
   *
   * lynx.registerDataProcessors({
   *   defaultDataProcessor: (initDataRaw) => {
   *     initDataRaw.somePropertyFromExistingInterface // will be typed
   *   }
   * })
   *
   * ```
   *
   * @example
   *
   * For developers who want fully typed `defaultDataProcessor`,
   * they can achieve it by extends interface `InitDataRaw` and `InitData`.
   *
   * ```ts
   * import { root, useInitData } from "@lynx-js/react"
   *
   * interface AnotherExistingInterface {
   *   someAnotherPropertyFromExistingInterface: number
   * }
   *
   * declare module '@lynx-js/react' {
   *   interface InitData extends AnotherExistingInterface {
   *     someCustomProperty: string
   *   }
   * }
   *
   * root.registerDataProcessors({
   *   defaultDataProcessor: () => {
   *     return {
   *       someCustomProperty: 'value', // will be typed
   *       someAnotherPropertyFromExistingInterface: 1, // will be typed
   *     }
   *   }
   * })
   *
   * function App() {
   *   const initData = useInitData();
   *
   *   initData.someCustomProperty // will be typed
   *   initData.someAnotherPropertyFromExistingInterface // will be typed
   * }
   *
   * ```
   * @public
   */
  registerDataProcessors: (dataProcessorDefinition?: DataProcessorDefinition) => void;
}

export { useLynxGlobalEventListener } from './core/hooks/useLynxGlobalEventListener.js';
export { runOnBackground } from './core/background-function/run-on-background.js';
export { runOnMainThread } from './snapshot/worklet/call/runOnMainThread.js';
export { MainThreadRef, useMainThreadRef } from './snapshot/worklet/ref/workletRef.js';
