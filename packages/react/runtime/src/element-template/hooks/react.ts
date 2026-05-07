// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as mainThreadHooks from '../../core/hooks/mainThreadImpl.js';
import * as backgroundHooks from '../../core/hooks/react.js';

function currentHooks(): typeof backgroundHooks {
  return __MAIN_THREAD__
    ? mainThreadHooks as unknown as typeof backgroundHooks
    : backgroundHooks;
}

const useState =
  ((...args: unknown[]) =>
    (currentHooks().useState as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useState;
const useReducer =
  ((...args: unknown[]) =>
    (currentHooks().useReducer as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useReducer;
const useRef =
  ((...args: unknown[]) =>
    (currentHooks().useRef as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useRef;
const useImperativeHandle =
  ((...args: unknown[]) =>
    (currentHooks().useImperativeHandle as (...args: unknown[]) => unknown)(
      ...args,
    )) as typeof backgroundHooks.useImperativeHandle;
const useLayoutEffect = ((...args: unknown[]) =>
  (currentHooks().useLayoutEffect as (...args: unknown[]) => unknown)(
    ...args,
  )) as typeof backgroundHooks.useLayoutEffect;
const useEffect =
  ((...args: unknown[]) =>
    (currentHooks().useEffect as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useEffect;
const useCallback =
  ((...args: unknown[]) =>
    (currentHooks().useCallback as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useCallback;
const useMemo =
  ((...args: unknown[]) =>
    (currentHooks().useMemo as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useMemo;
const useContext =
  ((...args: unknown[]) =>
    (currentHooks().useContext as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useContext;
const useDebugValue =
  ((...args: unknown[]) =>
    (currentHooks().useDebugValue as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useDebugValue;
const useErrorBoundary = ((...args: unknown[]) =>
  (currentHooks().useErrorBoundary as (...args: unknown[]) => unknown)(
    ...args,
  )) as typeof backgroundHooks.useErrorBoundary;
const useId =
  ((...args: unknown[]) =>
    (currentHooks().useId as (...args: unknown[]) => unknown)(...args)) as typeof backgroundHooks.useId;

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
