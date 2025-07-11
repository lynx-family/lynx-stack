// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { startTransition as preactStartTransition } from 'preact/compat';
import {
  useCallback,
  useContext,
  useDebugValue,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useMemo,
  useEffect as usePreactEffect,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
import type { DependencyList, EffectCallback } from 'react';

/**
 * `useLayoutEffect` is now an alias of `useEffect`. Use `useEffect` instead.
 *
 * Accepts a function that contains imperative, possibly effectful code. The effects run after main thread dom update without blocking it.
 *
 * @param effect - Imperative function that can return a cleanup function
 * @param deps - If present, effect will only activate if the values in the list change (using ===).
 *
 * @public
 *
 * @deprecated `useLayoutEffect` in the background thread cannot offer the precise timing for reading layout information and synchronously re-render, which is different from React.
 */
function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  return usePreactEffect(effect, deps);
}

/**
 * Accepts a function that contains imperative, possibly effectful code.
 * The effects run after main thread dom update without blocking it.
 *
 * @param effect - Imperative function that can return a cleanup function
 * @param deps - If present, effect will only activate if the values in the list change (using ===).
 *
 * @public
 */
function useEffect(effect: EffectCallback, deps?: DependencyList): void {
  return usePreactEffect(effect, deps);
}

/**
 * Starts a transition update, marking state updates in the callback as non-urgent
 *
 * Note: This is Preact's startTransition implementation, which differs fundamentally from React's:
 * - React marks updates as low priority with interruption and time-slicing support
 * - Preact simply executes the callback synchronously without true concurrent features
 *
 * @param cb - Callback function containing state updates, executed immediately and synchronously
 *
 * @public
 */
function startTransition(cb: () => void): void {
  return preactStartTransition(cb);
}

export {
  // preact
  startTransition,
  useState,
  useReducer,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useEffect,
  useCallback,
  useMemo,
  useContext,
  useDebugValue,
  useErrorBoundary,
  useId,
};
