// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReactCompat, target } from './target.js';

export const {
  Children,
  Component,
  Fragment,
  InitDataConsumer,
  InitDataProvider,
  MainThreadRef,
  PureComponent,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  root,
  runOnBackground,
  runOnMainThread,
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useInitData,
  useInitDataChanged,
  useLynxGlobalEventListener,
  useLayoutEffect,
  useMainThreadRef,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  withInitDataInState,

  // compat
  startTransition,
  useTransition,
} = target[sExportsReactCompat];

export default target[sExportsReactCompat]['default'];
