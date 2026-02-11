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
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
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
  if (!isProfiling) {
    return usePreactEffect(effect, deps);
  }

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
  return useEffectWithProfile(effect, deps, 'ReactLynx::hooks::useLayoutEffect');
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
  return useEffectWithProfile(effect, deps, 'ReactLynx::hooks::useEffect');
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
