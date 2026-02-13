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
  useEffect as usePreactEffect,
  useState as usePreactState,
  useReducer,
  useRef,
} from 'preact/hooks';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { DependencyList, EffectCallback } from 'react';

import type { TraceOption } from '@lynx-js/types';

import { isProfiling, profileEnd, profileFlowId, profileStart } from '../debug/profile.js';

function buildTraceOption(flowId: number, stack: string | undefined): TraceOption {
  if (!stack) {
    return { flowId };
  }
  return {
    flowId,
    args: {
      stack,
    },
  };
}

function withEffectProfile(
  effect: EffectCallback,
  traceName: string,
  flowId: number,
  stack: string | undefined,
): EffectCallback {
  const traceOption = buildTraceOption(flowId, stack);
  return () => {
    profileStart(traceName, traceOption);
    try {
      const cleanup = effect();
      if (typeof cleanup !== 'function') {
        return cleanup;
      }
      return () => {
        profileStart(`${traceName}::cleanup`, traceOption);
        try {
          cleanup();
        } finally {
          profileEnd();
        }
      };
    } finally {
      profileEnd();
    }
  };
}

function useEffectWithProfile(effect: EffectCallback, deps: DependencyList | undefined, traceName: string): void {
  const flowId = profileFlowId();
  const stack = new Error().stack;
  const traceOption = buildTraceOption(flowId, stack);
  profileStart(traceName, traceOption);
  try {
    return usePreactEffect(withEffectProfile(effect, `${traceName}::callback`, flowId, stack), deps);
  } finally {
    profileEnd();
  }
}

function useLayoutEffectProfiled(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectWithProfile(effect, deps, 'ReactLynx::hooks::useLayoutEffect');
}

function useEffectProfiled(effect: EffectCallback, deps?: DependencyList): void {
  return useEffectWithProfile(effect, deps, 'ReactLynx::hooks::useEffect');
}

function useStateWithProfile<S>(initialState: S | (() => S)): [S, Dispatch<StateUpdater<S>>];
function useStateWithProfile<S = undefined>(): [S | undefined, Dispatch<StateUpdater<S | undefined>>];
function useStateWithProfile<S>(
  initialState?: S | (() => S),
): [S | undefined, Dispatch<StateUpdater<S | undefined>>] {
  const [state, setState] = (
    arguments.length === 0
      ? usePreactState<S | undefined>()
      : usePreactState(initialState as S | (() => S))
  ) as [S | undefined, Dispatch<StateUpdater<S | undefined>>];
  const tracedSetState = useCallback<Dispatch<StateUpdater<S | undefined>>>((nextState) => {
    const stack = new Error().stack;
    const traceOption = stack
      ? ({ args: { stack } } as TraceOption)
      : undefined;
    profileStart('ReactLynx::hooks::useState::setter', traceOption);
    try {
      return setState(nextState);
    } finally {
      profileEnd();
    }
  }, [setState]);
  return [state, tracedSetState];
}

const useState: typeof usePreactState = isProfiling
  ? useStateWithProfile as typeof usePreactState
  : usePreactState;

/**
 * Accepts a function that contains imperative, possibly effectful code.
 * The effects run after main thread dom update without blocking it.
 *
 * @param effect - Imperative function that can return a cleanup function
 * @param deps - If present, effect will only activate if the values in the list change (using ===).
 *
 * @public
 */
const useEffect: (effect: EffectCallback, deps?: DependencyList) => void = isProfiling
  ? useEffectProfiled
  : usePreactEffect;

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
const useLayoutEffect: (effect: EffectCallback, deps?: DependencyList) => void = isProfiling
  ? useLayoutEffectProfiled
  : usePreactEffect;

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
