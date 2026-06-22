// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentChildren, Consumer, Context, Provider } from 'preact';
import type { ComponentClass } from 'react';

import { globalCommitContext } from './commit-context.js';
import type { useLynxGlobalEventListener } from './hooks/useLynxGlobalEventListener.js';

type Getter<T> = {
  [key in keyof T]: () => T[key];
};

// for better reuse if runtime is changed
export function factory<Data>(
  { createContext, useState, createElement, useLynxGlobalEventListener: useListener }: {
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
  const Context = createContext({} as Data);

  const Provider = ({ children }: { children?: ComponentChildren }) => {
    const [__, set] = useState<Data>(lynx[prop] as Data);

    const handleChange = () => {
      if (prop === '__initData') {
        globalCommitContext.flushOptions.triggerDataUpdated = true;
      }
      set(lynx[prop] as Data);
    };

    useChanged(handleChange);

    return createElement(
      Context.Provider,
      {
        value: __,
      },
      children,
    );
  };

  const Consumer: Consumer<Data> = Context.Consumer;

  const use = (): Data => {
    const [__, set] = useState(lynx[prop]);
    useChanged(() => {
      if (prop === '__initData') {
        globalCommitContext.flushOptions.triggerDataUpdated = true;
      }
      set(lynx[prop]);
    });

    return __ as Data;
  };

  const useChanged = (callback: (__: Data) => void) => {
    if (!__LEPUS__) {
      useListener(eventName, callback);
    }
  };

  return {
    /* v8 ignore next */
    Context: () => Context,
    Provider: () => Provider,
    Consumer: () => Consumer,
    use: () => use,
    useChanged: () => useChanged,
  };
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
  const isClassComponent = 'prototype' in App && 'render' in App.prototype;
  /* v8 ignore next 4 */
  if (!isClassComponent) {
    // return as-is when not class component
    return App;
  }

  class C extends App {
    h?: () => void;

    constructor(props: P) {
      super(props);
      this.state = {
        ...this.state,
        ...lynx.__initData,
      };

      if (!__LEPUS__) {
        lynx.getJSModule('GlobalEventEmitter').addListener(
          'onDataChanged',
          this.h = (...args: unknown[]) => {
            const [newData] = args as [S];
            globalCommitContext.flushOptions.triggerDataUpdated = true;
            this.setState(newData);
          },
        );
      }
    }

    override componentWillUnmount(): void {
      super.componentWillUnmount?.();
      if (!__LEPUS__) {
        lynx.getJSModule('GlobalEventEmitter').removeListener(
          'onDataChanged',
          this.h!,
        );
      }
    }
  }

  // Installed on the main thread only. There, `renderToString` reuses this component
  // instance across an `updatePage` re-render (the constructor never re-runs) and there
  // is no `onDataChanged` listener, so the constructor's one-time `initData` injection
  // goes stale; refresh it on every render, mirroring how `useInitData` re-reads
  // `lynx.__initData`. It is not installed on the background thread because defining
  // `getDerivedStateFromProps` at all would disable the wrapped component's legacy
  // `componentWillMount` / `componentWillReceiveProps` lifecycles — and the background
  // path already refreshes the state via its `onDataChanged` listener.
  if (__LEPUS__) {
    (C as ComponentClass<P, S>).getDerivedStateFromProps = (props: P, state: S): Partial<S> => {
      const base = { ...state, ...lynx.__initData } as S;
      // Compose with the wrapped component's own (or inherited) `getDerivedStateFromProps`
      // — passing it the freshened `initData` and letting its derived values win, matching
      // how it runs (and wins) on the background thread.
      const derived = App.getDerivedStateFromProps?.(props, base) ?? null;
      return { ...base, ...derived } as Partial<S>;
    };
  }

  return C;
}
