// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
declare global {
  /**
   * Determines if code should be placed in the background thread, used as a compile-time define macro
   *
   * @deprecated use `__BACKGROUND__` instead
   */
  let __JS__: boolean;
  /**
   * Determines if code should be placed in the background thread, used as a compile-time define macro
   */
  let __BACKGROUND__: boolean;
  /**
   * Determines if code should be placed in the main thread, used as a compile-time define macro
   *
   * @deprecated use `__MAIN_THREAD__` instead
   */
  let __LEPUS__: boolean;
  /**
   * Determines if code should be placed in the main thread, used as a compile-time define macro
   */
  let __MAIN_THREAD__: boolean;
  /**
   * Determines if running in dev mode
   */
  let __DEV__: boolean;
  /**
   * Determines if running in profile mode
   */
  let __PROFILE__: boolean;
}

/**
 * Built-in React Hooks
 * @see https://react.dev/reference/react/hooks
 */
export {
  useCallback,
  useContext,
  useDebugValue,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

export { useEffect, useLayoutEffect, useErrorBoundary } from '../runtime/lib/hooks/react.js';

/**
 * Built-in React APIs
 * @see https://react.dev/reference/react/apis
 */
export { createContext, forwardRef, lazy, memo } from 'react';

/**
 * Built-in React Components
 * @see https://react.dev/reference/react/components
 */
export { Fragment, Suspense } from 'react';

/**
 * Legacy React APIs
 * @see https://react.dev/reference/react/legacy
 */
export { Component, PureComponent, createElement, createRef, isValidElement } from 'react';

/**
 * RL-defined Lynx APIs
 */
export * from '../runtime/lib/lynx-api.js';
