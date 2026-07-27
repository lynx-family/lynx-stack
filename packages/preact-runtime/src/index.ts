// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A transform-free ReactLynx runtime: vanilla preact rendering purely on the
 * background thread against a remote-DOM, with a fixed main-thread runtime
 * applying element ops. No compile-time transform is required.
 */

export {
  Component,
  createContext,
  createElement,
  createElement as h,
  cloneElement,
  createRef,
  Fragment,
  isValidElement,
  toChildArray,
} from 'preact';
export type { ComponentChild, ComponentType, JSX, VNode } from 'preact';

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
} from 'preact/hooks';

export { lazy, Suspense } from 'preact/compat';

export { root } from './runtime.js';
export { runOnMainThread } from './worklet.js';
export { registerRemoteModule, registerSharedModule } from './remote.js';
