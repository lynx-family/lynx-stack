// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import './runtime-backend-marker.js';
import {
  Children,
  Component,
  Fragment,
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
  useSyncExternalStore,
} from 'preact/compat';
import type { Consumer, FC, ReactNode } from 'react';

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
} from '@lynx-js/react/hooks';

import { installComponentCompat } from '../core/component.js';
import { createGlobalProps } from '../core/globalProps.js';
import type { GlobalProps } from '../core/globalProps.js';
import { useLynxGlobalEventListener } from '../core/hooks/useLynxGlobalEventListener.js';
import { factory, withInitDataInState } from '../core/initData.js';
import type { InitData } from '../lynx-api.js';
import './native/index.js';

installComponentCompat();

export { Component, createContext } from 'preact';
export { PureComponent } from 'preact/compat';
export * from '@lynx-js/react/hooks';

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

const _InitData = /* @__PURE__ */ factory<InitData>(
  {
    createContext,
    useState,
    createElement,
    useLynxGlobalEventListener,
  },
  '__initData',
  'onDataChanged',
);

// @ts-expect-error make preact and react types work
export const InitDataProvider: FC<{ children?: ReactNode | undefined }> = /* @__PURE__ */ _InitData.Provider();
// @ts-expect-error make preact and react types work
export const InitDataConsumer: Consumer<InitData> = /* @__PURE__ */ _InitData.Consumer();
export const useInitData: () => InitData = /* @__PURE__ */ _InitData.use();
export const useInitDataChanged: (callback: (data: InitData) => void) => void = /* @__PURE__ */ _InitData.useChanged();

const _GlobalProps = /* @__PURE__ */ createGlobalProps<GlobalProps>({
  createContext,
  useState,
  createElement,
  useLynxGlobalEventListener,
});

// @ts-expect-error make preact and react types work
export const GlobalPropsProvider: FC<{ children?: ReactNode | undefined }> = /* @__PURE__ */ _GlobalProps.Provider();
// @ts-expect-error make preact and react types work
export const GlobalPropsConsumer: Consumer<GlobalProps> = /* @__PURE__ */ _GlobalProps.Consumer();
export const useGlobalProps: () => GlobalProps = /* @__PURE__ */ _GlobalProps.use();
export const useGlobalPropsChanged: (callback: (data: GlobalProps) => void) => void = /* @__PURE__ */ _GlobalProps
  .useChanged();

export { withInitDataInState };
export { useLynxGlobalEventListener };

export * from './client/root.js';

export type { GlobalProps } from '../core/globalProps.js';
export type { DataProcessorDefinition, DataProcessors, InitData, InitDataRaw } from '../lynx-api.js';
