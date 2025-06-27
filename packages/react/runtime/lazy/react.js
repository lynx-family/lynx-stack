// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReact, target } from './target';

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
} = target[sExportsReact];

export default target[sExportsReact]['default'];
