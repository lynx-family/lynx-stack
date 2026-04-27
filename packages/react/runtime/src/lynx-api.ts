// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import { createContext, createElement } from 'preact/compat';
import { useState } from 'preact/hooks';
import type { Consumer, FC, ReactNode } from 'react';

import { useLynxGlobalEventListener } from './core/hooks/useLynxGlobalEventListener.js';
import { __root } from './root.js';
import { profileEnd, profileStart } from './shared/profile.js';
import { factory, withInitDataInState } from './snapshot/compat/initData.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import { flushDelayedLifecycleEvents } from './snapshot/lynx/tt.js';

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
  render: (jsx: ReactNode) => void;
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
  render: (jsx: ReactNode): void => {
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
      if (__FIRST_SCREEN_SYNC_TIMING__ === 'immediately') {
        // This is for cases where `root.render()` is called asynchronously,
        // `firstScreen` message might have been reached.
        flushDelayedLifecycleEvents();
      } else {
        lynx.getNativeApp().callLepusMethod(LifecycleConstant.jsReady, {});
      }
    }
  },
  /* v8 ignore next 3 */
  registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
    lynx.registerDataProcessors(dataProcessorDefinition);
  },
};

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

/**
 * The interface you can extends so that the `useGlobalProps` returning value can be customized
 *
 * @public
 */
export interface GlobalProps {}

const _GlobalProps = typeof __GLOBAL_PROPS_MODE__ !== 'undefined' && __GLOBAL_PROPS_MODE__ === 'event'
  ? /* @__PURE__ */ factory<GlobalProps>(
    {
      createContext,
      useState,
      createElement,
      useLynxGlobalEventListener,
    },
    '__globalProps',
    'onGlobalPropsChanged',
  )
  : /* @__PURE__ */ createFallbackGlobalProps();

function warnGlobalPropsMode() {
  if (typeof __LEPUS__ !== 'undefined' && !__LEPUS__ && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      `No need to use this API when 'globalPropsMode' is not 'event', `
        + `updates will be triggered automatically by full re-render. `
        + `Please set 'globalPropsMode' to 'event' to enable optimized updates.`,
    );
  }
}

function createFallbackGlobalProps() {
  return {
    Provider: () => {
      return ({ children }: { children?: ReactNode | undefined }) => {
        warnGlobalPropsMode();
        return children;
      };
    },
    Consumer: () => {
      return ({ children }: { children: (data: GlobalProps) => ReactNode }) => {
        warnGlobalPropsMode();
        return children(lynx.__globalProps);
      };
    },
    use: () => {
      return (): GlobalProps => {
        warnGlobalPropsMode();
        return lynx.__globalProps;
      };
    },
    useChanged: () => {
      return (callback: (data: GlobalProps) => void): void => {
        if (!__LEPUS__) {
          useLynxGlobalEventListener('onGlobalPropsChanged', callback);
        }
      };
    },
  };
}

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
export { runOnBackground } from './snapshot/worklet/call/runOnBackground.js';
export { runOnMainThread } from './snapshot/worklet/call/runOnMainThread.js';
export { MainThreadRef, useMainThreadRef } from './snapshot/worklet/ref/workletRef.js';
