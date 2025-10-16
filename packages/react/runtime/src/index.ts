// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './lynx.js';
import './lynx/component.js';
import {
  Children,
  Component,
  Fragment,
  PureComponent,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  memo,
  lazy as preactLazy,
  useSyncExternalStore,
} from 'preact/compat';

import {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from './hooks/react.js';
import { loadLazyBundle } from './lynx/lazy-bundle.js';
import { Suspense } from './lynx/suspense.js';

export { Component, createContext } from 'preact';
export { PureComponent } from 'preact/compat';
export * from './hooks/react.js';

const lazy: typeof import('preact/compat').lazy = /*#__PURE__*/ (() => {
  lynx.loadLazyBundle = loadLazyBundle;
  return preactLazy;
})();

/**
 * @internal
 */
export default {
  // hooks
  useState,
  useReducer,
  useEffect,
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  useContext,
  useDebugValue,
  useSyncExternalStore,

  createContext,
  createRef,
  Fragment,
  isValidElement,
  Children,
  Component,
  PureComponent,
  memo,
  forwardRef,
  Suspense,
  lazy,
  createElement,
};

export {
  Children,
  createRef,
  Fragment,
  isValidElement,
  memo,
  forwardRef,
  Suspense,
  lazy,
  createElement,
  cloneElement,
  useSyncExternalStore,
};

export * from './lynx-api.js';
