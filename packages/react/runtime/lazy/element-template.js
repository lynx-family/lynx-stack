// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RUNTIME_BACKEND_ELEMENT_TEMPLATE, registerLazyRuntimeBackend, sExportsReact, target } from './target.js';

registerLazyRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

export const {
  Children,
  Component,
  Fragment,
  InitDataConsumer,
  InitDataProvider,
  GlobalPropsConsumer,
  GlobalPropsProvider,
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
  useGlobalProps,
  useGlobalPropsChanged,
  useLayoutEffect,
  useMainThreadRef,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  withInitDataInState,
} = target[sExportsReact];

export default target[sExportsReact]['default'];
