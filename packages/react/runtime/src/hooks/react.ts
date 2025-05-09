// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  useCallback,
  useContext,
  useDebugValue,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useMemo,
  useLayoutEffect as usePreactLayoutEffect,
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
  return usePreactLayoutEffect(effect, deps);
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
  return usePreactLayoutEffect(effect, deps);
}

export {
  // preact
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
