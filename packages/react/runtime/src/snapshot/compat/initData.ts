// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Consumer, Context, Provider } from 'preact';
import type { ComponentClass } from 'react';

import { createDataApiShell, createWithDataInState } from '../../core/lynx-data.js';
import { useLynxGlobalEventListener } from '../../core/hooks/useLynxGlobalEventListener.js';
import { globalFlushOptions } from '../lifecycle/patch/commit.js';

type Getter<T> = {
  [key in keyof T]: () => T[key];
};

function markInitDataUpdated(): void {
  globalFlushOptions.triggerDataUpdated = true;
}

// for better reuse if runtime is changed
export function factory<Data>(
  deps: {
    createContext: typeof import('preact').createContext;
    useState: typeof import('preact/hooks').useState;
    createElement: typeof import('preact/compat').createElement;
    useLynxGlobalEventListener: typeof useLynxGlobalEventListener;
  },
  prop: '__globalProps' | '__initData',
  eventName: string,
): Getter<{
  Context: Context<Data>;
  Provider: Provider<Data>;
  Consumer: Consumer<Data>;
  use: () => Data;
  useChanged: (callback: (data: Data) => void) => void;
}> {
  return createDataApiShell<Data>({
    createContext: deps.createContext,
    useState: deps.useState,
    createElement: deps.createElement,
    useDataChanged: deps.useLynxGlobalEventListener,
  }, {
    eventName,
    readData: () => lynx[prop] as Data,
    markDataUpdated: prop === '__initData' ? markInitDataUpdated : undefined,
  });
}

/**
 * Higher-Order Component (HOC) that injects `initData` into the state of the given class component.
 *
 * This HOC checks if the provided component is a class component. If it is, it wraps the component
 * and injects the `initData` into its state. It also adds a listener
 * to update the state when data changes, and removes the listener when the component unmounts.
 *
 * @typeParam P - The type of the props of the wrapped component.
 * @typeParam S - The type of the state of the wrapped component.
 *
 * @param App - The class component to be wrapped by the HOC.
 *
 * @returns The original component if it is not a class component, otherwise a new class component
 *          with `initData` injection and state update functionality.
 *
 * @example
 * ```typescript
 * class App extends React.Component<MyProps, MyState> {
 *   // component implementation
 * }
 *
 * export default withInitDataInState(App);
 * ```
 * @public
 */
export function withInitDataInState<P, S>(App: ComponentClass<P, S>): ComponentClass<P, S> {
  return createWithDataInState({
    eventName: 'onDataChanged',
    readData: () => lynx.__initData as S,
    markDataUpdated: markInitDataUpdated,
  })(App);
}
