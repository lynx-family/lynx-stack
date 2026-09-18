// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * `@lynx-js/react` is React for Lynx. It keeps the React 17 API surface,
 * re-exporting the standard hooks and APIs, and adds what the dual-thread
 * model needs: main-thread functions, the data a page receives from native,
 * and a few compile-time directives and macros.
 *
 * @groupDescription Hooks
 * Hooks that ReactLynx adds on top of React, plus the React hooks it
 * re-exports or re-implements for the dual-thread model.
 *
 * @groupDescription Components
 * Provider and consumer components for the data a Lynx page receives from
 * the native side, and the components re-exported from React.
 *
 * @groupDescription Functions
 * Functions for crossing the thread boundary, creating elements outside JSX
 * and mounting the root.
 *
 * @groupDescription Types
 * The types and classes exported by `@lynx-js/react`. Augment `InitData` and
 * `GlobalProps` in your project to type the data your page receives.
 *
 * @document ../docs/directives.md
 * @document ../docs/macros.md
 * @document ../docs/global-events.md
 * @document ../docs/import-attributes.md
 *
 * @packageDocumentation
 */

import type { ReactLynxChildren } from '../runtime/lib/index.js';

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
  /**
   * Determines if preact devtools is enabled.
   *
   * Enabled by default in development. In production it can be enabled by the
   * environment variable `REACT_DEVTOOL=true`.
   */
  let __REACT_DEVTOOL__: boolean | undefined;
  /**
   * Which lazy bundle fetcher the build is wired up to. `'FetchBundle'`
   * enables the `lynx.fetchBundle`-based path (and `import(..., { with: { mode } })`
   * mode hints); `'QueryComponent'` is the legacy `lynx.QueryComponent` path.
   */
  let __LAZY_BUNDLE_FETCHER__: 'FetchBundle' | 'QueryComponent';
}

/**
 * Built-in React Hooks
 * @see https://react.dev/reference/react/hooks
 *
 * @group Hooks
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

export { useEffect, useLayoutEffect } from '../runtime/lib/core/hooks/react.js';

/**
 * Catches errors thrown by the components below and lets the component
 * render a fallback.
 * @see https://preactjs.com/guide/v10/hooks/#useerrorboundary
 *
 * @group Hooks
 */
export { useErrorBoundary } from '../runtime/lib/core/hooks/react.js';

/**
 * Built-in React APIs
 * @see https://react.dev/reference/react/apis
 *
 * @group Functions
 */
export { createContext, forwardRef, lazy, memo } from 'react';

/**
 * Lets you group elements without a wrapper node.
 * @see https://react.dev/reference/react/Fragment
 *
 * @public
 *
 * @group Components
 *
 * @function
 */
export const Fragment: typeof import('react').Fragment;

/**
 * Lets you display a fallback until its children have finished loading.
 * @see https://react.dev/reference/react/Suspense
 *
 * @public
 *
 * @group Components
 *
 * @function
 */
export const Suspense: typeof import('react').Suspense;

/**
 * Legacy React APIs
 * @see https://react.dev/reference/react/legacy
 *
 * @group Components
 */
export { Component, PureComponent } from 'react';

/**
 * Legacy React APIs
 * @see https://react.dev/reference/react/legacy
 *
 * @group Functions
 */
export { createRef, isValidElement } from 'react';

export type { CloneElement, CreateElement, ReactLynxChildren } from '../runtime/lib/index.js';

/**
 * ReactLynx children utilities.
 *
 * Arrays returned by `map`, `forEach`, and `toArray` are frozen.
 *
 * @public
 *
 * @group Functions
 */
export const Children: ReactLynxChildren;

/**
 * Renders children into a different ReactLynx element identified by a
 * `NodesRef` (e.g. from `ref={setX}` or `lynx.createSelectorQuery()`).
 *
 * @public
 *
 * @group Functions
 */
export { createPortal } from '../runtime/lib/index.js';

/**
 * Creates a ReactLynx element from a Lynx intrinsic element name or a
 * component type. Lynx intrinsic elements are processed by the ReactLynx
 * snapshot runtime.
 *
 * @see https://react.dev/reference/react/createElement
 * @public
 */
export { createElement } from '../runtime/lib/index.js';

/**
 * Clones an existing ReactLynx element and applies new props through the
 * ReactLynx runtime. Runtime-created elements and components may also receive
 * replacement children.
 *
 * @see https://react.dev/reference/react/cloneElement
 * @public
 */
export { cloneElement } from '../runtime/lib/index.js';

/**
 * RL-defined Lynx APIs
 */
export * from '../runtime/lib/lynx-api.js';
