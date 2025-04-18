// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as ReactAPIs from '@lynx-js/react';
import * as ReactInternal from '@lynx-js/react/internal';
import * as ReactJSXDevRuntime from '@lynx-js/react/jsx-dev-runtime';
import * as ReactJSXRuntime from '@lynx-js/react/jsx-runtime';
import * as ReactLegacyReactRuntime from '@lynx-js/react/legacy-react-runtime';
import * as ReactLepusAPIs from '@lynx-js/react/lepus';

import {
  sExportsJSXDevRuntime,
  sExportsJSXRuntime,
  sExportsLegacyReactRuntime,
  sExportsReact,
  sExportsReactInternal,
  sExportsReactLepus,
  target,
} from './target';

Object.defineProperty(target, sExportsReact, {
  value: {
    Children: ReactAPIs.Children,
    Component: ReactAPIs.Component,
    Fragment: ReactAPIs.Fragment,
    InitDataConsumer: ReactAPIs.InitDataConsumer,
    InitDataProvider: ReactAPIs.InitDataProvider,
    PureComponent: ReactAPIs.PureComponent,
    Suspense: ReactAPIs.Suspense,
    createContext: ReactAPIs.createContext,
    createElement: ReactAPIs.createElement,
    createRef: ReactAPIs.createRef,
    forwardRef: ReactAPIs.forwardRef,
    isValidElement: ReactAPIs.isValidElement,
    lazy: ReactAPIs.lazy,
    memo: ReactAPIs.memo,
    root: ReactAPIs.root,
    useCallback: ReactAPIs.useCallback,
    useContext: ReactAPIs.useContext,
    useDebugValue: ReactAPIs.useDebugValue,
    useEffect: ReactAPIs.useEffect,
    useErrorBoundary: ReactAPIs.useErrorBoundary,
    useId: ReactAPIs.useId,
    useImperativeHandle: ReactAPIs.useImperativeHandle,
    useInitData: ReactAPIs.useInitData,
    useInitDataChanged: ReactAPIs.useInitDataChanged,
    useLayoutEffect: ReactAPIs.useLayoutEffect,
    useLynxGlobalEventListener: ReactAPIs.useLynxGlobalEventListener,
    useMemo: ReactAPIs.useMemo,
    useReducer: ReactAPIs.useReducer,
    useRef: ReactAPIs.useRef,
    useState: ReactAPIs.useState,
    useSyncExternalStore: ReactAPIs.useSyncExternalStore,
    withInitDataInState: ReactAPIs.withInitDataInState,
    // Shake worklet APIs if not used.
    /* c8 ignore next */
    ...(__DISABLE_MTS_AND_GESTURE__ && process.env['NODE_ENV'] !== 'test') ? {} : {
      MainThreadRef: ReactAPIs.MainThreadRef,
      runOnBackground: ReactAPIs.runOnBackground,
      runOnMainThread: ReactAPIs.runOnMainThread,
      useMainThreadRef: ReactAPIs.useMainThreadRef,
    },
  },
  enumerable: false,
  writable: false,
});

Object.defineProperty(target, sExportsReactLepus, {
  // Shake main-thread only APIs in background thread.
  /* c8 ignore next */
  value: __BACKGROUND__ && process.env['NODE_ENV'] !== 'test' ? undefined : ReactLepusAPIs,
  enumerable: false,
  writable: false,
});

Object.defineProperty(target, sExportsReactInternal, {
  value: {
    Component: ReactInternal.Component,
    __ComponentIsPolyfill: ReactInternal.__ComponentIsPolyfill,
    __DynamicPartChildren: ReactInternal.__DynamicPartChildren,
    __DynamicPartChildren_0: ReactInternal.__DynamicPartChildren_0,
    __DynamicPartListChildren: ReactInternal.__DynamicPartListChildren,
    __DynamicPartMultiChildren: ReactInternal.__DynamicPartMultiChildren,
    __DynamicPartSlot: ReactInternal.__DynamicPartSlot,
    __dynamicImport: ReactInternal.__dynamicImport,
    __page: ReactInternal.__page,
    __pageId: ReactInternal.__pageId,
    __root: ReactInternal.__root,
    createSnapshot: ReactInternal.createSnapshot,
    loadDynamicJS: ReactInternal.loadDynamicJS,
    loadLazyBundle: ReactInternal.loadLazyBundle,
    options: ReactInternal.options,
    snapshotManager: ReactInternal.snapshotManager,
    transformRef: ReactInternal.transformRef,
    withInitDataInState: ReactInternal.withInitDataInState,
    wrapWithLynxComponent: ReactInternal.wrapWithLynxComponent,
    // Shake worklet APIs if not used.
    /* c8 ignore next */
    ...(__DISABLE_MTS_AND_GESTURE__ && process.env['NODE_ENV'] !== 'test') ? {} : {
      updateGesture: ReactInternal.updateGesture,
      loadWorkletRuntime: ReactInternal.loadWorkletRuntime,
      registerWorkletOnBackground: ReactInternal.registerWorkletOnBackground,
      transformToWorklet: ReactInternal.transformToWorklet,
      updateWorkletEvent: ReactInternal.updateWorkletEvent,
      updateWorkletRef: ReactInternal.updateWorkletRef,
    },
    // Shake main-thread only APIs in background thread.
    /* c8 ignore next */
    ...(__BACKGROUND__ && process.env['NODE_ENV'] !== 'test') ? {} : {
      SnapshotInstance: ReactInternal.SnapshotInstance,
      updateListItemPlatformInfo: ReactInternal.updateListItemPlatformInfo,
      updateSpread: ReactInternal.updateSpread,
      snapshotCreateList: ReactInternal.snapshotCreateList,
      updateRef: ReactInternal.updateRef,
      updateEvent: ReactInternal.updateEvent,
    },
  },
  enumerable: false,
  writable: false,
});

Object.defineProperty(target, sExportsJSXRuntime, {
  value: ReactJSXRuntime,
  enumerable: false,
  writable: false,
});

Object.defineProperty(target, sExportsJSXDevRuntime, {
  // Shake JSX Dev Runtime on non-dev environment.
  /* c8 ignore next */
  value: (!__DEV__ && process.env['NODE_ENV'] !== 'test') ? undefined : ReactJSXDevRuntime,
  enumerable: false,
  writable: false,
});

Object.defineProperty(target, sExportsLegacyReactRuntime, {
  value: ReactLegacyReactRuntime,
  enumerable: false,
  writable: false,
});
