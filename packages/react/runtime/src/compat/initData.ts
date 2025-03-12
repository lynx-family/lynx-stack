// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentClass, Consumer, Context, FC, PropsWithChildren, ReactNode } from 'react';

import { useLynxGlobalEventListener } from '../hooks/useLynxGlobalEventListener.js';

type Getter<T> = {
  [key in keyof T]: () => T[key];
};

// for better reuse if runtime is changed
export function factory<Data>(
  { createContext, useState, createElement, useLynxGlobalEventListener: useListener }: typeof import('react') & {
    useLynxGlobalEventListener: typeof useLynxGlobalEventListener;
  },
  prop: '__globalProps' | '__initData',
  eventName: string,
): Getter<{
  Context: Context<Data>;
  Provider: FC<{
    children?: ReactNode | undefined;
  }>;
  Consumer: Consumer<Data>;
  use: () => Data;
  useChanged: (callback: (data: Data) => void) => void;
}> {
  const Context = createContext({} as Data);

  const Provider: FC<PropsWithChildren> = ({ children }) => {
    const [__, set] = useState<Data>(lynx[prop] as Data);

    const handleChange = () => {
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
      set(lynx[prop]);
    });

    return __ as Data;
  };

  const useChanged = (callback: (__: Data) => void) => {
    if (!__LEPUS__) {
      // @ts-ignore
      useListener<(__: unknown) => void>(eventName, callback);
    }
  };

  return {
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
  const isClassComponent = 'prototype' in App && App.prototype.render;
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
          this.h = () => {
            this.setState(lynx.__initData as S);
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

  return C;
}
