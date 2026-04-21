// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements hooks in main thread.
 * This module is modified from preact/hooks
 *
 * internal-preact/hooks/dist/hooks.mjs
 */

import { options } from 'preact';
import type { Component, ErrorInfo, PreactContext } from 'preact';
import type {
  Dispatch,
  useEffect as useEffectType,
  useErrorBoundary as useErrorBoundaryType,
  useImperativeHandle as useImperativeHandleType,
  useLayoutEffect as useLayoutEffectType,
} from 'preact/hooks';

import {
  CHILDREN,
  COMPONENT,
  DIFF,
  DIFFED,
  HOOK,
  HOOKS,
  LIST,
  MASK,
  PARENT,
  PENDING_EFFECTS,
  RENDER,
  ROOT,
  VALUE,
  VNODE,
} from '../renderToOpcodes/constants.js';
import { noop } from '../../utils.js';

let currentIndex: number;
let currentComponent: Component | null | undefined;
let currentHook: number;

const oldBeforeDiff = options[DIFF];
const oldBeforeRender = options[RENDER];
const oldAfterDiff = options[DIFFED];
const oldRoot = options[ROOT];

options[DIFF] = function(vnode) {
  currentComponent = null;
  if (oldBeforeDiff) oldBeforeDiff(vnode);
};

/* v8 ignore start */
options[ROOT] = function(vnode, parentDom) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (vnode && parentDom[CHILDREN] && parentDom[CHILDREN][MASK]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    vnode[MASK] = parentDom[CHILDREN][MASK] as [number, number];
  }
  if (oldRoot) oldRoot(vnode, parentDom);
};
/* v8 ignore stop */

options[RENDER] = function(vnode) {
  if (oldBeforeRender) oldBeforeRender(vnode);
  currentComponent = vnode[COMPONENT];
  currentIndex = 0;
};

options[DIFFED] = function(vnode) {
  if (oldAfterDiff) oldAfterDiff(vnode);
  currentComponent = null;
};

function getHookState(index: number, type: number) {
  if (options[HOOK]) {
    options[HOOK](currentComponent!, index, currentHook || type);
  }
  currentHook = 0;
  const hooks = currentComponent![HOOKS] ?? (currentComponent![HOOKS] = {
    [LIST]: [],
    [PENDING_EFFECTS]: [],
  });
  if (index >= hooks[LIST]!.length) {
    hooks[LIST]!.push({});
  }
  return hooks[LIST]![index];
}

function invokeOrReturn(arg: unknown, f: (...args: unknown[]) => unknown) {
  return typeof f == 'function' ? f(arg) : f;
}

function useState<S>(initialState: S | (() => S)) {
  currentHook = 1;
  return useReducer(noop, initialState) as [S, Dispatch<unknown>];
}

function useReducer<S, A>(
  _reducer: (prevState: S, action: A) => S,
  initialState: S | (() => S),
  init?: (initialState: S) => S,
) {
  const hookState = getHookState(currentIndex++, 2)!;
  if (!hookState[COMPONENT]) {
    hookState[VALUE] = [
      /* v8 ignore start */
      init ? init(initialState as S) : invokeOrReturn(undefined, initialState as (() => S)),
      /* v8 ignore stop */
      function(_action: A) {
        if (__DEV__) {
          console.error('Cannot update state in main thread!');
        }
      },
    ];
    hookState[COMPONENT] = currentComponent;
  }
  return hookState[VALUE] as [S, Dispatch<A>];
}

function useRef<T>(initialValue?: T): { current: T | undefined } {
  currentHook = 5;
  return useMemo(function() {
    return {
      current: initialValue,
    };
  }, []);
}

// used for first screen and need not to cache value by args
function useMemo<T>(factory: () => T, _args: ReadonlyArray<unknown>): T {
  const state = getHookState(currentIndex++, 7)!;
  state[VALUE] = factory();
  return state[VALUE] as T;
}

function useCallback<T>(callback: T, args: ReadonlyArray<unknown>): T {
  currentHook = 8;
  return useMemo(function() {
    return callback;
  }, args);
}

function useContext<T>(context: PreactContext<T>): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const provider = currentComponent!.context[context.__c] as {
    props: {
      value: T;
    };
  };
  const state = getHookState(currentIndex++, 9)!;
  state['c'] = context;
  /* v8 ignore start */
  if (!provider) return context.__;
  /* v8 ignore stop */
  state[VALUE] = true;
  return provider.props.value;
}

function useDebugValue<T>(value: T, formatter?: (value: T) => string | number): void {
  if (options.useDebugValue) {
    /* v8 ignore start */
    options.useDebugValue(formatter ? formatter(value) : value as string | number);
    /* v8 ignore stop */
  }
}

function useErrorBoundary(cb: (error: any, errorInfo: ErrorInfo) => Promise<void> | void) {
  const state = getHookState(currentIndex++, 10)!;
  state[VALUE] = cb;
  return [undefined, noop] as ReturnType<typeof useErrorBoundaryType>;
}

function useId(): string {
  const state = getHookState(currentIndex++, 11)!;
  if (!state[VALUE]) {
    // Grab either the root node or the nearest async boundary node.
    let root = currentComponent![VNODE];
    while (root !== null && !root![MASK] && root![PARENT] !== null) {
      root = root![PARENT];
    }
    /**
     * init mask to [0, 0]
     * mask[0] will not change
     * mask[1] will auto increase
     */
    const mask = root![MASK] ?? (root![MASK] = [0, 0]);
    state[VALUE] = 'P' + mask[0] + '-' + mask[1]++;
  }
  return state[VALUE] as string;
}

// background hooks
const useEffect = noop as typeof useEffectType;
const useLayoutEffect = noop as typeof useLayoutEffectType;
const useImperativeHandle = noop as typeof useImperativeHandleType;

export {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
};
