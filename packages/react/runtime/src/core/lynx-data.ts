// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentChildren, Consumer, Context, Provider } from 'preact';
import type { ComponentClass } from 'react';

import { addLynxGlobalEventListener, removeLynxGlobalEventListener } from './lynx-global-event-emitter.js';

type Getter<T> = {
  [key in keyof T]: () => T[key];
};

type DataChangedListener<Data> = (data: Data) => void;

interface DataApiShellDeps<Data> {
  createContext: typeof import('preact').createContext;
  useState: typeof import('preact/hooks').useState;
  createElement: typeof import('preact/compat').createElement;
  useDataChanged: (eventName: string, listener: DataChangedListener<Data>) => void;
}

interface DataApiShellOptions<Data> {
  eventName: string;
  readData: () => Data;
  markDataUpdated?: (() => void) | undefined;
}

export function createDataApiShell<Data>(
  { createContext, useState, createElement, useDataChanged }: DataApiShellDeps<Data>,
  { eventName, readData, markDataUpdated }: DataApiShellOptions<Data>,
): Getter<{
  Context: Context<Data>;
  Provider: Provider<Data>;
  Consumer: Consumer<Data>;
  use: () => Data;
  useChanged: (callback: (data: Data) => void) => void;
}> {
  const Context = createContext({} as Data);

  const useChanged = (callback: (data: Data) => void) => {
    if (!__LEPUS__) {
      useDataChanged(eventName, callback);
    }
  };

  const Provider = ({ children }: { children?: ComponentChildren }) => {
    const [data, setData] = useState<Data>(readData);

    const handleChange = () => {
      markDataUpdated?.();
      setData(readData());
    };

    useChanged(handleChange);

    return createElement(
      Context.Provider,
      {
        value: data,
      },
      children,
    );
  };

  const Consumer: Consumer<Data> = Context.Consumer;

  const use = (): Data => {
    const [data, setData] = useState(readData);
    useChanged(() => {
      markDataUpdated?.();
      setData(readData());
    });

    return data;
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

interface WithDataInStateOptions<Data> {
  eventName: string;
  readData: () => Data;
  markDataUpdated?: (() => void) | undefined;
}

export function createWithDataInState<Data>(
  { eventName, readData, markDataUpdated }: WithDataInStateOptions<Data>,
) {
  return function withDataInState<P, S>(App: ComponentClass<P, S>): ComponentClass<P, S> {
    const isClassComponent = 'prototype' in App && 'render' in App.prototype;
    /* v8 ignore next 4 */
    if (!isClassComponent) {
      return App;
    }

    class C extends App {
      h?: (...args: unknown[]) => void;

      constructor(props: P) {
        super(props);
        this.state = {
          ...this.state,
          ...readData(),
        };

        if (!__LEPUS__) {
          this.h = (...args: unknown[]) => {
            const [newData] = args as [S];
            markDataUpdated?.();
            this.setState(newData);
          };
          addLynxGlobalEventListener(eventName, this.h);
        }
      }

      override componentWillUnmount(): void {
        super.componentWillUnmount?.();
        if (!__LEPUS__ && this.h) {
          removeLynxGlobalEventListener(eventName, this.h);
        }
      }
    }

    return C;
  };
}
