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
  GlobalPropsProvider,
  GlobalPropsConsumer,
  MainThreadObjectHandle,
  MainThreadRef,
  MainThreadValue,
  PureComponent,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createPortal,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  markFirstScreenSyncReady,
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
  useGlobalProps,
  useGlobalPropsChanged,
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

const { defineMainThreadObjectType: defineMainThreadObjectTypeImpl } = target[sExportsReactCompat];
const { useMainThreadObject: useMainThreadObjectImpl } = target[sExportsReactCompat];

export function defineMainThreadObjectType(definition) {
  assertMainThreadObjectRuntimeExport(
    defineMainThreadObjectTypeImpl,
    'defineMainThreadObjectType',
  );
  return defineMainThreadObjectTypeImpl(definition);
}

export function useMainThreadObject(objectType, initialValue) {
  assertMainThreadObjectRuntimeExport(
    useMainThreadObjectImpl,
    'useMainThreadObject',
  );
  return useMainThreadObjectImpl(objectType, initialValue);
}

function assertMainThreadObjectRuntimeExport(value, name) {
  if (typeof value !== 'function') {
    throw new Error(
      `This lazy bundle requires ReactLynx runtime export ${name} for MainThreadObject. Upgrade the main template runtime or rebuild the lazy bundle with a compatible @lynx-js/react version.`,
    );
  }
}

export default target[sExportsReactCompat]['default'];
