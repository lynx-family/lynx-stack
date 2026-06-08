// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentChildren, Consumer, Provider } from 'preact';

import type { useLynxGlobalEventListener } from './hooks/useLynxGlobalEventListener.js';
import { factory } from './initData.js';

type Getter<T> = {
  [key in keyof T]: () => T[key];
};

interface GlobalPropsRuntimeDeps {
  createContext: typeof import('preact').createContext;
  useState: typeof import('preact/hooks').useState;
  createElement: typeof import('preact/compat').createElement;
  useLynxGlobalEventListener: typeof useLynxGlobalEventListener;
}

interface GlobalPropsApi<Data> {
  Provider: Provider<Data>;
  Consumer: Consumer<Data>;
  use: () => Data;
  useChanged: (callback: (data: Data) => void) => void;
}

/**
 * The interface you can extends so that the `useGlobalProps` returning value can be customized
 *
 * @public
 */
export interface GlobalProps {}

export interface UpdateGlobalPropsOptions {
  forceRerender?: (() => void) | undefined;
}

export function isGlobalPropsEventMode(): boolean {
  return typeof __GLOBAL_PROPS_MODE__ !== 'undefined' && __GLOBAL_PROPS_MODE__ === 'event';
}

export function createGlobalProps<Data = GlobalProps>(
  deps: GlobalPropsRuntimeDeps,
): Getter<GlobalPropsApi<Data>> {
  return isGlobalPropsEventMode()
    ? /* @__PURE__ */ factory<Data>(
      deps,
      '__globalProps',
      'onGlobalPropsChanged',
    )
    : /* @__PURE__ */ createFallbackGlobalProps<Data>(deps.useLynxGlobalEventListener);
}

export function updateGlobalProps(
  newData: Record<string, any>,
  { forceRerender }: UpdateGlobalPropsOptions = {},
): void {
  if (isGlobalPropsEventMode()) {
    // COW keeps Provider / Consumer state readers aligned in event mode.
    lynx.__globalProps = Object.assign({}, lynx.__globalProps, newData);
  } else {
    Object.assign(lynx.__globalProps, newData);
    if (forceRerender) {
      void Promise.resolve().then(forceRerender);
    }
  }

  lynxCoreInject.tt.GlobalEventEmitter.emit('onGlobalPropsChanged', [lynx.__globalProps]);
}

function warnGlobalPropsMode(): void {
  if (typeof __LEPUS__ !== 'undefined' && !__LEPUS__ && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      `No need to use this API when 'globalPropsMode' is not 'event', `
        + `updates will be triggered automatically by full re-render. `
        + `Please set 'globalPropsMode' to 'event' to enable optimized updates.`,
    );
  }
}

function FallbackProvider({ children }: { children?: ComponentChildren | undefined }): ComponentChildren {
  warnGlobalPropsMode();
  return children;
}

function FallbackConsumer<Data>({ children }: { children: (data: Data) => ComponentChildren }): ComponentChildren {
  warnGlobalPropsMode();
  return children(lynx.__globalProps as Data);
}

function useFallbackGlobalProps<Data>(): Data {
  warnGlobalPropsMode();
  return lynx.__globalProps as Data;
}

function createFallbackGlobalProps<Data>(
  useListener: typeof useLynxGlobalEventListener,
): Getter<GlobalPropsApi<Data>> {
  const useChanged = (callback: (data: Data) => void): void => {
    if (typeof __LEPUS__ === 'undefined' || !__LEPUS__) {
      useListener('onGlobalPropsChanged', callback);
    }
  };

  return {
    Provider: () => FallbackProvider,
    Consumer: () => FallbackConsumer as Consumer<Data>,
    use: () => useFallbackGlobalProps,
    useChanged: () => useChanged,
  };
}
