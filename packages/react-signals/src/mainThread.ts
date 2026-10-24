// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useState } from '@lynx-js/react/lepus/hooks';

declare const __DEV__: boolean;

// biome-ignore lint/suspicious/noConfusingVoidType: Match the upstream Signals callback API.
type EffectCallback = () => void | (() => void);

export interface SignalOptions<T = unknown> {
  name?: string;
  watched?: (this: Signal<T>) => void;
  unwatched?: (this: Signal<T>) => void;
}

export interface ReadonlySignal<T = unknown> {
  readonly value: T;
  peek(): T;
  subscribe(fn: (value: T) => void): () => void;
  valueOf(): T;
  toString(): string;
  toJSON(): T;
}

export interface EffectOptions {
  name?: string;
}

export type Model<TModel> = TModel;

export type ModelConstructor<
  TModel,
  TFactoryArgs extends unknown[] = [],
> = new(...args: TFactoryArgs) => Model<TModel>;

function noop(): void {
  // Main-thread Signals are intentionally static.
}

function disposeMainThreadEffect(): void {
  // Main-thread effects never subscribe.
}

function createDisposer(): () => void {
  const dispose = disposeMainThreadEffect;
  const disposeSymbol = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (
    disposeSymbol !== undefined
    && !Object.prototype.hasOwnProperty.call(dispose, disposeSymbol)
  ) {
    Object.defineProperty(dispose, disposeSymbol, { value: dispose });
  }
  return dispose;
}

function reportMainThreadSignalUpdate(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('Cannot update signal in main thread!');
  }
}

export class Signal<T = unknown> implements ReadonlySignal<T> {
  readonly name?: string;
  readonly #value: T;

  constructor(value?: T, options?: SignalOptions<T>) {
    this.#value = value as T;
    if (options?.name !== undefined) {
      this.name = options.name;
    }
  }

  get value(): T {
    return this.#value;
  }

  set value(_value: T) {
    reportMainThreadSignalUpdate();
  }

  peek(): T {
    return this.#value;
  }

  subscribe(_fn: (value: T) => void): () => void {
    return noop;
  }

  valueOf(): T {
    return this.#value;
  }

  toString(): string {
    return String(this.#value);
  }

  toJSON(): T {
    return this.#value;
  }
}

class MainThreadComputed<T> {
  readonly name?: string;
  readonly #compute: () => T;

  constructor(compute: () => T, options?: SignalOptions<T>) {
    this.#compute = compute;
    if (options?.name !== undefined) {
      this.name = options.name;
    }
  }

  get value(): T {
    return this.#compute();
  }

  peek(): T {
    return this.#compute();
  }

  subscribe(_fn: (value: T) => void): () => void {
    return noop;
  }

  valueOf(): T {
    return this.#compute();
  }

  toString(): string {
    return String(this.#compute());
  }

  toJSON(): T {
    return this.#compute();
  }
}

function createMainThreadSignal<T>(
  value: T,
  options?: SignalOptions<T>,
): Signal<T> {
  return new Signal(value, options);
}

export function signal<T>(
  value: T,
  options?: SignalOptions<T>,
): Signal<T>;
export function signal<T = undefined>(): Signal<T | undefined>;
export function signal<T>(
  value?: T,
  options?: SignalOptions<T>,
): Signal<T | undefined> {
  return createMainThreadSignal(
    value,
    options as SignalOptions<T | undefined> | undefined,
  );
}

export function computed<T>(
  compute: () => T,
  options?: SignalOptions<T>,
): ReadonlySignal<T> {
  return new MainThreadComputed(compute, options) as unknown as ReadonlySignal<
    T
  >;
}

export function effect(
  _callback: EffectCallback,
  _options?: EffectOptions,
): () => void {
  return createDisposer();
}

export function batch<T>(callback: () => T): T {
  return callback();
}

export function untracked<T>(callback: () => T): T {
  return callback();
}

export function action<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  return function(this: unknown, ...args: TArgs): TReturn {
    return callback.apply(this, args);
  };
}

export function createModel<
  TModel,
  TFactoryArgs extends unknown[] = [],
>(
  modelFactory: (...args: TFactoryArgs) => TModel,
): ModelConstructor<TModel, TFactoryArgs> {
  return function SignalModel(...args: TFactoryArgs): Model<TModel> {
    const model = modelFactory(...args) as Model<TModel>;
    const disposeSymbol = (Symbol as unknown as { dispose?: symbol }).dispose;
    if (disposeSymbol !== undefined) {
      Object.defineProperty(model, disposeSymbol, { value: noop });
    }
    return model;
  } as unknown as ModelConstructor<TModel, TFactoryArgs>;
}

export function useSignal<T>(
  value: T,
  options?: SignalOptions<T>,
): Signal<T>;
export function useSignal<T = undefined>(): Signal<T | undefined>;
export function useSignal<T>(
  value?: T,
  options?: SignalOptions<T>,
): Signal<T | undefined> {
  const [result] = useState(() =>
    createMainThreadSignal(
      value,
      options as SignalOptions<T | undefined> | undefined,
    )
  );
  return result;
}

export function useComputed<T>(
  compute: () => T,
  options?: SignalOptions<T>,
): ReadonlySignal<T> {
  const [computeRef] = useState(() => ({ current: compute }));
  computeRef.current = compute;
  const [result] = useState(() =>
    computed(() => computeRef.current(), options)
  );
  return result;
}

export function useSignalEffect(
  _callback: EffectCallback,
  _options?: EffectOptions,
): void {
  // Main-thread effects never run or subscribe.
}

export function useModel<TModel>(
  factory: ModelConstructor<TModel> | (() => Model<TModel>),
): Model<TModel> {
  const [model] = useState(() => (factory as () => Model<TModel>)());
  return model;
}
