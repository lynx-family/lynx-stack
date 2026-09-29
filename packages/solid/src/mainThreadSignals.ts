// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type * as Solid from 'solid-js';

declare const __DEV__: boolean;
declare const console: {
  error(message: string): void;
};

function noop(): void {
  // Main-thread reactivity is intentionally static after the first render.
}

function reportMainThreadSignalUpdate(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('Cannot update signal in main thread!');
  }
}

function ignoreTracking(_tracking: () => void): void {
  // Main-thread reactions never subscribe.
}

export const createSignal: typeof Solid.createSignal = (<T>(
  value?: T,
): Solid.Signal<T | undefined> => {
  const read: Solid.Accessor<T | undefined> = () => value;
  const write = (() => {
    reportMainThreadSignalUpdate();
    return value;
  }) as Solid.Setter<T | undefined>;
  return [read, write];
}) as typeof Solid.createSignal;

export const createComponent: typeof Solid.createComponent = ((
  component: (props: Record<string, unknown>) => unknown,
  props: Record<string, unknown>,
) => component(props)) as typeof Solid.createComponent;

export const For: typeof Solid.For = ((props: {
  children: (item: unknown, index: Solid.Accessor<number>) => unknown;
  each: readonly unknown[] | undefined | null | false;
  fallback?: unknown;
}) => {
  const items = props.each;
  if (items === undefined || items === null || items === false) {
    return props.fallback;
  }
  if (items.length === 0) {
    return props.fallback;
  }
  return items.map((item, index) => props.children(item, () => index));
}) as typeof Solid.For;

export const Show: typeof Solid.Show = ((props: {
  children: unknown;
  fallback?: unknown;
  keyed?: boolean;
  when: unknown;
}) => {
  if (!props.when) {
    return props.fallback;
  }
  const children = props.children;
  if (typeof children !== 'function') {
    return children;
  }
  const render = children as (value: unknown) => unknown;
  return render(props.keyed ? props.when : () => props.when);
}) as typeof Solid.Show;

export const createMemo: typeof Solid.createMemo = ((
  compute: (previous: unknown) => unknown,
  initialValue?: unknown,
) => {
  const value = compute(initialValue);
  return () => value;
}) as typeof Solid.createMemo;

export const createComputed: typeof Solid.createComputed = ((
  compute: (previous: unknown) => unknown,
  initialValue?: unknown,
) => {
  compute(initialValue);
}) as typeof Solid.createComputed;

export const createRenderEffect: typeof Solid.createRenderEffect = ((
  compute: (previous: unknown) => unknown,
  initialValue?: unknown,
) => {
  compute(initialValue);
}) as typeof Solid.createRenderEffect;

export const createEffect: typeof Solid.createEffect = ((_compute: unknown) => {
  // User effects run on the background thread only.
}) as typeof Solid.createEffect;

export const createReaction: typeof Solid.createReaction = ((
  _onInvalidate: () => void,
) => ignoreTracking) as typeof Solid.createReaction;

export const createRoot: typeof Solid.createRoot = ((
  create: (dispose: () => void) => unknown,
) => create(noop)) as typeof Solid.createRoot;

export const batch: typeof Solid.batch = callback => callback();

export const untrack: typeof Solid.untrack = callback => callback();

export const effect: typeof Solid.createRenderEffect = createRenderEffect;
