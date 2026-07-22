// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './runtime-backend-marker.js';
import './lynx.js';
import {
  Component,
  Fragment,
  PureComponent,
  createContext,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useSyncExternalStore,
} from 'preact/compat';

import { installComponentCompat } from './core/component.js';
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
} from './core/hooks/react.js';
import { Children } from './snapshot/lynx/children.js';
import { cloneElement, createElement } from './snapshot/lynx/element.js';
import { createPortal } from './snapshot/lynx/portals.js';
import { Suspense } from './snapshot/lynx/suspense.js';
import './multi-page.js';

export type { ReactLynxChildren } from './snapshot/lynx/children.js';
export type { CloneElement, CreateElement } from './snapshot/lynx/element.js';

installComponentCompat();

export { Component, createContext } from 'preact';
export { PureComponent } from 'preact/compat';
export * from './core/hooks/react.js';

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
  cloneElement,
  createPortal,
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
  createPortal,
};

export * from './lynx-api.js';
