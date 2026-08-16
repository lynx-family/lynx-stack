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
  GlobalPropsConsumer,
  GlobalPropsProvider,
  MainThreadEvent,
  MainThreadInstance,
  MainThreadRef,
  PureComponent,
  Suspense,
  cloneElement,
  createPortal,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  mainThread,
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
  useLynxGlobalEventListener,
  useGlobalProps,
  useGlobalPropsChanged,
  useLayoutEffect,
  useMainThreadEffect,
  useMainThreadEvent,
  useMainThreadEvents,
  useMainThreadInstance,
  useMainThreadRef,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  withInitDataInState,
} = target[sExportsReact];

const { defineMainThreadObjectType: defineMainThreadObjectTypeImpl } = target[sExportsReact];
const { useMainThreadObject: useMainThreadObjectImpl } = target[sExportsReact];

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

export default target[sExportsReact]['default'];
