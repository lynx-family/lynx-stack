// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test, vi } from 'vitest';

import {
  For,
  Show,
  batch,
  createComponent,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  effect,
  untrack,
} from '../src/mainThreadSignals.js';

test('keeps main-thread signals static', () => {
  const [count, setCount] = createSignal(1);

  expect(count()).toBe(1);
  expect(setCount(2)).toBe(1);
  expect(setCount(value => value + 1)).toBe(1);
  expect(count()).toBe(1);
});

test('runs render computations once without subscribing', () => {
  const render = vi.fn((previous?: number) => (previous ?? 0) + 1);
  const deferred = vi.fn();
  const dispose = createRoot(dispose => {
    createRenderEffect(render, 1);
    effect(render, 2);
    createEffect(deferred);
    return dispose;
  });

  expect(render).toHaveBeenNthCalledWith(1, 1);
  expect(render).toHaveBeenNthCalledWith(2, 2);
  expect(deferred).not.toHaveBeenCalled();
  expect(dispose()).toBeUndefined();
});

test('provides static memo, batch, and untrack values', () => {
  const compute = vi.fn(() => 42);
  const value = createMemo(compute);

  expect(value()).toBe(42);
  expect(value()).toBe(42);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(batch(() => value())).toBe(42);
  expect(untrack(() => value())).toBe(42);
});

test('invokes components without creating reactive state', () => {
  const component = vi.fn((props: { value: number }) => props.value);

  expect(createComponent(component, { value: 42 })).toBe(42);
  expect(component).toHaveBeenCalledOnce();
});

test('renders initial control-flow values without subscriptions', () => {
  const children = vi.fn(() => ['first', 'second']);
  expect(For({
    each: ['first', 'second'],
    children: (item, index) => `${index()}:${item}`,
  })).toEqual(['0:first', '1:second']);
  expect(For({
    each: [],
    fallback: 'empty',
    children: item => item,
  })).toBe('empty');
  expect(Show({
    when: 'ready',
    children: value => value(),
  })).toBe('ready');
  expect(Show({
    when: false,
    fallback: 'hidden',
    children: 'visible',
  })).toBe('hidden');
  expect(Show({
    when: true,
    get children() {
      return children();
    },
  })).toEqual(['first', 'second']);
  expect(children).toHaveBeenCalledOnce();
});
