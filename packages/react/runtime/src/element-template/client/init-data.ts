// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext, createElement } from 'preact/compat';
import type { ComponentClass, Consumer, FC, ReactNode } from 'react';

import { createLynxGlobalEventListenerHook } from '../../core/hooks/createLynxGlobalEventListenerHook.js';
import { createDataApiShell, createWithDataInState } from '../../core/lynx-data.js';
import type { InitData } from '../../lynx-api.js';
import { markInitDataUpdatedForCurrentCommit } from '../background/commit-context.js';
import { useEffect, useMemo, useRef, useState } from '../hooks/react.js';

const useDataChanged = /* @__PURE__ */ createLynxGlobalEventListenerHook({
  useEffect,
  useMemo,
  useRef,
});

function readInitData(): InitData {
  return lynx.__initData as InitData;
}

const _InitData = /* @__PURE__ */ createDataApiShell<InitData>(
  {
    createContext,
    useState,
    createElement,
    useDataChanged,
  },
  {
    eventName: 'onDataChanged',
    readData: readInitData,
    markDataUpdated: markInitDataUpdatedForCurrentCommit,
  },
);

// @ts-expect-error make preact and react types work
export const InitDataProvider: FC<{ children?: ReactNode | undefined }> = /* @__PURE__ */ _InitData.Provider();

// @ts-expect-error make preact and react types work
export const InitDataConsumer: Consumer<InitData> = /* @__PURE__ */ _InitData.Consumer();

export const useInitData: () => InitData = /* @__PURE__ */ _InitData.use();

export const useInitDataChanged: (callback: (data: InitData) => void) => void = /* @__PURE__ */ _InitData
  .useChanged();

const withInitDataInStateImpl = /* @__PURE__ */ createWithDataInState<InitData>({
  eventName: 'onDataChanged',
  readData: readInitData,
  markDataUpdated: markInitDataUpdatedForCurrentCommit,
});

export function withInitDataInState<P, S>(App: ComponentClass<P, S>): ComponentClass<P, S> {
  return withInitDataInStateImpl(App);
}
